// 주문 편집 동작과 그 영향 미리보기. 모두 순수 함수다 (새 주문을 돌려준다).
// 참조(선행 작업, 전달 산출물, 담당 배정, 질문의 영향 작업)는 안정적인 id로 잇고,
// 지우거나 합칠 때 무엇이 끊기는지 먼저 보여 줄 수 있게 '영향' 함수를 따로 둔다.

import { newId } from '../id';
import { draftFromRequest } from './draft';
import type { Dependency, OrderDraft, Requirement, WorkItem, WorkScope } from './types';

// ───────────────────────── 작업 ─────────────────────────

export function blankWork(title = '새 작업'): WorkItem {
  return {
    id: newId('work'),
    title,
    description: '',
    inputs: [],
    outputs: [],
    criteria: [],
    overrides: [],
    checkpoint: false,
    required: true,
    origin: 'user',
    state: 'accepted',
    type: 'implementer',
  };
}

export interface RemovalImpact {
  deps: Dependency[];
  assignments: number;
  questions: string[];
}

/** 작업을 지우면 끊기는 것 */
export function workRemovalImpact(order: OrderDraft, workId: string): RemovalImpact {
  return {
    deps: order.deps.filter((dep) => dep.from === workId || dep.to === workId),
    assignments: order.assignments.filter((item) => item.workId === workId).length,
    questions: order.questions.filter((question) => question.affects.includes(workId)).map((question) => question.text),
  };
}

export function removeWork(order: OrderDraft, workId: string): OrderDraft {
  return {
    ...order,
    work: order.work.filter((item) => item.id !== workId),
    deps: order.deps.filter((dep) => dep.from !== workId && dep.to !== workId),
    assignments: order.assignments.filter((item) => item.workId !== workId),
    questions: order.questions.map((question) => ({ ...question, affects: question.affects.filter((id) => id !== workId) })),
  };
}

/** 산출물을 지우면 그 산출물을 넘기던 전달 */
export function outputRemovalImpact(order: OrderDraft, workId: string, outputId: string): Dependency[] {
  return order.deps.filter((dep) => dep.from === workId && dep.outputIds.includes(outputId));
}

export function removeOutput(order: OrderDraft, workId: string, outputId: string): OrderDraft {
  return {
    ...order,
    work: order.work.map((item) => (item.id === workId ? { ...item, outputs: item.outputs.filter((output) => output.id !== outputId) } : item)),
    deps: order.deps.map((dep) => (dep.from === workId ? { ...dep, outputIds: dep.outputIds.filter((id) => id !== outputId) } : dep)),
  };
}

export function moveWork(order: OrderDraft, workId: string, direction: -1 | 1): OrderDraft {
  const index = order.work.findIndex((item) => item.id === workId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.work.length) return order;
  const work = [...order.work];
  [work[index], work[target]] = [work[target], work[index]];
  return { ...order, work };
}

/**
 * 나누기: 원래 작업 바로 뒤에 새 작업을 만들고, 고른 산출물을 새 작업으로 옮긴다.
 * 그 산출물을 받던 전달은 새 작업에서 나가게 바꾸고, 원래 → 새 작업 전달을 하나 더한다.
 */
export function splitWork(order: OrderDraft, workId: string, newTitle: string, moveOutputIds: string[]): { order: OrderDraft; newId: string } {
  const source = order.work.find((item) => item.id === workId);
  if (!source) return { order, newId: '' };
  const moved = source.outputs.filter((output) => moveOutputIds.includes(output.id));
  const created: WorkItem = { ...blankWork(newTitle.trim() || `${source.title} (나눔)`), type: source.type, outputs: moved };
  const index = order.work.findIndex((item) => item.id === workId);
  const work = [...order.work];
  work[index] = { ...source, outputs: source.outputs.filter((output) => !moveOutputIds.includes(output.id)) };
  work.splice(index + 1, 0, created);
  const deps: Dependency[] = [];
  for (const dep of order.deps) {
    if (dep.from !== workId) {
      deps.push(dep);
      continue;
    }
    const keep = dep.outputIds.filter((id) => !moveOutputIds.includes(id));
    const take = dep.outputIds.filter((id) => moveOutputIds.includes(id));
    if (keep.length > 0 || take.length === 0) deps.push({ ...dep, outputIds: keep });
    if (take.length > 0) deps.push({ ...dep, id: newIdDep(), from: created.id, outputIds: take });
  }
  deps.push({ id: newIdDep(), from: workId, to: created.id, outputIds: work[index].outputs.map((output) => output.id), note: '' });
  return { order: { ...order, work, deps }, newId: created.id };
}

