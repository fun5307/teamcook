// 주문 → 레시피. 1차의 파일 생성·점검·미리보기·ZIP은 그대로 쓰고, 여기서는 레시피 데이터만 만든다.
// - 확정(accepted)한 요구·작업만 넣는다. 제안 상태로 남은 것은 넣지 않는다. 가정은 확정한 것만 '가정'으로 넣는다.
// - 역할 하나가 여러 작업을 맡으면, 그 역할의 지시문 안에 작업 ID·입력·산출물·완료 기준을 나눠 적는다.
// - 역할 사이의 전달은 레시피의 흐름(handoffs)이 되고, 같은 역할 안의 순서는 지시문에 적는다.
// - 레시피를 손으로 고친 뒤 다시 만들 때는 조용히 덮어쓰지 않는다 (linkState로 먼저 알린다).

import { checkRecipe } from '../exportCheck';
import { newId } from '../id';
import { runPrompt } from '../recipeMd';
import type { AgentCard, Deliverable, Handoff, ProviderData, Recipe } from '../../types';
import { RECIPE_SCHEMA_VERSION } from '../../types';
import { templateCard } from './team';
import { brokenRefs, commonConditions, requestChanged, staleEvidence } from './ops';
import type { OrderDraft, Requirement, WorkItem } from './types';

const accepted = (order: OrderDraft, kind?: Requirement['kind']) =>
  order.requirements.filter((item) => item.state === 'accepted' && item.source !== 'assumption' && (!kind || item.kind === kind));
const acceptedAssumptions = (order: OrderDraft) =>
  order.requirements.filter((item) => item.state === 'accepted' && item.source === 'assumption');
export const includedWork = (order: OrderDraft) => order.work.filter((item) => item.state === 'accepted');

/** 주문 내용을 한 덩어리 글로 (시작 프롬프트의 '할 일'과 레시피의 과제 예시에 쓴다) */
export function orderBrief(order: OrderDraft): string {
  const lines: string[] = [];
  const list = (label: string, items: Requirement[]) => {
    if (items.length === 0) return;
    lines.push(`${label}:`);
    for (const item of items) lines.push(`- ${item.text}`);
  };
  list('목표', accepted(order, 'goal'));
  list('최종 결과물', accepted(order, 'deliverable'));
  list('현재 상태', accepted(order, 'current'));
  list('반드시 지킬 조건', accepted(order, 'constraint'));
  list('하지 않을 것', accepted(order, 'exclusion'));
  list('성공 조건', accepted(order, 'success'));
  list('가정 (확인되지 않음)', acceptedAssumptions(order));
  const undecided = order.questions.filter((item) => item.state !== 'answered');
  const answered = order.questions.filter((item) => item.state === 'answered' && item.answer);
  if (answered.length > 0) {
    lines.push('정해진 것:');
    for (const item of answered) lines.push(`- ${item.text} → ${item.answer}`);
  }
  if (undecided.length > 0) {
    lines.push('아직 정하지 않은 것 (임의로 정하지 말고 필요하면 물어볼 것):');
    for (const item of undecided) lines.push(`- ${item.text}`);
  }
  const checkpoints = includedWork(order).filter((item) => item.checkpoint);
  if (checkpoints.length > 0) {
    lines.push('확인 지점 (끝나면 결과를 보여 주고 사용자 확인 뒤 다음으로):');
    for (const item of checkpoints) lines.push(`- ${item.title}`);
  }
  return lines.join('\n');
}

