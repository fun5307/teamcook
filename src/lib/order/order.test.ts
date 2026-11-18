// 주문서 개선 검사 (지시서 작업 7의 필수 사례 1~10을 로직 수준에서)

import { describe, expect, it } from 'vitest';
import { providerData } from '../../data/providers';
import { builtinRecipes } from '../../data/recipes';
import { buildExportBundle, zipBundle } from '../exportZip';
import { compareConditions } from '../practice/compare';
import { createRun, createTask, EMPTY_INPUT } from '../practice/model';
import { comparisonMarkdown } from '../practice/report';
import { parseRun } from '../practice/schema';
import { buildDemoData } from '../practice/demo';
import { encodeRecipe } from '../share';
import type { UserPlans } from '../../types';
import { canStart, draftFromRequest, newOrder, startDesign } from './draft';
import { fileMaterial, linkMaterial, textMaterial } from './materials';
import {
  applyScope,
  blankWork,
  brokenRefs,
  mergeImpact,
  mergeWork,
  outputRemovalImpact,
  overrideConflicts,
  redraftAdditions,
  removeOutput,
  removeWork,
  requestChanged,
  scopePreview,
  splitWork,
  staleEvidence,
  workRemovalImpact,
} from './ops';
import { exportOrder, importOrder, loadOrders, ORDER_STORAGE_KEY, parseOrder, saveOrders } from './schema';
import { orderSnapshot } from './snapshot';
import { coverage, proposeTeam } from './team';
import { checkOrder, fingerprint, generateRecipe, linkState, orderFromRecipe, orderPrompt, recipeFromOrder } from './toRecipe';
import type { OrderDraft } from './types';

const PLANS: UserPlans = { openai: 'plus', anthropic: 'pro', google: 'none', xai: 'none', apiKeys: {} };
const SHORT = '로그인 후 30분쯤 지나면 세션이 끊기는 문제를 수정하고 테스트해 줘.';
const LONG = [
  '사내 문서 검색에 GraphRAG를 써 볼지 조사하고, 해볼 만하면 MVP를 설계하고 구현까지 하고 싶어.',
  '현재는 Notion과 구글 드라이브에 문서가 흩어져 있어.',
  '외부 API 비용은 반드시 월 10만 원 이내여야 해.',
  '권한 관리는 이번 범위에서 제외.',
].join('\n');

/** 제안을 모두 확정하고, 팀 제안을 받아 쓴 주문 */
function designed(text: string, materials = [] as OrderDraft['request']['materials']): OrderDraft {
  let order = startDesign(newOrder(text, materials));
  order = {
    ...order,
    requirements: order.requirements.map((item) => ({ ...item, state: 'accepted' })),
    work: order.work.map((item) => ({ ...item, state: 'accepted' })),
  };
  const team = proposeTeam(order, PLANS);
  return { ...order, roles: team.roles, assignments: team.assignments, style: team.style };
}

