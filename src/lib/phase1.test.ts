// 1차 개선 검증: 옛 데이터 호환, 새 항목 왕복, 지시문 보존, 전달 정보 일관성,
// 내보내기 점검, 미리보기와 ZIP 일치, 권한 안내와 생성 파일 일치, 확인 기록 구분.
// (teamcook-phase1-agent-prompt.md 작업 7의 시나리오 1~10)

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { cardToClaudeMd, claudeMdToCard } from '../converters/claude';
import { CODEX_READONLY_GUARD, cardToCodexToml, codexTomlToCard } from '../converters/codex';
import { STRUCT_MARKER, composeInstructions } from '../converters/instructions';
import { antigravityMdToCard, cardToAntigravityMd, cardToGrokMd, grokMdToCard } from '../converters/markdownAgents';
import { providerData } from '../data/providers';
import { builtinRecipes } from '../data/recipes';
import { loadSavedRecipes } from '../store/useStore';
import type { AgentCard, Recipe } from '../types';
import { checkRecipe, fieldDomId, handoffDeliverables, hasCycle, isBlocked } from './exportCheck';
import { ExportBlockedError, buildExportBundle, buildRecipeZip, zipBundle } from './exportZip';
import { buildRecipeMd, starterPrompt } from './recipeMd';
import { RecipeFormatError, parseRecipe } from './recipeSchema';
import { decodeRecipe, encodeRecipe } from './share';
import { permissionSupport, previewInstructions, reflectionScope } from './support';
import { hasSuccessfulRun } from './verification';

const crossReview = builtinRecipes[0];
const featureTeam = builtinRecipes.find((recipe) => recipe.id === 'builtin-feature-team')!;
const debate = builtinRecipes.find((recipe) => recipe.id === 'builtin-decision-debate')!;
const graphrag = builtinRecipes.find((recipe) => recipe.id === 'builtin-graphrag-feasibility')!;

/** 2026-11-16까지 쓰던 저장 형식(v1) 그대로: 확인 날짜 하나, 새 항목 없음 */
const V1_SAVED = {
  schemaVersion: 1,
  id: 'recipe-old',
  title: '옛 레시피',
  summary: '예전에 저장한 팀',
  useCase: '검토',
  author: '나',
  lastVerified: '2026-11-10',
  collaboration: 'subagents',
  cards: [
    { id: 'c1', name: 'writer', displayName: '작성자', role: '구현', instructions: '너는 구현 담당이다.', preferredEngine: 'claude-code', permission: 'edit', tags: ['writer'] },
    { id: 'c2', name: 'reviewer', displayName: '검토자', role: '검토', instructions: '너는 검토자다.', preferredEngine: 'codex-cli', permission: 'read-only', tags: ['reviewer'] },
  ],
  handoffs: [{ id: 'h1', from: 'c1', to: 'c2', label: '변경 내용' }],
  settings: { maxThreads: 2, maxDepth: 1 },
  howToRun: '순서대로 맡긴다',
};

const codes = (recipe: Recipe, level?: string) =>
  checkRecipe(recipe, providerData)
    .filter((issue) => !level || issue.level === level)
    .map((issue) => issue.code);

/** 옛 레시피에 필수 항목만 채운 것 */
function completed(): Recipe {
  const recipe = parseRecipe(V1_SAVED);
  return {
    ...recipe,
    learningObjective: '교차 검토 흐름을 익힌다',
    successCriteria: ['검토자가 지적만 했다'],
    cards: recipe.cards.map((card) => ({
      ...card,
      deliverables: [{ id: `${card.id}-out`, name: `${card.displayName} 결과` }],
      completionCriteria: ['끝났다고 보고했다'],
    })),
  };
}