function workBlock(order: OrderDraft, item: WorkItem, index: number): string[] {
  const titleOf = (id: string) => order.work.find((work) => work.id === id)?.title ?? '(지워진 작업)';
  const outputName = (workId: string, outputId: string) =>
    order.work.find((work) => work.id === workId)?.outputs.find((output) => output.id === outputId)?.name;
  const incoming = order.deps.filter((dep) => dep.to === item.id);
  const lines = [`### 작업 ${index + 1} [${item.id}] ${item.title}`];
  if (item.description) lines.push(item.description);
  const inputs = [
    ...item.inputs,
    ...incoming.map((dep) => {
      const names = dep.outputIds.map((id) => outputName(dep.from, id)).filter(Boolean).join(', ');
      return `"${titleOf(dep.from)}"의 결과${names ? `(${names})` : ''}${dep.note ? ` — ${dep.note}` : ''}`;
    }),
  ];
  if (inputs.length > 0) lines.push(`- 받을 입력: ${inputs.join(' / ')}`);
  if (item.outputs.length > 0) lines.push(`- 내놓을 산출물: ${item.outputs.map((output) => output.name).join(', ')}`);
  if (item.criteria.length > 0) lines.push(`- 완료 기준: ${item.criteria.join(' / ')}`);
  if (item.overrides.length > 0) lines.push(`- 이 작업만의 조건: ${item.overrides.join(' / ')}`);
  if (item.checkpoint) lines.push('- 끝나면 결과를 사용자에게 보여 주고 확인을 받은 뒤 다음으로 넘어간다.');
  return lines;
}

const cardIdOf = (roleId: string) => `ord-${roleId}`;

/** 주문으로 레시피를 만든다. previous를 주면 그 id를 그대로 쓴다 (같은 레시피를 갱신). */
export function recipeFromOrder(order: OrderDraft, previous?: Recipe): Recipe {
  const work = includedWork(order);
  const workIds = new Set(work.map((item) => item.id));
  const assignments = order.assignments.filter((item) => workIds.has(item.workId));
  const ownerRole = (workId: string) => assignments.find((item) => item.workId === workId && item.responsibility === 'owner')?.roleId;
  const common = commonConditions(order);

  const cards: AgentCard[] = [];
  for (const role of order.roles) {
    const owns = work.filter((item) => ownerRole(item.id) === role.id);
    const reviews = work.filter((item) => assignments.some((entry) => entry.workId === item.id && entry.roleId === role.id && entry.responsibility === 'reviewer'));
    if (owns.length === 0 && reviews.length === 0) continue;
    const template = role.template ? templateCard(role.tag) : null;
    const base = template?.card.instructions?.trim() || `너는 ${role.displayName}이다.`;
    const lines = [base, '', '## 이 주문에서 맡은 작업'];
    if (owns.length > 1) lines.push('아래 작업을 적힌 순서대로 한다. 앞 작업의 결과를 다음 작업에 쓴다.');
    owns.forEach((item) => lines.push('', ...workBlock(order, item, work.indexOf(item))));
    if (reviews.length > 0) {
      lines.push('', '## 검토할 작업');
      for (const item of reviews) lines.push(`- [${item.id}] ${item.title}: 산출물(${item.outputs.map((output) => output.name).join(', ')})을 완료 기준에 비추어 검토하고, 고치지 말고 짚기만 한다.`);
    }
    if (common.length > 0) {
      lines.push('', '## 모든 작업에 적용되는 조건');
      for (const item of common) lines.push(`- ${item.text}`);
    }
    const deliverables: Deliverable[] = owns.flatMap((item) => item.outputs.map((output) => ({ id: output.id, name: output.name })));
    const criteria = [...new Set(owns.flatMap((item) => item.criteria))];
    const inputs = [...new Set(owns.flatMap((item) => item.inputs))];
    const card: AgentCard = {
      id: cardIdOf(role.id),
      name: role.name,
      displayName: role.displayName,
      role: owns.length > 0
        ? `${owns.map((item) => item.title).join(', ')}을(를) 맡을 때 사용.${reviews.length > 0 ? ` ${reviews.map((item) => item.title).join(', ')} 검토도 맡는다.` : ''}`
        : `${reviews.map((item) => item.title).join(', ')}을(를) 검토할 때 사용.`,
      instructions: lines.join('\n'),
      preferredEngine: role.engine,
      permission: role.permission,
      tags: [role.tag],
    };
    if (deliverables.length > 0) card.deliverables = deliverables;
    if (criteria.length > 0) card.completionCriteria = criteria;
    if (inputs.length > 0) card.requiredInputs = inputs;
    cards.push(card);
  }

  // 역할 사이의 전달만 흐름이 된다 (같은 역할 안의 순서는 지시문에 있다)
  const handoffs: Handoff[] = [];
  for (const dep of order.deps) {
    if (!workIds.has(dep.from) || !workIds.has(dep.to)) continue;
    const from = ownerRole(dep.from);
    const to = ownerRole(dep.to);
    if (!from || !to || from === to) continue;
    const existing = handoffs.find((item) => item.from === cardIdOf(from) && item.to === cardIdOf(to));
    const label = dep.note || `${order.work.find((item) => item.id === dep.from)?.title} → ${order.work.find((item) => item.id === dep.to)?.title}`;
    if (existing) {
      existing.deliverableIds = [...new Set([...(existing.deliverableIds ?? []), ...dep.outputIds])];
      continue;
    }
    handoffs.push({ id: `ord-${dep.id}`, from: cardIdOf(from), to: cardIdOf(to), label: label.slice(0, 200), deliverableIds: [...dep.outputIds] });
  }

  const goal = accepted(order, 'goal')[0]?.text ?? order.title;
  const deliverable = accepted(order, 'deliverable').map((item) => item.text).join(', ');
  const recipe: Recipe = {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: previous?.id ?? newId('recipe'),
    title: order.title || goal.slice(0, 40) || '주문에서 만든 레시피',
    summary: [goal, deliverable ? `결과물: ${deliverable}` : ''].filter(Boolean).join(' '),
    useCase: '주문에서 설계',
    cards,
    handoffs,
    settings: { maxThreads: Math.max(1, Math.min(6, cards.length)), maxDepth: 1 },
    sampleTask: orderBrief(order),
  };
  if (order.style !== 'subagents') recipe.collaboration = order.style;
  const success = accepted(order, 'success').map((item) => item.text);
  if (success.length > 0) recipe.successCriteria = success;
  const checkpoints = work.filter((item) => item.checkpoint).map((item) => item.title);
  if (checkpoints.length > 0) {
    recipe.howToRun = `확인 지점: ${checkpoints.join(', ')}이(가) 끝나면 결과를 확인하고 다음으로 넘기세요. 이 확인은 프롬프트로 전하는 안내이고, 도구가 강제로 멈추는 것은 아니에요.`;
  }
  return recipe;
}