describe('1. 짧은 요청과 긴 복합 요청 모두 설계·내보내기까지', () => {
  it('짧은 로그인 문제: 재현·수정·검토 작업과 역할이 제안되고, 확정하면 ZIP까지 만들어진다', async () => {
    const order = designed(SHORT);
    expect(order.detected).toContain('fix');
    expect(order.work.map((item) => item.title)).toEqual(['재현과 원인 찾기', '수정과 테스트', '검토']);
    expect(checkOrder(order, providerData).filter((item) => item.level === 'error')).toEqual([]);
    const recipe = recipeFromOrder(order);
    const bundle = buildExportBundle(recipe, providerData);
    expect(bundle.blocked).toBe(false);
    expect((await zipBundle(bundle)).length).toBeGreaterThan(100);
    expect(orderPrompt(order, recipe)).toContain('세션이 끊기는 문제');
  });

  it('긴 조사+MVP 요청: 목표·현재 상태·조건·제외가 원문 근거와 함께 나뉘고, 조사→설계→구현→검토 작업이 생긴다', () => {
    const draft = draftFromRequest(LONG, []);
    const kinds = (kind: string) => draft.requirements.filter((item) => item.kind === kind).map((item) => item.text);
    expect(kinds('goal')[0]).toContain('GraphRAG');
    expect(kinds('current')[0]).toContain('Notion');
    expect(kinds('constraint')[0]).toContain('10만 원');
    expect(kinds('exclusion')[0]).toContain('권한 관리');
    expect(draft.requirements.filter((item) => item.source === 'explicit').every((item) => item.evidence?.sourceId === 'request')).toBe(true);
    expect(draft.work.map((item) => item.title)).toEqual(['자료 조사', '요구사항 정리와 설계', '구현', '검토']);
    expect(draft.work.find((item) => item.title === '요구사항 정리와 설계')!.checkpoint).toBe(true);
    // 모든 자동 결과는 제안으로 시작한다
    expect(draft.requirements.every((item) => item.state === 'proposed')).toBe(true);
    expect(draft.work.every((item) => item.state === 'proposed')).toBe(true);
    expect(draft.questions.length).toBeGreaterThan(0);
  });

  it('긴 요청도 확정하면 막힘 없이 내보낼 수 있고, 공통 조건이 모든 역할 지시문에 들어간다', () => {
    const order = designed(LONG);
    expect(checkOrder(order, providerData).filter((item) => item.level === 'error')).toEqual([]);
    const recipe = recipeFromOrder(order);
    expect(recipe.cards.every((card) => card.instructions.includes('10만 원'))).toBe(true);
    expect(recipe.sampleTask).toContain('하지 않을 것');
    expect(buildExportBundle(recipe, providerData).blocked).toBe(false);
  });
});

describe('2. 분류할 수 없는 요청', () => {
  it('원문을 보존하고 작업 없이 시작하며, 직접 작업을 더해 설계할 수 있다', () => {
    const order = startDesign(newOrder('음... 그 건 말이야, 어떻게 좀 해 봐'));
    expect(order.detected).toEqual([]);
    expect(order.work).toEqual([]);
    expect(order.request.text).toBe('음... 그 건 말이야, 어떻게 좀 해 봐');
    expect(order.requirements.find((item) => item.kind === 'goal')?.text).toContain('어떻게 좀');
    const withWork = { ...order, work: [{ ...blankWork('직접 만든 작업'), outputs: [{ id: 'o1', name: '결과' }], criteria: ['끝남'] }] };
    expect(withWork.work[0].state).toBe('accepted');
  });

  it('요청이나 읽은 자료가 있어야 시작하고, 링크만 있으면 내용을 적으라고 안내한다', () => {
    expect(canStart('', []).ok).toBe(false);
    const link = linkMaterial('https://example.com/doc');
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.material.status).toBe('reference');
    expect(canStart('', [link.material]).message).toContain('주소만 저장');
    expect(canStart('', [textMaterial('메모', '조사해 줘')]).ok).toBe(true);
    expect(linkMaterial('javascript:alert(1)').ok).toBe(false);
  });

  it('지원하지 않는 형식·너무 큰 파일·UTF-8이 아닌 파일은 읽음으로 표시하지 않는다', async () => {
    const file = (name: string, bytes: Uint8Array) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.buffer as ArrayBuffer });
    expect((await fileMaterial(file('a.pdf', new Uint8Array([1])))).status).toBe('failed');
    expect((await fileMaterial(file('a.txt', new Uint8Array(1024 * 1024 + 1).fill(65)))).status).toBe('failed');
    expect((await fileMaterial(file('a.txt', new Uint8Array([0xff, 0xfe, 0x00])))).status).toBe('failed');
    const ok = await fileMaterial(file('메모.md', new TextEncoder().encode('반드시 오늘까지')));
    expect(ok).toMatchObject({ status: 'read', content: '반드시 오늘까지' });
  });
});