describe('1. 옛 저장 데이터·옛 공유 링크·기존 가져오기 형식', () => {
  it('v1 레시피가 그대로 열리고, 있던 내용이 모두 남는다', () => {
    const recipe = parseRecipe(V1_SAVED);
    expect(recipe.schemaVersion).toBe(2);
    expect(recipe).toMatchObject({
      id: 'recipe-old',
      title: '옛 레시피',
      author: '나',
      howToRun: '순서대로 맡긴다',
      handoffs: [{ id: 'h1', from: 'c1', to: 'c2', label: '변경 내용' }],
    });
    expect(recipe.cards.map((card) => card.instructions)).toEqual(['너는 구현 담당이다.', '너는 검토자다.']);
    // 새 항목은 지어내지 않고 비워 둔다
    expect(recipe.learningObjective).toBeUndefined();
    expect(recipe.cards[0].deliverables).toBeUndefined();
  });

  it('옛 형식을 두 번 바꿔도 결과가 같고 확인 기록이 겹쳐 생기지 않는다', () => {
    const once = parseRecipe(V1_SAVED);
    const twice = parseRecipe(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(once.verification).toHaveLength(1);
    // 옛 날짜가 남아 있는 채로 다시 읽어도 하나만
    expect(parseRecipe({ ...JSON.parse(JSON.stringify(once)), lastVerified: '2026-11-10' }).verification).toHaveLength(1);
  });

  it('v1로 만든 공유 링크가 열린다', () => {
    const result = decodeRecipe(encodeRecipe(V1_SAVED as unknown as Recipe));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.recipe.title).toBe('옛 레시피');
  });

  it('더 새로운 버전은 조용히 읽지 않고 거절한다', () => {
    expect(() => parseRecipe({ ...V1_SAVED, schemaVersion: 3, futureField: '모르는 항목' })).toThrow(RecipeFormatError);
  });

  it('저장소: 옛 레시피는 바꿔서 읽고, 읽지 못한 것은 버리지 않고 그대로 보관한다', () => {
    const future = { ...V1_SAVED, id: 'recipe-future', schemaVersion: 3, futureField: { keep: true } };
    const first = loadSavedRecipes([V1_SAVED, future, '깨진 값'], undefined);
    expect(first.recipes.map((recipe) => recipe.id)).toEqual(['recipe-old']);
    expect(first.unreadable).toEqual([future, '깨진 값']);
    // 다음에 다시 읽어도 보관된 것이 사라지거나 늘지 않는다
    const second = loadSavedRecipes(first.recipes, first.unreadable);
    expect(second.recipes).toEqual(first.recipes);
    expect(second.unreadable).toEqual(first.unreadable);
  });

  it('다른 도구로 만든 TOML·Markdown은 지시문을 그대로 두고 새 항목은 비운다', () => {
    const toml = 'name = "helper"\ndescription = "돕는다"\ndeveloper_instructions = """\n원래 지시문\n둘째 줄\n"""\n';
    const fromToml = codexTomlToCard(toml);
    expect(fromToml.instructions).toBe('원래 지시문\n둘째 줄');
    expect(fromToml.deliverables).toBeUndefined();
    const fromMd = claudeMdToCard('---\nname: helper\ndescription: 돕는다\n---\n\n원래 지시문\n');
    expect(fromMd.instructions).toBe('원래 지시문');
    expect(fromMd.completionCriteria).toBeUndefined();
  });
});