/** 레시피 내용의 지문. 손으로 고쳤는지 볼 때 쓴다. */
export function fingerprint(recipe: Recipe): string {
  const text = JSON.stringify({
    title: recipe.title,
    summary: recipe.summary,
    cards: recipe.cards,
    handoffs: recipe.handoffs,
    sampleTask: recipe.sampleTask,
    successCriteria: recipe.successCriteria,
    collaboration: recipe.collaboration,
  });
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `${text.length}-${(hash >>> 0).toString(36)}`;
}

/**
 * 주문과 만들어 둔 레시피의 관계.
 * - none: 아직 만들지 않음 / missing: 만든 레시피를 지웠음
 * - same: 주문도 레시피도 그대로
 * - order-changed: 레시피를 만든 뒤 주문을 고쳤음 (갱신하면 됨)
 * - recipe-edited: 레시피를 만든 뒤 레시피를 손으로 고쳤음 (덮어쓸지, 따로 만들지 골라야 함)
 */
export type LinkState = 'none' | 'missing' | 'same' | 'order-changed' | 'recipe-edited';

export function linkState(order: OrderDraft, recipes: Recipe[]): LinkState {
  if (!order.link) return 'none';
  const recipe = recipes.find((item) => item.id === order.link!.recipeId);
  if (!recipe) return 'missing';
  if (fingerprint(recipe) !== order.link.fingerprint) return 'recipe-edited';
  const fresh = recipeFromOrder(order, recipe);
  return fingerprint(fresh) === order.link.fingerprint ? 'same' : 'order-changed';
}

export type GenerateMode = 'auto' | 'overwrite' | 'separate';