describe('3. 원문 수정·자료 삭제·합치기/나누기·산출물 삭제의 참조 안내', () => {
  it('원문을 고쳐도 정리 내용은 그대로이고, 바뀐 사실과 새 항목을 따로 보여 준다', () => {
    const order = startDesign(newOrder(SHORT));
    const edited = { ...order, request: { ...order.request, text: `${SHORT}\n결제 모듈은 제외.` } };
    expect(requestChanged(edited)).toBe(true);
    expect(edited.requirements).toEqual(order.requirements);
    const added = redraftAdditions(edited);
    expect(added.map((item) => item.text)).toEqual(['결제 모듈은 제외.']);
  });

  it('원문에서 문장을 지우거나 자료를 빼도 요구를 지우지 않고 "근거가 사라짐"으로 표시한다', () => {
    const memo = textMaterial('기획 메모', '반드시 모바일에서도 동작해야 한다.');
    const order = startDesign(newOrder(SHORT, [memo]));
    const fromMemo = order.requirements.find((item) => item.evidence?.sourceId === memo.id)!;
    expect(fromMemo.text).toContain('모바일');
    const removed = { ...order, request: { ...order.request, materials: [] } };
    expect(removed.requirements).toContainEqual(fromMemo);
    expect(staleEvidence(removed).find((item) => item.id === fromMemo.id)?.reason).toContain('삭제');
    const rewritten = { ...order, request: { ...order.request, text: '완전히 다른 요청' } };
    expect(staleEvidence(rewritten).some((item) => item.reason.includes('원문'))).toBe(true);
  });

  it('작업을 지우면 끊길 전달과 배정을 먼저 보여 주고, 지운 뒤 끊긴 참조가 남지 않는다', () => {
    const order = designed(SHORT);
    const middle = order.work[1];
    const impact = workRemovalImpact(order, middle.id);
    expect(impact.deps.length).toBe(2);
    expect(impact.assignments).toBeGreaterThan(0);
    const next = removeWork(order, middle.id);
    expect(brokenRefs(next)).toEqual([]);
  });

  it('산출물을 지우면 그 산출물을 받던 작업을 보여 주고, 전달에서 빠진다', () => {
    const order = designed(SHORT);
    const first = order.work[0];
    const out = first.outputs[0];
    expect(outputRemovalImpact(order, first.id, out.id).map((dep) => dep.to)).toEqual([order.work[1].id]);
    const next = removeOutput(order, first.id, out.id);
    expect(next.deps.find((dep) => dep.from === first.id)!.outputIds).not.toContain(out.id);
    expect(brokenRefs(next)).toEqual([]);
  });

  it('합치기: 다른 작업과의 전달은 합친 작업으로 옮겨지고, 둘 사이의 전달은 없어진다', () => {
    const order = designed(SHORT);
    const [a, b, c] = order.work;
    const impact = mergeImpact(order, a.id, b.id);
    expect(impact.dropped.map((dep) => [dep.from, dep.to])).toEqual([[a.id, b.id]]);
    expect(impact.redirected.map((dep) => dep.to)).toEqual([c.id]);
    const next = mergeWork(order, a.id, b.id);
    expect(next.work).toHaveLength(2);
    expect(next.deps.map((dep) => [dep.from, dep.to])).toEqual([[a.id, c.id]]);
    expect(next.work[0].outputs).toHaveLength(a.outputs.length + b.outputs.length);
    expect(brokenRefs(next)).toEqual([]);
  });

  it('나누기: 옮긴 산출물을 받던 전달은 새 작업에서 나가고, 원래 작업 → 새 작업 전달이 생긴다. 이름이 바뀌어도 id는 그대로다', () => {
    const order = designed(SHORT);
    const [first, second] = order.work;
    const moved = first.outputs[1];
    const { order: next, newId } = splitWork(order, first.id, '원인 분석 정리', [moved.id]);
    expect(next.work.map((item) => item.id).slice(0, 2)).toEqual([first.id, newId]);
    expect(next.deps.some((dep) => dep.from === newId && dep.to === second.id && dep.outputIds.includes(moved.id))).toBe(true);
    expect(next.deps.some((dep) => dep.from === first.id && dep.to === newId)).toBe(true);
    expect(brokenRefs(next)).toEqual([]);
    const renamed = { ...next, work: next.work.map((item) => (item.id === first.id ? { ...item, title: '새 이름' } : item)) };
    expect(brokenRefs(renamed)).toEqual([]);
  });
});