describe('2. 새 항목의 저장·공유·JSON 왕복', () => {
  const full: Recipe = {
    ...completed(),
    sampleTask: '버튼을 추가해 줘',
    prerequisites: ['Claude Code 설치'],
    verification: [
      { id: 'v1', kind: 'run', checkedAt: '2026-11-17', result: 'failure', source: 'user', tool: 'Codex', toolVersion: '1.2.3', environment: 'Windows 11', note: '에이전트가 안 보였다' },
    ],
    cards: completed().cards.map((card) => ({
      ...card,
      requiredInputs: ['기능 설명'],
      boundaries: ['관련 없는 파일은 고치지 않는다'],
      deliverables: [{ id: `${card.id}-out`, name: '결과', description: '무엇을 했는지' }],
    })),
    handoffs: [{ id: 'h1', from: 'c1', to: 'c2', label: '변경 내용', deliverableIds: ['c1-out'] }],
  };

  it('공유 링크를 거쳐도 그대로다', () => {
    expect(decodeRecipe(encodeRecipe(full))).toEqual({ ok: true, recipe: full });
  });

  it('recipe.json으로 내보냈다가 다시 읽어도 그대로다', () => {
    const bundle = buildExportBundle(full, providerData);
    const json = bundle.files.find((file) => file.path === 'recipe.json')!.content;
    expect(parseRecipe(JSON.parse(json))).toEqual(full);
  });

  it('기본 레시피 전체가 공유 링크를 거쳐도 그대로다', () => {
    for (const recipe of builtinRecipes) {
      expect(decodeRecipe(encodeRecipe(recipe))).toEqual({ ok: true, recipe });
    }
  });
});

describe('3. 사용자 원본 지시문 보존과 생성 지시문', () => {
  const card: AgentCard = {
    id: 'c1',
    name: 'reviewer',
    displayName: '검토자',
    role: '변경을 검토한다',
    instructions: '너는 검토자다.\n근거를 적어라.',
    preferredEngine: 'codex-cli',
    permission: 'read-only',
    requiredInputs: ['변경 내용'],
    deliverables: [{ id: 'd1', name: '지적 목록', description: '위치와 이유' }],
    completionCriteria: ['모든 변경을 봤다'],
    boundaries: ['파일을 고치지 않는다'],
  };

  it('구조화된 항목은 원본 뒤에 정해진 순서로 덧붙고, 원본은 바뀌지 않는다', () => {
    const text = composeInstructions(card);
    expect(text.startsWith('너는 검토자다.\n근거를 적어라.\n\n' + STRUCT_MARKER)).toBe(true);
    const order = ['[받을 입력]', '[필수 산출물', '[완료 기준', '[하지 않을 일]'].map((part) => text.indexOf(part));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain('- 지적 목록: 위치와 이유');
    expect(card.instructions).toBe('너는 검토자다.\n근거를 적어라.');
    // 항목이 없으면 원본 그대로
    expect(composeInstructions({ instructions: '원본만' })).toBe('원본만');
  });

  it('네 형식 모두: 파일에는 덧붙인 지시문이 들어가고, 다시 읽으면 원본과 항목이 되살아난다', () => {
    const cases: [string, (c: AgentCard) => string, (text: string, o: { id: string }) => AgentCard, AgentCard][] = [
      ['codex', cardToCodexToml, codexTomlToCard, card],
      ['claude', cardToClaudeMd, claudeMdToCard, { ...card, preferredEngine: 'claude-code' }],
      ['antigravity', cardToAntigravityMd, antigravityMdToCard, { ...card, preferredEngine: 'antigravity-cli' }],
      ['grok', cardToGrokMd, grokMdToCard, { ...card, preferredEngine: 'grok-build' }],
    ];
    for (const [, write, read, source] of cases) {
      const file = write(source);
      expect(file).toContain(STRUCT_MARKER);
      expect(file).toContain('- 모든 변경을 봤다');
      expect(read(file, { id: 'c1' })).toEqual(source);
    }
  });

  it('미리보기는 실제 파일에 들어가는 지시문과 같다 (Codex 읽기 전용 문장 포함)', () => {
    const preview = previewInstructions(card, 'subagents');
    expect(preview.endsWith(CODEX_READONLY_GUARD)).toBe(true);
    const fromFile = /developer_instructions = """\n([\s\S]*?)\n"""/.exec(cardToCodexToml(card))![1];
    expect(fromFile).toBe(preview);
    const claude = { ...card, preferredEngine: 'claude-code' as const };
    expect(cardToClaudeMd(claude).trimEnd().endsWith(previewInstructions(claude, 'subagents'))).toBe(true);
  });
});