/**
 * 레시피를 만들거나 갱신한다.
 * - auto: 처음이면 새로, 이미 있고 손대지 않았으면 같은 id로 갱신. 손으로 고쳤으면 아무것도 하지 않는다(null).
 * - overwrite: 손으로 고친 레시피를 주문 내용으로 덮어쓴다 (사용자가 명시적으로 고른 경우만).
 * - separate: 기존 레시피는 두고 새 레시피를 만든다.
 */
export function generateRecipe(order: OrderDraft, recipes: Recipe[], mode: GenerateMode = 'auto'): { recipe: Recipe; order: OrderDraft } | null {
  const state = linkState(order, recipes);
  if (state === 'recipe-edited' && mode === 'auto') return null;
  const previous = mode === 'separate' ? undefined : recipes.find((item) => item.id === order.link?.recipeId);
  const recipe = recipeFromOrder(order, previous);
  return {
    recipe,
    order: { ...order, status: 'ready', link: { recipeId: recipe.id, orderRevision: order.revision, fingerprint: fingerprint(recipe) } },
  };
}

// ───────────────────────── 실행 준비 점검 ─────────────────────────

export interface OrderIssue {
  level: 'error' | 'warn';
  code: string;
  message: string;
  step: 'define' | 'work' | 'team' | 'ready';
}

/** 실행 준비 점검. 막는 것(error)과 알리고 넘어가는 것(warn)을 나눈다. 1차 점검의 막는 항목도 합친다. */
export function checkOrder(order: OrderDraft, providers: ProviderData): OrderIssue[] {
  const issues: OrderIssue[] = [];
  const error = (code: string, message: string, step: OrderIssue['step']) => issues.push({ level: 'error', code, message, step });
  const warn = (code: string, message: string, step: OrderIssue['step']) => issues.push({ level: 'warn', code, message, step });

  if (accepted(order, 'goal').length === 0) error('NO_GOAL', '확정한 목표가 없어요.', 'define');
  if (accepted(order, 'deliverable').length === 0) error('NO_DELIVERABLE', '확정한 최종 결과물이 없어요.', 'define');
  if (accepted(order, 'success').length === 0) error('NO_SUCCESS', '확정한 성공 조건이 없어요.', 'define');
  const mustOpen = order.questions.filter((item) => item.mustDecide && item.state !== 'answered');
  if (mustOpen.length > 0) error('MUST_DECIDE', `꼭 정하기로 한 질문이 남았어요: ${mustOpen.map((item) => item.text).join(', ')}`, 'define');

  const work = includedWork(order);
  if (work.length === 0) error('NO_WORK', '확정한 작업이 없어요.', 'work');
  for (const item of work.filter((entry) => entry.required)) {
    if (item.outputs.length === 0) error('WORK_NO_OUTPUT', `"${item.title}"에 내놓을 산출물이 없어요.`, 'work');
    if (item.criteria.length === 0) error('WORK_NO_CRITERIA', `"${item.title}"에 완료 기준이 없어요.`, 'work');
    if (!order.assignments.some((entry) => entry.workId === item.id && entry.responsibility === 'owner' && order.roles.some((role) => role.id === entry.roleId))) {
      error('UNASSIGNED', `"${item.title}"을(를) 맡은 역할이 없어요.`, 'team');
    }
  }
  for (const problem of brokenRefs(order)) error('BROKEN_REF', problem.message, 'work');

  // 1차 점검의 막는 항목 (파일이 깨지는 경우)을 그대로 합친다
  if (work.length > 0) {
    for (const issue of checkRecipe(recipeFromOrder(order), providers)) {
      if (issue.level === 'error' && issue.code !== 'NO_CARDS') error(`RECIPE_${issue.code}`, issue.message, 'team');
    }
  }

  const proposedReq = order.requirements.filter((item) => item.state === 'proposed').length;
  const proposedWork = order.work.filter((item) => item.state === 'proposed').length;
  if (proposedReq + proposedWork > 0) {
    warn('PROPOSALS_LEFT', `확정하지 않은 제안 ${proposedReq + proposedWork}개(요구 ${proposedReq}, 작업 ${proposedWork})는 레시피에 들어가지 않아요.`, 'define');
  }
  const openQuestions = order.questions.filter((item) => !item.mustDecide && item.state !== 'answered');
  if (openQuestions.length > 0) warn('QUESTIONS_OPEN', `정하지 않은 질문 ${openQuestions.length}개는 "아직 정하지 않은 것"으로 프롬프트에 적혀요.`, 'define');
  if (order.requirements.some((item) => item.source === 'assumption' && item.state === 'proposed')) {
    warn('ASSUMPTIONS', '확정하지 않은 가정은 빠져요.', 'define');
  }
  const stale = staleEvidence(order);
  if (stale.length > 0) warn('STALE_EVIDENCE', `근거를 다시 확인할 요구가 ${stale.length}개 있어요.`, 'define');
  if (requestChanged(order)) warn('REQUEST_CHANGED', '정리한 뒤 원문이 바뀌었어요. 주문 정리에서 다시 확인해 보세요.', 'define');
  if (work.some((item) => item.checkpoint)) warn('CHECKPOINT', '확인 지점은 프롬프트로 전하는 안내예요. 도구가 강제로 멈추지 않아요.', 'ready');
  warn('INSTALL_UNKNOWN', '도구 설치·로그인 상태는 확인하지 않았어요.', 'ready');
  return issues;
}