describe('4. 막는 것과 넘어가는 것', () => {
  it('확정하지 않은 제안은 레시피에 들어가지 않고 경고로만 남는다. 목표·결과물·성공 조건이 없으면 막는다', () => {
    const raw = startDesign(newOrder(SHORT));
    const codes = checkOrder(raw, providerData);
    expect(codes.filter((item) => item.level === 'error').map((item) => item.code)).toEqual(expect.arrayContaining(['NO_GOAL', 'NO_DELIVERABLE', 'NO_SUCCESS', 'NO_WORK']));
    expect(codes.some((item) => item.code === 'PROPOSALS_LEFT')).toBe(true);
    const recipe = recipeFromOrder({ ...raw, requirements: raw.requirements.map((item) => (item.kind === 'goal' ? { ...item, state: 'accepted' } : item)) });
    expect(recipe.cards).toEqual([]);
    expect(recipe.successCriteria).toBeUndefined();
  });

  it('꼭 정하기로 한 질문이 남으면 막고, 일반 미정은 프롬프트에 "아직 정하지 않은 것"으로 넘긴다', () => {
    const order = designed(SHORT);
    const must = { ...order, questions: order.questions.map((item, index) => (index === 0 ? { ...item, mustDecide: true } : item)) };
    expect(checkOrder(must, providerData).some((item) => item.code === 'MUST_DECIDE')).toBe(true);
    expect(checkOrder(order, providerData).some((item) => item.level === 'error')).toBe(false);
    expect(recipeFromOrder(order).sampleTask).toContain('아직 정하지 않은 것');
  });

  it('필수 작업의 담당·산출물·완료 기준이 없으면 막고, 확인 지점은 경고로만 알린다', () => {
    const order = designed(LONG);
    const noOwner = { ...order, assignments: order.assignments.filter((item) => item.workId !== order.work[0].id) };
    expect(checkOrder(noOwner, providerData).some((item) => item.code === 'UNASSIGNED')).toBe(true);
    const noOutput = { ...order, work: order.work.map((item, index) => (index === 0 ? { ...item, outputs: [] } : item)) };
    expect(checkOrder(noOutput, providerData).some((item) => item.code === 'WORK_NO_OUTPUT')).toBe(true);
    const warns = checkOrder(order, providerData).filter((item) => item.level === 'warn').map((item) => item.code);
    expect(warns).toContain('CHECKPOINT');
    expect(warns).toContain('INSTALL_UNKNOWN');
  });

  it('가정은 확정했을 때만 "가정"으로 들어간다', () => {
    const order = designed(SHORT);
    const assumed = { ...order, requirements: [...order.requirements, { id: 'as1', kind: 'constraint' as const, text: '테스트 도구는 이미 있다', source: 'assumption' as const, state: 'proposed' as const }] };
    expect(recipeFromOrder(assumed).sampleTask).not.toContain('테스트 도구는 이미 있다');
    const accepted = { ...assumed, requirements: assumed.requirements.map((item) => (item.id === 'as1' ? { ...item, state: 'accepted' as const } : item)) };
    expect(recipeFromOrder(accepted).sampleTask).toMatch(/가정 \(확인되지 않음\):\n- 테스트 도구는 이미 있다/);
  });
});

describe('5. 공통 조건·개별 예외·범위 전환', () => {
  it('공통 제외 범위와 겹치는 개별 조건을 알려 준다', () => {
    const order = designed(LONG);
    const work = { ...order.work[2], overrides: ['권한 관리 화면도 함께 만든다'] };
    expect(overrideConflicts(order, work)[0]).toContain('권한');
    expect(overrideConflicts(order, { ...work, overrides: ['화면은 한 장만'] })).toEqual([]);
  });

  it('빠른 탐색은 규칙이 넣은 검토만 줄이고, 확정한 검토와 사용자의 검토 요구는 남긴다', () => {
    const fresh = startDesign(newOrder(SHORT));
    const preview = scopePreview(fresh, 'quick');
    expect(preview.remove.map((item) => item.title)).toEqual(['검토']);
    const demanded = { ...fresh, requirements: [...fresh.requirements, { id: 'r', kind: 'constraint' as const, text: '반드시 코드 리뷰를 받는다', source: 'user' as const, state: 'accepted' as const }] };
    expect(scopePreview(demanded, 'quick').remove).toEqual([]);
    const accepted = designed(SHORT);
    expect(scopePreview(accepted, 'quick').remove).toEqual([]);
    const applied = applyScope(accepted, 'quick', scopePreview(accepted, 'quick'));
    expect(applied.work.filter((item) => item.type === 'researcher').every((item) => item.overrides.includes('핵심 1~2가지만 확인한다'))).toBe(true);
    expect(applied.requirements).toEqual(accepted.requirements);
  });

  it('근거 확인·여러 안 비교는 작업을 제안으로 더하고 전달을 잇는다', () => {
    const order = designed(LONG);
    const evidence = applyScope(order, 'evidence', scopePreview(order, 'evidence'));
    expect(evidence.work.at(-1)).toMatchObject({ title: '근거 검토', state: 'proposed' });
    const alts = applyScope(order, 'alternatives', scopePreview(order, 'alternatives'));
    const titles = alts.work.map((item) => item.title);
    expect(titles.slice(-3)).toEqual(['대안 A 만들기', '대안 B 만들기', '대안 비교']);
    expect(brokenRefs(alts)).toEqual([]);
  });
});