describe('4. 이름 변경·삭제 뒤 전달 정보의 일관성', () => {
  const base = crossReview;
  const handoff = base.handoffs[0];

  it('카드와 산출물 이름을 바꿔도 넘겨주기는 그대로 이어진다', () => {
    const renamed: Recipe = {
      ...base,
      cards: base.cards.map((card) => ({
        ...card,
        name: `${card.name}_v2`,
        displayName: `${card.displayName} 2`,
        deliverables: card.deliverables?.map((item) => ({ ...item, name: `${item.name} (새 이름)` })),
      })),
    };
    const { found, missing } = handoffDeliverables(renamed, handoff);
    expect(missing).toEqual([]);
    expect(found.map((item) => item.id)).toEqual(handoff.deliverableIds);
    expect(found[0].name).toContain('(새 이름)');
    expect(codes(renamed, 'error')).toEqual([]);
  });

  it('참조 중인 산출물을 지우면 "재선택 필요"가 되고, 점검에도 확인 필요로 나온다', () => {
    const removed: Recipe = {
      ...base,
      cards: base.cards.map((card) =>
        card.id === handoff.from ? { ...card, deliverables: card.deliverables!.slice(1) } : card,
      ),
    };
    expect(handoffDeliverables(removed, handoff).missing).toHaveLength(1);
    const issues = checkRecipe(removed, providerData).filter((issue) => issue.code === 'HANDOFF_STALE_DELIVERABLE');
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].target).toEqual({ kind: 'handoff', id: handoff.id, field: 'handoff' });
    expect(buildRecipeMd(removed, providerData)).toContain('지워진 산출물을 가리키고 있어요');
  });

  it('없는 카드를 가리키는 연결은 수정 필요, 저장 데이터를 읽을 때는 정리된다', () => {
    const broken: Recipe = { ...base, cards: base.cards.slice(0, 1) };
    expect(codes(broken, 'error')).toContain('HANDOFF_BROKEN');
    expect(parseRecipe(JSON.parse(JSON.stringify(broken))).handoffs).toEqual([]);
  });

  it('비어 있는 연결과 되돌아가는 연결을 구분한다', () => {
    const emptyLink: Recipe = { ...base, handoffs: [{ id: 'x', from: base.cards[0].id, to: base.cards[1].id }] };
    expect(codes(emptyLink)).toContain('HANDOFF_EMPTY');
    expect(hasCycle(emptyLink)).toBe(false);
    // 기본 레시피는 작성자 ↔ 검토자로 되돌아간다: 막지 않고 참고로만 알린다
    expect(hasCycle(base)).toBe(true);
    expect(codes(base, 'info')).toContain('FLOW_CYCLE');
    expect(codes(base)).not.toContain('HANDOFF_EMPTY');
    // 프롬프트에는 각 단계가 한 번씩만 들어간다
    expect(starterPrompt(base).match(/에게 넘긴다/g)).toHaveLength(base.handoffs.length);
  });
});