const newIdDep = () => newId('dep');

export interface MergeImpact {
  /** 합칠 작업을 가리키던 전달 중 다시 이어질 것 */
  redirected: Dependency[];
  /** 두 작업 사이의 전달 (합치면 없어진다) */
  dropped: Dependency[];
}

export function mergeImpact(order: OrderDraft, keepId: string, mergeId: string): MergeImpact {
  const between = (dep: Dependency) =>
    (dep.from === keepId && dep.to === mergeId) || (dep.from === mergeId && dep.to === keepId);
  return {
    redirected: order.deps.filter((dep) => (dep.from === mergeId || dep.to === mergeId) && !between(dep)),
    dropped: order.deps.filter(between),
  };
}

/** 합치기: mergeId 작업의 내용을 keepId 작업에 붙이고, 참조를 keepId로 옮긴다 */
export function mergeWork(order: OrderDraft, keepId: string, mergeId: string): OrderDraft {
  const keep = order.work.find((item) => item.id === keepId);
  const merge = order.work.find((item) => item.id === mergeId);
  if (!keep || !merge || keepId === mergeId) return order;
  const unique = (items: string[]) => [...new Set(items)];
  const merged: WorkItem = {
    ...keep,
    title: `${keep.title} + ${merge.title}`,
    description: [keep.description, merge.description].filter(Boolean).join('\n'),
    inputs: unique([...keep.inputs, ...merge.inputs]),
    outputs: [...keep.outputs, ...merge.outputs],
    criteria: unique([...keep.criteria, ...merge.criteria]),
    overrides: unique([...keep.overrides, ...merge.overrides]),
    checkpoint: keep.checkpoint || merge.checkpoint,
    required: keep.required || merge.required,
  };
  const deps: Dependency[] = [];
  for (const dep of order.deps) {
    const from = dep.from === mergeId ? keepId : dep.from;
    const to = dep.to === mergeId ? keepId : dep.to;
    if (from === to) continue;
    if (deps.some((item) => item.from === from && item.to === to)) {
      const existing = deps.find((item) => item.from === from && item.to === to)!;
      existing.outputIds = [...new Set([...existing.outputIds, ...dep.outputIds])];
      continue;
    }
    deps.push({ ...dep, from, to });
  }
  const assignments = order.assignments
    .map((item) => (item.workId === mergeId ? { ...item, workId: keepId } : item))
    .filter((item, index, all) => all.findIndex((other) => other.workId === item.workId && other.roleId === item.roleId && other.responsibility === item.responsibility) === index);
  return {
    ...order,
    work: order.work.filter((item) => item.id !== mergeId).map((item) => (item.id === keepId ? merged : item)),
    deps,
    assignments,
    questions: order.questions.map((question) => ({
      ...question,
      affects: [...new Set(question.affects.map((id) => (id === mergeId ? keepId : id)))],
    })),
  };
}

// ───────────────────────── 참조 점검 ─────────────────────────

export interface RefProblem {
  depId: string;
  message: string;
}

/** 없는 작업·산출물을 가리키는 전달 */
export function brokenRefs(order: OrderDraft): RefProblem[] {
  const ids = new Set(order.work.map((item) => item.id));
  const problems: RefProblem[] = [];
  for (const dep of order.deps) {
    if (!ids.has(dep.from) || !ids.has(dep.to)) {
      problems.push({ depId: dep.id, message: '없는 작업을 가리키는 전달이 있어요.' });
      continue;
    }
    const from = order.work.find((item) => item.id === dep.from)!;
    const missing = dep.outputIds.filter((id) => !from.outputs.some((output) => output.id === id));
    if (missing.length > 0) problems.push({ depId: dep.id, message: `"${from.title}"에서 지워진 산출물을 넘기는 전달이 있어요.` });
  }
  for (const item of order.assignments) {
    if (!ids.has(item.workId) || !order.roles.some((role) => role.id === item.roleId)) {
      problems.push({ depId: '', message: '없는 작업이나 역할을 가리키는 배정이 있어요.' });
    }
  }
  return problems;
}