describe('6. 역할과 작업은 따로 (같은 역할 안의 전달·혼합 도구·토론형)', () => {
  it('작업이 역할보다 많아도 되고, 같은 역할의 작업은 한 카드의 지시문에 작업 ID별로 나뉜다', () => {
    const order = designed(LONG);
    const writerish = order.roles.find((role) => role.tag === 'implementer')!;
    // 설계와 구현을 같은 역할에게 맡긴다
    const design = order.work.find((item) => item.title === '요구사항 정리와 설계')!;
    const same = { ...order, assignments: order.assignments.map((item) => (item.workId === design.id && item.responsibility === 'owner' ? { ...item, roleId: writerish.id } : item)) };
    const recipe = recipeFromOrder(same);
    const card = recipe.cards.find((item) => item.name === writerish.name)!;
    expect(card.instructions).toContain(`[${design.id}]`);
    expect(card.instructions).toContain('적힌 순서대로');
    expect(recipe.cards.length).toBeLessThan(same.work.length);
    // 같은 역할 안의 전달은 흐름(handoffs)에 들어가지 않는다
    expect(recipe.handoffs.some((item) => item.from === item.to)).toBe(false);
    expect(coverage(same).unassigned).toEqual([]);
  });

  it('작업이 하나면 역할 하나를 제안하고, 둘 다 쓰면 검토는 다른 회사 도구가 맡는다', () => {
    const one = startDesign(newOrder('README 오타를 고쳐 줘'));
    const single = { ...one, work: [one.work[0]] };
    expect(proposeTeam(single, PLANS).roles).toHaveLength(1);
    const team = proposeTeam(designed(SHORT), PLANS);
    expect(team.roles.find((role) => role.tag === 'reviewer')!.engine).toBe('codex-cli');
    expect(team.roles.find((role) => role.tag === 'implementer')!.engine).toBe('claude-code');
    expect(team.recommendation.reasons.join(' ')).toContain('설치·로그인');
  });

  it('결정만 있는 요청은 토론형을 제안하고, 토론형 레시피는 프롬프트로 내보내진다', () => {
    const order = designed('두 설계안 중에 어느 쪽을 고를지 결정하고 싶어');
    expect(order.style).toBe('debate');
    const bundle = buildExportBundle(recipeFromOrder(order), providerData);
    expect(bundle.blocked).toBe(false);
    expect(bundle.files.some((file) => file.path === 'debate-prompt.txt')).toBe(true);
  });
});