describe('5·6. 내보내기 점검: 차단과 허용, 입력 위치', () => {
  it('새 항목이 없는 옛 레시피도 바로 내려받을 수 있다. 빈 항목은 "채우면 더 좋아요"로만 알린다', async () => {
    // 2026-11-17 사용자 결정: 학습 목표·성공 조건·산출물·완료 기준이 비어 있어도 막지 않는다
    const old = parseRecipe(V1_SAVED);
    expect(codes(old, 'error')).toEqual([]);
    expect(codes(old, 'warn')).toEqual([
      'NO_OBJECTIVE',
      'NO_SUCCESS_CRITERIA',
      'CARD_NO_DELIVERABLE',
      'CARD_NO_CRITERIA',
      'PERMISSION_INSTRUCTION_ONLY',
    ]);
    const bundle = buildExportBundle(old, providerData);
    expect(bundle.blocked).toBe(false);
    expect((await zipBundle(bundle)).length).toBeGreaterThan(100);
  });

  it('같은 종류의 빈 항목은 역할마다 따로 적지 않고 한 줄로 묶는다', () => {
    const issues = checkRecipe(parseRecipe(V1_SAVED), providerData);
    const noOutput = issues.filter((issue) => issue.code === 'CARD_NO_DELIVERABLE');
    expect(noOutput).toHaveLength(1);
    expect(noOutput[0].message).toBe('산출물을 적지 않은 역할: 작성자, 검토자');
    // 누르면 첫 번째 역할의 입력 칸으로 간다
    expect(noOutput[0].target).toEqual({ kind: 'card', id: 'c1', field: 'deliverables' });
  });

  it('항목을 채우면 권장 목록에서 사라지고, 남은 권장·참고 항목은 내려받기를 막지 않는다', async () => {
    const recipe = completed();
    expect(codes(recipe, 'error')).toEqual([]);
    // Codex 읽기 전용은 지시문으로만 안내된다
    expect(codes(recipe, 'warn')).toEqual(['PERMISSION_INSTRUCTION_ONLY']);
    expect(codes(recipe, 'info')).toEqual(expect.arrayContaining(['ENV_UNCHECKED', 'ORDER_PROMPT_ONLY']));
    expect(isBlocked(checkRecipe(recipe, providerData))).toBe(false);
    expect((await buildRecipeZip(recipe, providerData)).length).toBeGreaterThan(100);
  });

  it('막는 것은 파일이 깨지는 경우뿐이고, 그때는 실제 ZIP 생성도 막힌다', async () => {
    const dup = completed();
    dup.cards[1] = { ...dup.cards[1], name: dup.cards[0].name };
    const bundle = buildExportBundle(dup, providerData);
    expect(bundle.blocked).toBe(true);
    await expect(zipBundle(bundle)).rejects.toBeInstanceOf(ExportBlockedError);
    await expect(buildRecipeZip(dup, providerData)).rejects.toBeInstanceOf(ExportBlockedError);
    // 막는 코드는 이 다섯 가지가 전부다
    const blocking = ['NO_CARDS', 'BAD_FILE_NAME', 'DUPLICATE_FILE', 'HANDOFF_BROKEN', 'TOOL_STYLE_MISMATCH'];
    const samples: Recipe[] = [
      parseRecipe(V1_SAVED),
      dup,
      { ...completed(), cards: [], handoffs: [] },
      { ...crossReview, collaboration: 'agent-team' },
      { ...crossReview, cards: crossReview.cards.slice(0, 1) },
    ];
    for (const sample of samples) {
      for (const code of codes(sample, 'error')) expect(blocking).toContain(code);
    }
  });

  it('역할 없음, 잘못된 파일 이름, 겹치는 파일 이름은 고쳐야 한다', () => {
    expect(codes({ ...completed(), cards: [], handoffs: [] }, 'error')).toContain('NO_CARDS');
    const bad = completed();
    bad.cards[0] = { ...bad.cards[0], name: '검토 자' };
    expect(codes(bad, 'error')).toEqual(['BAD_FILE_NAME']);
    const dup = completed();
    dup.cards[1] = { ...dup.cards[1], name: dup.cards[0].name };
    expect(codes(dup, 'error')).toEqual(['DUPLICATE_FILE']);
  });

  it('점검 결과는 수준·코드·메시지·위치를 갖고, 위치는 입력 칸 id로 바뀐다', () => {
    const issues = checkRecipe(parseRecipe(V1_SAVED), providerData);
    for (const issue of issues) {
      expect(['error', 'warn', 'info']).toContain(issue.level);
      expect(issue.code).toMatch(/^[A-Z_]+$/);
      expect(issue.message.length).toBeGreaterThan(5);
      expect(issue.target.field).not.toBe('');
    }
    const byCode = (code: string) => issues.find((issue) => issue.code === code)!;
    expect(fieldDomId(byCode('NO_OBJECTIVE').target)).toBe('recipe-objective');
    expect(fieldDomId(byCode('NO_SUCCESS_CRITERIA').target)).toBe('recipe-success');
    expect(fieldDomId(byCode('CARD_NO_DELIVERABLE').target)).toBe('c1-deliverables');
    expect(fieldDomId(byCode('CARD_NO_CRITERIA').target)).toBe('c1-criteria');
    expect(fieldDomId({ kind: 'handoff', id: 'h1', field: 'handoff' })).toBe('handoff-h1');
  });
});