/** 근거가 사라진 요구: 자료를 지웠거나, 원문에서 그 문장을 지웠다 */
export function staleEvidence(order: OrderDraft): { id: string; reason: string }[] {
  const out: { id: string; reason: string }[] = [];
  for (const item of order.requirements) {
    if (!item.evidence || item.state === 'excluded') continue;
    const { sourceId, excerpt } = item.evidence;
    const probe = excerpt.replace(/…$/, '');
    if (sourceId === 'request') {
      if (!order.request.text.includes(probe)) out.push({ id: item.id, reason: '원문에서 이 문장을 찾을 수 없어요 (원문이 바뀌었어요).' });
      continue;
    }
    const material = order.request.materials.find((entry) => entry.id === sourceId);
    if (!material) out.push({ id: item.id, reason: '근거였던 자료가 삭제됐어요.' });
    else if (!(material.content ?? '').includes(probe)) out.push({ id: item.id, reason: '자료에서 이 문장을 찾을 수 없어요.' });
  }
  return out;
}

export const requestChanged = (order: OrderDraft) =>
  order.request.textAtDraft !== undefined && order.request.textAtDraft !== order.request.text;

/** 원문을 다시 정리했을 때 새로 나오는 요구 (이미 있는 문장은 빼고). 기존 것은 지우지 않는다. */
export function redraftAdditions(order: OrderDraft): Requirement[] {
  const fresh = draftFromRequest(order.request.text, order.request.materials).requirements;
  const known = new Set(order.requirements.map((item) => `${item.kind}:${item.text}`));
  return fresh.filter((item) => item.source === 'explicit' && !known.has(`${item.kind}:${item.text}`));
}

// ───────────────────────── 공통 조건과 개별 조건 ─────────────────────────

/** 모든 작업이 물려받는 공통 조건 (확정된 반드시 지킬 조건·제외 범위) */
export function commonConditions(order: OrderDraft): Requirement[] {
  return order.requirements.filter((item) => item.state === 'accepted' && (item.kind === 'constraint' || item.kind === 'exclusion'));
}