describe('7. 반복 변환·수동 수정 충돌·JSON·이관', () => {
  it('같은 주문을 다시 변환하면 같은 레시피를 갱신하고, 손으로 고친 레시피는 묻기 전에 덮어쓰지 않는다', () => {
    const order = designed(SHORT);
    const first = generateRecipe(order, [])!;
    const again = generateRecipe(first.order, [first.recipe])!;
    expect(again.recipe.id).toBe(first.recipe.id);
    expect(linkState(first.order, [first.recipe])).toBe('same');
    const edited = { ...first.recipe, title: '손으로 고친 제목' };
    expect(linkState(first.order, [edited])).toBe('recipe-edited');
    expect(generateRecipe(first.order, [edited], 'auto')).toBeNull();
    const separate = generateRecipe(first.order, [edited], 'separate')!;
    expect(separate.recipe.id).not.toBe(first.recipe.id);
    const overwrite = generateRecipe(first.order, [edited], 'overwrite')!;
    expect(overwrite.recipe.id).toBe(first.recipe.id);
    expect(overwrite.recipe.title).not.toBe('손으로 고친 제목');
    const changed = { ...first.order, title: '바뀐 주문' };
    expect(linkState(changed, [first.recipe])).toBe('order-changed');
  });

  it('기존 레시피에서 주문을 시작해도 원본 레시피는 그대로다', () => {
    const recipe = builtinRecipes.find((item) => item.id === 'builtin-cross-review')!;
    const before = fingerprint(recipe);
    const order = orderFromRecipe(recipe, newOrder());
    expect(order.roles.map((role) => role.name)).toEqual(recipe.cards.map((card) => card.name));
    expect(order.work).toHaveLength(recipe.cards.length);
    expect(order.sourceRecipeId).toBe(recipe.id);
    expect(fingerprint(recipe)).toBe(before);
  });

  it('저장했다 다시 읽어도 원문·id·참조가 같고, 여러 번 읽고 써도 중복이 없다', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
    const order = designed(LONG);
    expect(saveOrders({ version: 1, orders: [order], unreadable: [] }, storage).ok).toBe(true);
    for (let index = 0; index < 3; index += 1) saveOrders(loadOrders(storage), storage);
    const loaded = loadOrders(storage);
    expect(loaded.orders).toHaveLength(1);
    expect(loaded.orders[0]).toEqual(JSON.parse(JSON.stringify(order)));
    expect(brokenRefs(loaded.orders[0])).toEqual([]);
    map.set(ORDER_STORAGE_KEY, '{깨짐');
    expect(loadOrders(storage).unreadable).toEqual(['{깨짐']);
  });

  it('저장 공간이 모자라면 실패를 돌려주고 이전 내용을 둔다', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { if (value.length > 2000) throw new Error('quota'); map.set(key, value); } };
    saveOrders({ version: 1, orders: [], unreadable: [] }, storage);
    const before = map.get(ORDER_STORAGE_KEY);
    expect(saveOrders({ version: 1, orders: [designed(LONG)], unreadable: [] }, storage).ok).toBe(false);
    expect(map.get(ORDER_STORAGE_KEY)).toBe(before);
  });

  it('JSON 왕복: 자료 본문은 기본으로 빠지고, id가 겹치면 새 id로 가져오며 안쪽 참조는 유지된다', () => {
    const memo = textMaterial('메모', '반드시 오늘까지');
    const order = designed(SHORT, [memo]);
    const plain = JSON.parse(exportOrder(order, { materialContent: false }));
    expect(plain.order.request.materials[0].content).toBeUndefined();
    expect(plain.omitted).toEqual(['자료 본문']);
    const full = exportOrder(order, { materialContent: true });
    expect(JSON.parse(full).order.request.materials[0].content).toBe('반드시 오늘까지');
    const imported = importOrder(full, [order]);
    expect(imported.id).not.toBe(order.id);
    expect(imported.work.map((item) => item.id)).toEqual(order.work.map((item) => item.id));
    expect(brokenRefs(imported)).toEqual([]);
    expect(imported.link).toBeUndefined();
    expect(() => importOrder('{"format":"teamcook-order","version":9}', [])).toThrow('지원하지 않는');
    expect(() => importOrder('nope', [])).toThrow('JSON');
    // 링크 자료를 '읽음'으로 위조해도 주소만으로 낮춘다
    const forged = JSON.parse(full);
    forged.order.request.materials = [{ id: 'x', name: 'l', kind: 'link', status: 'read', content: '가짜 본문', url: 'https://a.b' }];
    expect(importOrder(JSON.stringify(forged), []).request.materials[0]).toMatchObject({ status: 'reference' });
    expect(importOrder(JSON.stringify(forged), []).request.materials[0].content).toBeUndefined();
  });

  it('더 새로운 형식은 거절한다', () => {
    expect(() => parseOrder({ schemaVersion: 2, id: 'x' })).toThrow();
  });

  it('레시피 공유 링크에는 요청 원문과 자료 본문이 들어가지 않는다', () => {
    const memo = textMaterial('비밀 메모', '사내 비밀 자료 본문');
    const order = designed(`${SHORT}\n원문에만 있는 비밀 문장은 정리하지 않는다고 치자.`, [memo]);
    const recipe = recipeFromOrder({ ...order, requirements: order.requirements.filter((item) => !item.text.includes('비밀')) });
    const shared = JSON.stringify(recipe);
    expect(shared).not.toContain('사내 비밀 자료 본문');
    expect(shared).not.toContain('원문에만 있는 비밀 문장');
    expect(encodeRecipe(recipe).length).toBeGreaterThan(0);
  });
});