/** 외부 도구에 실제로 넣을 시작 프롬프트 (주문 내용이 '할 일' 자리에 들어간다) */
export function orderPrompt(order: OrderDraft, recipe: Recipe): string {
  return runPrompt(recipe).replace('할 일: (여기에 요청을 적으세요)', `할 일:\n${orderBrief(order)}`).replace('(여기에 요청을 적으세요)', orderBrief(order));
}

// ───────────────────────── 기존 레시피에서 주문 시작 ─────────────────────────

/** 레시피의 역할·작업·조건을 초안으로 가져온 새 주문 (원본 레시피는 그대로) */
export function orderFromRecipe(recipe: Recipe, base: OrderDraft): OrderDraft {
  const roles = recipe.cards.map((card) => ({
    id: newId('role'),
    name: card.name,
    displayName: card.displayName || card.name,
    tag: ((card.tags ?? [])[0] ?? 'implementer') as OrderDraft['roles'][number]['tag'],
    engine: card.preferredEngine,
    permission: card.permission,
  }));
  const work: WorkItem[] = recipe.cards.map((card) => ({
    id: newId('work'),
    title: card.displayName || card.name,
    description: card.role,
    inputs: [...(card.requiredInputs ?? [])],
    outputs: (card.deliverables ?? []).map((item) => ({ id: newId('out'), name: item.name })),
    criteria: [...(card.completionCriteria ?? [])],
    overrides: [],
    checkpoint: false,
    required: true,
    origin: 'rule',
    state: 'proposed',
    type: roles[recipe.cards.indexOf(card)].tag,
  }));
  const workOfCard = new Map(recipe.cards.map((card, index) => [card.id, work[index]]));
  const deps = recipe.handoffs.flatMap((handoff) => {
    const from = workOfCard.get(handoff.from);
    const to = workOfCard.get(handoff.to);
    if (!from || !to) return [];
    return [{ id: newId('dep'), from: from.id, to: to.id, outputIds: from.outputs.map((output) => output.id), note: handoff.label ?? '' }];
  });
  const requirements: Requirement[] = [
    ...(recipe.learningObjective ? [{ id: newId('req'), kind: 'goal' as const, text: recipe.learningObjective, source: 'rule' as const, state: 'proposed' as const }] : []),
    ...(recipe.successCriteria ?? []).map((text) => ({ id: newId('req'), kind: 'success' as const, text, source: 'rule' as const, state: 'proposed' as const })),
  ];
  return {
    ...base,
    status: 'designing',
    step: 'define',
    title: `${recipe.title}로 하는 작업`,
    sourceRecipeId: recipe.id,
    roles,
    work,
    deps,
    assignments: work.map((item, index) => ({ workId: item.id, roleId: roles[index].id, responsibility: 'owner' as const })),
    requirements,
    style: recipe.collaboration ?? 'subagents',
    request: { ...base.request, textAtDraft: base.request.text },
  };
}