describe('7. 미리보기와 ZIP의 일치', () => {
  it('ZIP 안의 경로와 내용이 미리보기 묶음과 똑같다', async () => {
    for (const recipe of [crossReview, featureTeam, debate]) {
      const bundle = buildExportBundle(recipe, providerData);
      const zip = await JSZip.loadAsync(await zipBundle(bundle));
      const inZip = Object.keys(zip.files).filter((path) => !zip.files[path].dir).sort();
      expect(inZip).toEqual(bundle.files.map((file) => `${bundle.root}/${file.path}`).sort());
      for (const file of bundle.files) {
        expect(await zip.file(`${bundle.root}/${file.path}`)!.async('string')).toBe(file.content);
      }
    }
  });

  it('레시피를 고친 뒤 다시 만든 묶음에는 고친 내용이 들어간다', () => {
    const before = buildExportBundle(crossReview, providerData);
    const edited: Recipe = {
      ...crossReview,
      cards: crossReview.cards.map((card, index) =>
        index === 0 ? { ...card, completionCriteria: ['새로 적은 완료 기준'] } : card,
      ),
    };
    const after = buildExportBundle(edited, providerData);
    const pick = (bundle: typeof before) => bundle.files.find((file) => file.path === '.claude/agents/writer.md')!.content;
    expect(pick(before)).not.toContain('새로 적은 완료 기준');
    expect(pick(after)).toContain('새로 적은 완료 기준');
  });

  it('파일마다 역할 설명이 있고, 합쳐야 하는 설정 파일을 표시한다', () => {
    const bundle = buildExportBundle(featureTeam, providerData);
    for (const file of bundle.files) expect(file.purpose).not.toBe('기타');
    expect(bundle.files.filter((file) => file.mergeNeeded).map((file) => file.path)).toEqual(['.claude/settings.json']);
    const sub = buildExportBundle(crossReview, providerData);
    expect(sub.files.filter((file) => file.mergeNeeded).map((file) => file.path)).toEqual(['.codex/config.toml']);
  });
});