describe('8. 주문·레시피를 고쳐도 과거 기록은 그대로, 비교는 조건 차이를 보인다', () => {
  it('기록은 주문을 복사해 두고, 주문을 고쳐도 기록과 보고서는 바뀌지 않는다', () => {
    const order = designed(LONG);
    const recipe = recipeFromOrder(order);
    const task = createTask({ title: '', input: orderPrompt(order, recipe), materials: '자료 없음', successCriteria: recipe.successCriteria, order: orderSnapshot(order) });
    const run = createRun({ recipe, task, input: { ...EMPTY_INPUT, tool: 'Claude Code', model: 'm' } });
    expect(run.order!.revision).toBe(order.revision);
    expect(run.result.workResults).toHaveLength(order.work.length);
    expect(run.result.checks.length).toBeGreaterThan(0);
    // 주문을 고친다
    order.work[0].title = '바뀐 작업';
    expect(run.order!.work[0].title).not.toBe('바뀐 작업');
    // 기록을 만든 것만으로 성공 표시가 없다
    expect(run.result.workResults!.every((item) => item.state === 'unknown')).toBe(true);
    // 저장했다 읽어도 주문 복사본이 남는다 (원문과 실제 입력이 구분된다)
    const loaded = parseRun(JSON.parse(JSON.stringify(run)));
    expect(loaded.order!.requestText).toBe(LONG);
    expect(loaded.input.text).not.toBe(LONG);
  });

  it('같은 주문 id라도 수정해서 범위가 다르면 동일 조건이 아니고, 주문 없는 기록과 섞이면 경고한다', () => {
    const order = designed(SHORT);
    const recipe = recipeFromOrder(order);
    const input = { ...EMPTY_INPUT, tool: 'Claude Code', model: 'm', toolVersion: 'v', environment: 'e' };
    const mk = (snapshot: ReturnType<typeof orderSnapshot>) =>
      createRun({ recipe, input, task: createTask({ title: '', input: 'same', materials: '없음', order: snapshot }) });
    const a = mk(orderSnapshot(order));
    const sameTwin = mk(orderSnapshot(order));
    expect(compareConditions([a, sameTwin]).rows.find((row) => row.key === 'order')!.state).toBe('same');
    const narrowed = { ...order, revision: order.revision + 1, work: order.work.slice(0, 2) };
    const b = mk(orderSnapshot(narrowed));
    const report = compareConditions([a, b]);
    expect(report.problems.map((row) => row.key)).toContain('order');
    const withoutOrder = { ...b, order: undefined };
    expect(compareConditions([a, withoutOrder]).problems.map((row) => row.key)).toContain('order');
  });

  it('보고서에 주문의 목표·작업·미정과 작업별 결과가 들어가고, 주문 없는 옛 기록 보고서는 그대로다', () => {
    const order = designed(LONG);
    const recipe = recipeFromOrder(order);
    const task = createTask({ title: '', input: 'x', materials: 'y', order: orderSnapshot(order) });
    const run = createRun({ recipe, task, input: EMPTY_INPUT });
    run.result.workResults = run.result.workResults!.map((item, index) => (index === 0 ? { ...item, state: 'met', note: '출처 12개' } : item));
    const comparison = { ...buildDemoData().comparisons[0], runs: [run, run] };
    const markdown = comparisonMarkdown(comparison);
    expect(markdown).toContain('### 주문 (기록을 만들 때의 복사본)');
    expect(markdown).toContain('작업별 결과:');
    expect(markdown).toContain('출처 12개');
    const old = comparisonMarkdown(buildDemoData().comparisons[0]);
    expect(old).not.toContain('### 주문');
  });
});