const keyPhrases = (text: string) =>
  text
    .replace(/[.,!?'"()]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/(은|는|이|가|을|를|에|의|도|만|과|와|으로|로|에서)$/, ''))
    .filter((word) => word.length >= 2);

/**
 * 개별 조건이 공통 조건과 부딪힐 수 있는 곳 (낱말이 겹치는 정도로만 본다).
 * 예: 제외 범위 "결제 기능은 제외"와 작업의 개별 조건 "결제 기능 연동"
 */
export function overrideConflicts(order: OrderDraft, work: WorkItem): string[] {
  const out: string[] = [];
  for (const condition of commonConditions(order)) {
    const words = keyPhrases(condition.text).filter((word) => !['제외', '반드시', '하지', '않는다', '않음', '빼고', '말고'].includes(word));
    for (const override of work.overrides) {
      const shared = words.filter((word) => override.includes(word));
      if (shared.length > 0) {
        out.push(`개별 조건 "${override}"이(가) 공통 ${condition.kind === 'exclusion' ? '제외 범위' : '조건'} "${condition.text}"와 겹쳐요 (${shared.join(', ')}). 의도한 예외인지 확인해 주세요.`);
        break;
      }
    }
  }
  return out;
}

/** 서로 선후 관계가 없는 작업 쌍 = 동시에 해도 되는 후보 (제안일 뿐이다) */
export function parallelCandidates(order: OrderDraft): [string, string][] {
  const active = order.work.filter((item) => item.state !== 'excluded');
  const reach = new Map<string, Set<string>>();
  const visit = (id: string, seen: Set<string>) => {
    for (const dep of order.deps) if (dep.from === id && !seen.has(dep.to)) { seen.add(dep.to); visit(dep.to, seen); }
    return seen;
  };
  for (const item of active) reach.set(item.id, visit(item.id, new Set()));
  const pairs: [string, string][] = [];
  for (let a = 0; a < active.length; a += 1) {
    for (let b = a + 1; b < active.length; b += 1) {
      const x = active[a].id;
      const y = active[b].id;
      if (!reach.get(x)!.has(y) && !reach.get(y)!.has(x)) pairs.push([x, y]);
    }
  }
  return pairs;
}

// ───────────────────────── 작업 범위 선택 ─────────────────────────

export const SCOPE_LABELS: Record<WorkScope, { label: string; hint: string }> = {
  quick: { label: '빠른 탐색', hint: '조사 범위를 좁히고, 규칙이 덧붙인 검토 작업을 줄여요.' },
  evidence: { label: '근거 확인', hint: '조사·작성 결과의 핵심 주장을 따로 검토하는 작업을 더해요.' },
  alternatives: { label: '여러 안 비교', hint: '대안을 따로 만든 뒤 비교하는 작업을 더해요.' },
};

export interface ScopePreview {
  add: WorkItem[];
  remove: WorkItem[];
  notes: string[];
}

/** 범위를 바꾸면 더해지고 빠질 작업. 사용자가 만든 작업과 필수로 정한 작업은 빼지 않는다. */
export function scopePreview(order: OrderDraft, scope: WorkScope): ScopePreview {
  const active = order.work.filter((item) => item.state !== 'excluded');
  const preview: ScopePreview = { add: [], remove: [], notes: [] };
  const make = (title: string, description: string, type: WorkItem['type'], outputs: string[], criteria: string[]): WorkItem => ({
    ...blankWork(title),
    description,
    type,
    outputs: outputs.map((name) => ({ id: newId('out'), name })),
    criteria,
    origin: 'rule',
    state: 'proposed',
  });
  if (scope === 'quick') {
    // 사용자가 검토를 요구했으면(확정한 요구에 '검토'·'리뷰'가 있으면) 검토 작업을 빼지 않는다
    const reviewDemanded = order.requirements.some((item) => item.state === 'accepted' && /검토|리뷰/.test(item.text));
    preview.remove = reviewDemanded
      ? []
      : active.filter((item) => item.origin === 'rule' && item.type === 'reviewer' && item.state !== 'accepted');
    if (reviewDemanded) preview.notes.push('확정한 요구에 검토가 있어서 검토 작업은 줄이지 않아요.');
    preview.notes.push('조사 작업에 "핵심 1~2가지만 확인한다"는 개별 조건을 더해요.');
    if (active.some((item) => item.type === 'reviewer' && (item.origin === 'user' || item.state === 'accepted'))) {
      preview.notes.push('직접 만들었거나 확정한 검토 작업은 그대로 둬요.');
    }
  }
  if (scope === 'evidence') {
    const hasCheck = active.some((item) => item.title === '근거 검토');
    if (!hasCheck && active.some((item) => item.type === 'researcher' || item.type === 'writer')) {
      preview.add.push(make('근거 검토', '조사·작성 결과의 핵심 주장마다 출처가 맞는지 따로 확인한다.', 'reviewer', ['근거 확인표'], ['핵심 주장마다 출처 일치 여부를 적었다', '확인하지 못한 주장을 구분했다']));
    }
  }
  if (scope === 'alternatives') {
    if (!active.some((item) => item.title.startsWith('대안 '))) {
      preview.add.push(
        make('대안 A 만들기', '다른 대안과 상의하지 않고 독립적으로 한 가지 안을 만든다.', 'planner', ['대안 A'], ['다른 안을 보지 않고 만들었다']),
        make('대안 B 만들기', '대안 A와 다른 접근으로 독립적으로 한 가지 안을 만든다.', 'planner', ['대안 B'], ['대안 A와 다른 접근이다']),
        make('대안 비교', '같은 기준으로 두 안을 비교하고 추천과 이유를 적는다.', 'reviewer', ['비교표', '추천과 이유'], ['같은 기준으로 비교했다']),
      );
    }
  }
  return preview;
}

export function applyScope(order: OrderDraft, scope: WorkScope, preview: ScopePreview): OrderDraft {
  let next: OrderDraft = { ...order, scope };
  for (const item of preview.remove) next = removeWork(next, item.id);
  if (scope === 'quick') {
    next = {
      ...next,
      work: next.work.map((item) =>
        item.type === 'researcher' && !item.overrides.includes('핵심 1~2가지만 확인한다')
          ? { ...item, overrides: [...item.overrides, '핵심 1~2가지만 확인한다'] }
          : item,
      ),
    };
  }
  if (preview.add.length > 0) {
    const last = next.work.filter((item) => item.state !== 'excluded').at(-1);
    const added = preview.add;
    const deps: Dependency[] = [];
    if (scope === 'alternatives') {
      const [a, b, compare] = added;
      for (const alt of [a, b]) {
        if (last) deps.push({ id: newIdDep(), from: last.id, to: alt.id, outputIds: last.outputs.map((output) => output.id), note: '' });
        deps.push({ id: newIdDep(), from: alt.id, to: compare.id, outputIds: alt.outputs.map((output) => output.id), note: '' });
      }
    } else if (last) {
      deps.push({ id: newIdDep(), from: last.id, to: added[0].id, outputIds: last.outputs.map((output) => output.id), note: '' });
    }
    next = { ...next, work: [...next.work, ...added], deps: [...next.deps, ...deps] };
  }
  return next;
}