describe('8. 협업 방식과 도구 조합', () => {
  it('혼합 도구 서브에이전트: 모든 역할이 두 형식으로 들어가고 역할의 도구 선택은 바뀌지 않는다', () => {
    const bundle = buildExportBundle(crossReview, providerData);
    const json = JSON.parse(bundle.files.find((file) => file.path === 'recipe.json')!.content) as Recipe;
    expect(json.cards.map((card) => card.preferredEngine)).toEqual(['claude-code', 'codex-cli']);
    expect(bundle.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['.codex/agents/writer.toml', '.claude/agents/writer.md', '.codex/agents/reviewer.toml', '.claude/agents/reviewer.md']),
    );
  });

  it('에이전트 팀에 다른 도구의 역할이 섞이면 파일을 만들기 전에 막는다', () => {
    const mixed: Recipe = { ...crossReview, collaboration: 'agent-team' };
    const issues = checkRecipe(mixed, providerData).filter((issue) => issue.code === 'TOOL_STYLE_MISMATCH');
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].message).toContain('Codex');
    expect(fieldDomId(issues[0].target)).toBe(`${crossReview.cards[1].id}-engine`);
    expect(codes(featureTeam, 'error')).toEqual([]);
  });

  it('토론형은 파일이 없으므로 파일 이름과 권한을 점검하지 않고, 프롬프트만 만든다', () => {
    const odd: Recipe = {
      ...debate,
      cards: debate.cards.map((card) => ({ ...card, name: '한글 이름' })),
    };
    expect(codes(odd, 'error')).toEqual([]);
    expect(codes(debate, 'warn')).toEqual([]);
    const paths = buildExportBundle(debate, providerData).files.map((file) => file.path).sort();
    expect(paths).toEqual(['RECIPE.md', 'debate-prompt.txt', 'recipe.json']);
  });

  it('실행 반영 범위가 조리법마다 다르게, 실제 생성 결과대로 적힌다', () => {
    const where = (recipe: Recipe, item: string) => reflectionScope(recipe, providerData).find((row) => row.item === item)!;
    expect(where(crossReview, '역할 정의').where).toContain('.codex/agents/*.toml');
    expect(where(featureTeam, '역할 정의').where).toBe('.claude/agents/*.md');
    expect(where(debate, '역할 정의').where).toContain('debate-prompt.txt');
    expect(where(crossReview, '작업 순서').note).toContain('강제하지 않습니다');
    expect(where(debate, '팀원 메시지').note).toContain('한 AI가 여러 역할');
    // 서브에이전트끼리의 소통을 일반화해서 단정하지 않는다
    expect(where(crossReview, '팀원 메시지').note).toContain('도구마다 다르고');
  });

  it('대표 예제(GraphRAG): 두 조사 결과가 비판적 검토로 가고, 최종 정리 주체와 형식이 첫 프롬프트에 있다', () => {
    expect(graphrag.title).toBe('GraphRAG 주제 3개 타당성 검토');
    expect(graphrag.handoffs.map((handoff) => handoff.to)).toEqual([graphrag.cards[2].id, graphrag.cards[2].id]);
    const prompt = starterPrompt(graphrag);
    expect(prompt).toContain('data_scout의 결과(데이터 조사 결과: 출처 목록, 데이터 범위, 이용 조건, 확보 가능성)를 critic에게 넘긴다');
    expect(prompt).toContain('모든 단계가 끝나면 네가(메인) 결과를 하나로 모아');
    expect(prompt).toContain('"공개 데이터가 없다"와 "현재 검색에서 찾지 못했다"를 구분한다');
    // 실제로 실행하지 않았으므로 설계 예제로 표시한다
    expect(graphrag.summary).toContain('설계 예제');
    expect(hasSuccessfulRun(graphrag.verification)).toBe(false);
  });
});

describe('9. 권한 설명과 실제 내보내기 설정의 일치', () => {
  const card = (patch: Partial<AgentCard>): AgentCard => ({
    id: 'c',
    name: 'agent',
    displayName: '에이전트',
    role: '역할',
    instructions: '지시문',
    preferredEngine: 'claude-code',
    permission: 'read-only',
    ...patch,
  });

  it('Claude Code 읽기 전용: "도구 제한"이라고 말하고, 파일의 tools도 읽기 도구뿐이다', () => {
    const target = card({});
    expect(permissionSupport(target, 'subagents').modes).toEqual(['tool-limit']);
    expect(cardToClaudeMd(target)).toContain('tools: Read, Grep, Glob');
  });

  it('Codex 읽기 전용: "지시문으로 안내 + 실행 환경 설정 필요"라고 말하고, 파일에는 문장만 들어간다', () => {
    const target = card({ preferredEngine: 'codex-cli' });
    const support = permissionSupport(target, 'subagents');
    expect(support.modes).toEqual(['instruction', 'env-required']);
    expect(support.text).toContain('codex --sandbox read-only');
    const toml = cardToCodexToml(target);
    expect(toml).toContain(CODEX_READONLY_GUARD);
    expect(toml).not.toMatch(/sandbox_mode|approval_policy/);
  });

  it('도구 목록을 직접 적어 권한과 어긋나면 "확인 필요"라고 말한다', () => {
    const target = card({ tools: ['Read', 'Bash'] });
    expect(permissionSupport(target, 'subagents').modes).toEqual(['unknown']);
    expect(cardToClaudeMd(target)).toContain('tools: Read, Bash');
  });

  it('제한 없음·토론형·에이전트 팀도 실제 동작대로 말한다', () => {
    expect(permissionSupport(card({ permission: 'full' }), 'subagents').modes).toEqual(['env-required']);
    expect(cardToClaudeMd(card({ permission: 'full' }))).not.toContain('tools:');
    expect(permissionSupport(card({}), 'debate').modes).toEqual(['instruction']);
    // 에이전트 팀은 카드에 Codex가 적혀 있어도 Claude Code 파일로 나간다
    expect(permissionSupport(card({ preferredEngine: 'codex-cli' }), 'agent-team').modes).toEqual(['tool-limit']);
  });

  it('RECIPE.md의 역할별 권한 설명이 같은 규칙에서 나온다', () => {
    const md = buildRecipeMd(crossReview, providerData);
    expect(md).toContain(permissionSupport(crossReview.cards[1], 'subagents').text);
    expect(md).toContain('지시문으로 안내, 실행 환경 설정 필요');
  });
});

describe('10. 확인 기록: 옛 날짜가 실행 성공으로 올라가지 않는다', () => {
  it('옛 확인 날짜는 "확인 방식 미기록"으로만 남는다', () => {
    const recipe = parseRecipe(V1_SAVED);
    expect(recipe.verification).toEqual([
      { id: 'legacy-date', kind: 'unclassified', checkedAt: '2026-11-10', result: 'n/a', source: 'unknown' },
    ]);
    expect(hasSuccessfulRun(recipe.verification)).toBe(false);
    const md = buildRecipeMd(recipe, providerData);
    expect(md).toContain('확인 방식 미기록 · 2026-11-10 · 출처 모름');
    expect(md).not.toContain('실제 실행 확인 · 2026-11-10');
  });

  it('모르는 종류·결과·출처는 성공 쪽이 아니라 모름 쪽으로 낮춘다', () => {
    const recipe = parseRecipe({
      ...V1_SAVED,
      lastVerified: undefined,
      verification: [{ id: 'a', kind: '대충 확인', checkedAt: '2026-11-17', result: 'great', source: 'me' }, { kind: 'run', result: 'success' }],
    });
    expect(recipe.verification).toEqual([
      { id: 'a', kind: 'unclassified', checkedAt: '2026-11-17', result: 'n/a', source: 'unknown' },
    ]);
  });

  it('설명서는 문서 확인·파일 생성 확인과 실제 실행 확인을 구분해 적는다', () => {
    const md = buildRecipeMd(featureTeam, providerData);
    expect(md).toContain('문서 확인 · 2026-11-16 · 성공 · 만든 쪽 기록');
    expect(md).toContain('파일 생성 확인 · 2026-11-17 · 성공 · 자동 점검');
    expect(md).toContain('"문서 확인"과 "파일 생성 확인"은 실제로 실행해 본 것이 아닙니다');
    expect(buildRecipeMd({ ...featureTeam, verification: undefined }, providerData)).toContain('확인 기록이 없습니다');
  });

  it('설명서만 읽어도 준비·적용·첫 실행·확인 방법을 알 수 있다', () => {
    for (const recipe of [crossReview, featureTeam, debate]) {
      const md = buildRecipeMd(recipe, providerData);
      for (const part of ['## 이 레시피로 익히는 것', '실습 성공 조건', '## 준비', '역할별 작업·산출물·완료 기준', '## 실행 반영 범위', '## 예상 결과 형식', '## 확인 기록']) {
        expect(md).toContain(part);
      }
    }
    const sub = buildRecipeMd(crossReview, providerData);
    expect(sub).toContain('### 에이전트가 안 보일 때');
    expect(sub).toContain('사이트가 실제 실행 순서를 강제하지는 않습니다');
    expect(buildRecipeMd(debate, providerData)).toContain('설치할 것이 없어요');
  });
});
