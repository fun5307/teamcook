// 2차: 실습 기록·비교 평가 검사 (지시서 작업 7의 필수 검증 2~8, 9 일부)

import { describe, expect, it } from 'vitest';
import { builtinRecipes } from '../../data/recipes';
import type { Recipe } from '../../types';
import { encodeRecipe } from '../share';
import { compareConditions, measureRows, staleRunIds } from './compare';
import { buildDemoData, mergeDemo } from './demo';
import {
  conditionsLocked,
  createRun,
  createTask,
  deriveRun,
  elapsedMinutesFromTimes,
  EMPTY_INPUT,
  measureProblems,
  measureValueText,
} from './model';
import { block, comparisonMarkdown, inline } from './report';
import { defaultRubric, effectiveScore, scoreLabel } from './rubric';
import { loadPracticeData, parseRun } from './schema';
import { loadPractice, PRACTICE_STORAGE_KEY, savePractice } from './storage';
import { isZonedIso } from './time';
import { applyImport, buildExport, FULL_EXPORT, IMPORT_SIZE_LIMIT, previewImport } from './transfer';
import { EMPTY_PRACTICE_DATA, type Comparison, type PracticeData, type PracticeRun } from './types';

const graphrag = builtinRecipes.find((recipe) => recipe.id === 'builtin-graphrag-feasibility')!;

function memoryStorage(limit = Infinity) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (value.length > limit) throw new DOMException('quota', 'QuotaExceededError');
      map.set(key, value);
    },
  };
}

function newRecipeRun(recipe: Recipe = graphrag) {
  const task = createTask({ title: '', input: recipe.sampleTask ?? '과제', materials: '웹 검색 허용', successCriteria: recipe.successCriteria });
  const run = createRun({ recipe, task, input: { ...EMPTY_INPUT, tool: 'Claude Code', model: 'm1' } });
  return { task, run };
}

function data(partial: Partial<PracticeData>): PracticeData {
  return { ...structuredClone(EMPTY_PRACTICE_DATA), ...partial };
}

describe('2. 레시피를 고치거나 지워도 기록의 스냅샷은 그대로다', () => {
  it('기록은 레시피를 깊은 복사로 떠 둔다', () => {
    const recipe = structuredClone(graphrag);
    const { run } = newRecipeRun(recipe);
    recipe.title = '바뀐 제목';
    recipe.cards[0].displayName = '바뀐 역할';
    recipe.successCriteria!.push('새 조건');
    expect(run.snapshot!.recipe.title).toBe(graphrag.title);
    expect(run.snapshot!.recipe.cards[0].displayName).toBe(graphrag.cards[0].displayName);
    expect(run.result.checks.map((check) => check.text)).toEqual(graphrag.successCriteria);
    expect(run.snapshot!.sourceId).toBe(graphrag.id);
  });

  it('원본 레시피가 없어도(지워져도) 저장한 기록과 보고서가 열린다', () => {
    const storage = memoryStorage();
    const { task, run } = newRecipeRun({ ...structuredClone(graphrag), id: 'recipe-deleted-later' });
    expect(savePractice(data({ tasks: [task], runs: [run] }), storage).ok).toBe(true);
    // 레시피 저장소와 무관하게 다시 읽힌다
    const loaded = loadPractice(storage).data;
    expect(loaded.runs[0].snapshot!.recipe.cards).toHaveLength(graphrag.cards.length);
    const comparison: Comparison = { ...buildDemoData().comparisons[0], runs: [loaded.runs[0], loaded.runs[0]] };
    expect(comparisonMarkdown(comparison)).toContain(graphrag.title);
  });

  it('기록을 만드는 것만으로 성공 표시가 생기지 않고, 레시피의 확인 기록도 바뀌지 않는다', () => {
    const before = JSON.stringify(graphrag.verification);
    const { run } = newRecipeRun();
    expect(run.status).toBe('ready');
    expect(run.result.checks.every((check) => check.state === 'unknown')).toBe(true);
    expect(run.scores).toEqual([]);
    expect(JSON.stringify(graphrag.verification)).toBe(before);
  });

  it('실습 기록은 레시피 공유 링크에 들어가지 않는다', () => {
    const { run } = newRecipeRun();
    expect(encodeRecipe(graphrag)).toBe(encodeRecipe(run.snapshot!.recipe));
  });
});

describe('3. 상태·보관과 재시작 후 보존, 이관 반복', () => {
  it('상태(준비·기록 중·완료·중단)와 보관 여부는 따로 저장되고, 다시 읽어도 그대로다', () => {
    const storage = memoryStorage();
    const runs = (['ready', 'recording', 'done', 'stopped'] as const).map((status, index) => ({
      ...newRecipeRun().run,
      status,
      archived: index % 2 === 0,
    }));
    savePractice(data({ runs }), storage);
    const loaded = loadPractice(storage).data;
    expect(loaded.runs.map((run) => [run.status, run.archived])).toEqual([
      ['ready', true],
      ['recording', false],
      ['done', true],
      ['stopped', false],
    ]);
  });

  it('여러 번 읽고 저장해도 중복·손실이 없다', () => {
    const storage = memoryStorage();
    const demo = mergeDemo(structuredClone(EMPTY_PRACTICE_DATA));
    savePractice(demo, storage);
    for (let index = 0; index < 3; index += 1) savePractice(loadPractice(storage).data, storage);
    const loaded = loadPractice(storage).data;
    expect(loaded).toEqual(JSON.parse(JSON.stringify(demo)));
    // 예제를 두 번 불러와도 겹치지 않는다
    expect(mergeDemo(loaded).runs).toHaveLength(3);
  });

  it('읽지 못한 항목·깨진 저장 내용은 버리지 않고 보관한다', () => {
    const future = { ...newRecipeRun().run, dataVersion: 99 };
    const loaded = loadPracticeData({ runs: [future, newRecipeRun().run] });
    expect(loaded.runs).toHaveLength(1);
    expect(loaded.unreadable).toEqual([future]);
    const storage = memoryStorage();
    storage.map.set(PRACTICE_STORAGE_KEY, '{깨진 json');
    const result = loadPractice(storage);
    expect(result.broken).toBe('{깨진 json');
    expect(result.data.unreadable).toEqual(['{깨진 json']);
  });

  it('저장 공간이 모자라면 실패를 돌려주고 이전 내용을 그대로 둔다', () => {
    const storage = memoryStorage(5000);
    const small = data({ runs: [] });
    expect(savePractice(small, storage).ok).toBe(true);
    const before = storage.map.get(PRACTICE_STORAGE_KEY);
    const big = mergeDemo(small);
    const result = savePractice(big, storage);
    expect(result.ok).toBe(false);
    expect(storage.map.get(PRACTICE_STORAGE_KEY)).toBe(before);
  });

  it('시각은 시간대가 붙은 형식으로 저장된다', () => {
    const { run, task } = newRecipeRun();
    expect(isZonedIso(run.createdAt)).toBe(true);
    expect(isZonedIso(task.createdAt)).toBe(true);
    expect(() => parseRun({ ...run, createdAt: '2026-11-17 10:00' })).toThrow();
  });

  it('기록을 시작하면 조건이 잠기고, 조건을 바꾸려면 결과·점수 없이 새 기록을 파생한다', () => {
    const { run } = newRecipeRun();
    expect(conditionsLocked(run)).toBe(false);
    const started: PracticeRun = {
      ...run,
      status: 'done',
      result: { ...run.result, summary: '결과', checks: run.result.checks.map((check) => ({ ...check, state: 'met' })) },
      scores: [{ criterionId: 'accuracy', value: 3, rationale: 'r', evaluator: 'me', evaluatedAt: run.createdAt }],
    };
    expect(conditionsLocked(started)).toBe(true);
    const derived = deriveRun(started);
    expect(derived.id).not.toBe(run.id);
    expect(derived.derivedFrom).toBe(run.id);
    expect(derived.status).toBe('ready');
    expect(derived.scores).toEqual([]);
    expect(derived.result.summary).toBe('');
    expect(derived.result.checks.every((check) => check.state === 'unknown')).toBe(true);
    expect(derived.snapshot).toEqual(started.snapshot);
  });

  it('같은 과제로 다시 기록하면 입력·기준은 같고 id는 새것이다. 단일 AI 기록도 만들 수 있다', () => {
    const { task, run } = newRecipeRun();
    const single = createRun({ task, input: { ...EMPTY_INPUT, tool: 'ChatGPT', model: 'm2' } });
    expect(single.kind).toBe('single');
    expect(single.snapshot).toBeUndefined();
    expect(single.id).not.toBe(run.id);
    expect(single.input.text).toBe(run.input.text);
    expect(single.rubric).toEqual(run.rubric);
    expect(single.result.checks.map((check) => check.text)).toEqual(run.result.checks.map((check) => check.text));
  });
});

describe('4. 0점·미확인·확인 불가·해당 없음의 구분과 측정값 검사', () => {
  it('단일 AI의 협업 기여는 해당 없음이고, 0점이나 확인 불가와 다르다', () => {
    const [single] = buildDemoData().runs;
    const collaboration = single.rubric.criteria.find((item) => item.collaborative)!;
    expect(effectiveScore(single, collaboration)).toEqual({ value: 'na' });
    expect(scoreLabel('na')).toBe('해당 없음');
    expect(scoreLabel('unknown')).toBe('확인 불가');
    expect(scoreLabel(0)).toBe('0점');
    expect(scoreLabel(null)).toBe('평가 안 함');
  });

  it('미확인 측정값은 0이 아니고, 저장했다 읽어도 미확인이다', () => {
    const run = buildDemoData().runs[1];
    const tokens = run.measures.find((measure) => measure.metric === 'tokens')!;
    expect(tokens.value).toBeNull();
    expect(measureValueText(tokens)).toBe('미확인');
    expect(parseRun(JSON.parse(JSON.stringify(run))).measures.find((measure) => measure.metric === 'tokens')!.value).toBeNull();
    expect(measureValueText({ ...tokens, value: 0 })).toBe('0 토큰');
    // 숫자가 아닌 값은 0이 아니라 미확인으로 읽는다
    expect(parseRun({ ...run, measures: [{ ...tokens, value: 'abc' }] }).measures[0].value).toBeNull();
  });

  it('음수·잘못된 단위·소수 토큰·범위 없는 토큰·끝이 시작보다 앞선 시각을 잡아낸다', () => {
    const base = { id: 'm', origin: 'user' as const, source: '' };
    const problems = measureProblems({
      startedAt: '2026-11-17T10:00:00+09:00',
      endedAt: '2026-11-17T09:00:00+09:00',
      measures: [
        { ...base, metric: 'elapsed', value: -1, unit: '분', scope: '' },
        { ...base, metric: 'elapsed', value: 3, unit: '토큰', scope: '' },
        { ...base, metric: 'tokens', value: 10.5, unit: '토큰', scope: '입력' },
        { ...base, metric: 'tokens', value: 100, unit: '토큰', scope: '' },
        { ...base, metric: 'cost', value: 1, unit: '원', scope: 'API' },
      ],
    }).map((item) => item.message);
    expect(problems).toEqual([
      '끝 시각이 시작 시각보다 앞서요.',
      '값은 0보다 작을 수 없어요.',
      '단위는 분, 초, 시간 가운데 하나여야 해요.',
      '토큰 수는 정수로 적어 주세요.',
      '무엇을 센 값인지(범위)를 적어 주세요. 도구마다 세는 방식이 달라요.',
      '단위는 KRW, USD, EUR, JPY 가운데 하나여야 해요.',
    ]);
    // 0과 미확인은 문제가 아니다
    expect(measureProblems({ measures: [{ ...base, metric: 'elapsed', value: 0, unit: '분', scope: '' }, { ...base, metric: 'tokens', value: null, unit: '토큰', scope: '' }] })).toEqual([]);
  });

  it('경과 시간은 시작·끝 시각으로만 계산하고, 작업자 시간 합계를 더하지 않는다', () => {
    const team = buildDemoData().runs[2];
    expect(elapsedMinutesFromTimes(team)).toBe(31);
    expect(elapsedMinutesFromTimes({ startedAt: team.startedAt })).toBeNull();
    const rows = measureRows([team]);
    expect(rows.map((row) => row.metric)).toEqual(['elapsed', 'worker-time', 'tokens']);
  });

  it('범위가 다른 토큰 값은 직접 비교하지 않는다고 표시한다', () => {
    const [single, , team] = buildDemoData().runs;
    const tokens = measureRows([single, team]).find((row) => row.metric === 'tokens')!;
    expect(tokens.incomparable).toBe(true);
  });
});

describe('5. 입력·기준이 다른 기록: 경고하고 계산하지 않는다', () => {
  it('과제 id가 같아도 입력 원문이 다르면 동일 조건이 아니다', () => {
    const { task, run } = newRecipeRun();
    const other = createRun({ task, recipe: graphrag, input: { ...EMPTY_INPUT, tool: 'Claude Code', model: 'm1' } });
    other.input.text = `${other.input.text} (조금 바꿈)`;
    const report = compareConditions([run, other]);
    expect(run.taskId).toBe(other.taskId);
    expect(report.sameCondition).toBe(false);
    expect(report.problems.map((row) => row.key)).toContain('input');
  });

  it('모든 조건이 같으면 동일 조건, 비어 있는 조건이 있으면 확인 불가로 탐색용이 된다', () => {
    const { task, run } = newRecipeRun();
    const twin = createRun({ task, recipe: graphrag, input: { ...EMPTY_INPUT, tool: 'Claude Code', model: 'm1', toolVersion: 'v', environment: 'e' } });
    const full = { ...run, input: { ...run.input, toolVersion: 'v', environment: 'e' } };
    expect(compareConditions([full, twin]).sameCondition).toBe(true);
    const report = compareConditions([run, twin]);
    expect(report.sameCondition).toBe(false);
    expect(report.problems.find((row) => row.key === 'toolVersion')!.state).toBe('unknown');
  });

  it('실험 변수로 고른 차이는 경고에서 빠지지만 값의 차이는 그대로 보인다. 입력은 실험 변수가 될 수 없다', () => {
    const [demoSingle, subagents] = buildDemoData().runs;
    const single = { ...demoSingle, input: { ...demoSingle.input, text: `${demoSingle.input.text} 표로 정리해 줘.` } };
    const withVars = compareConditions([single, subagents], ['style', 'recipe', 'input']);
    const style = withVars.rows.find((row) => row.key === 'style')!;
    expect(style.state).toBe('different');
    expect(style.variable).toBe(true);
    expect(withVars.problems.map((row) => row.key)).toContain('input');
  });

  it('평가 기준이 다르면 항목별 표를 만들지 않고 원문만 보여 준다', () => {
    const [, a, b] = buildDemoData().runs;
    const changed = { ...b, rubric: { ...b.rubric, criteria: b.rubric.criteria.slice(0, 3) } };
    const comparison: Comparison = { ...buildDemoData().comparisons[0], runs: [a, changed] };
    expect(compareConditions(comparison.runs).rubricComparable).toBe(false);
    const markdown = comparisonMarkdown(comparison);
    expect(markdown).toContain('평가 기준이 기록마다 달라 나란히 비교하지 않고');
    expect(markdown).not.toContain('| 기준 |');
  });

  it('데모 비교: 실험 변수가 아닌 모델 차이 때문에 탐색용 비교로 표시된다', () => {
    const comparison = buildDemoData().comparisons[0];
    const report = compareConditions(comparison.runs, comparison.variables);
    expect(report.sameCondition).toBe(false);
    expect(report.problems.map((row) => row.key)).toContain('model');
    const markdown = comparisonMarkdown(comparison);
    expect(markdown).toContain('합성 데모입니다');
    expect(markdown).toContain('탐색용 비교');
    expect(markdown).not.toMatch(/종합 점수\s*[:|]\s*\d|승자/);
  });
});

describe('6. 협업 사건의 출처와 외부 자료의 신뢰 승격 방지', () => {
  it('가져온 파일 안의 "자동 관측"·"사용자 기록"은 "가져온 자료"로 바뀐다', () => {
    const team = buildDemoData().runs[2];
    const forged = {
      ...team,
      events: team.events.map((event) => ({ ...event, origin: 'observed' })),
      measures: team.measures.map((measure) => ({ ...measure, origin: 'observed' })),
    };
    const imported = parseRun(forged, 'import');
    expect(new Set(imported.events.map((event) => event.origin))).toEqual(new Set(['imported']));
    expect(new Set(imported.measures.map((measure) => measure.origin))).toEqual(new Set(['imported']));
    // 저장된 데이터에서도 '자동 관측'은 받아들이지 않는다 (2차에는 자동 관측이 없다)
    expect(parseRun(forged).events[0].origin).toBe('unknown');
  });

  it('증거가 없는 사건은 보고서에 "증거 미첨부"로 나온다', () => {
    const markdown = comparisonMarkdown(buildDemoData().comparisons[0]);
    expect(markdown).toMatch(/메시지·질문\*\*.*사용자 기록, 증거 미첨부/);
  });

  it('보고서는 사용자 글이 제목·표·HTML을 만들지 못하게 감싼다', () => {
    expect(inline('# 제목 <script>alert(1)</script> | 칸')).toBe('\\# 제목 \\<script\\>alert(1)\\</script\\> \\| 칸');
    const fenced = block('```\n# 탈출\n```');
    expect(fenced.startsWith('````text')).toBe(true);
    expect(fenced.endsWith('````')).toBe(true);
    const comparison = buildDemoData().comparisons[0];
    const evil = { ...comparison, title: '## 가짜 제목\n<img src=x onerror=alert(1)>', conclusion: '```\n## 탈출\n```' };
    const markdown = comparisonMarkdown(evil);
    expect(markdown).not.toMatch(/^## 가짜 제목/m);
    // < 는 모두 \< 로 바뀌어 HTML이 되지 않는다
    expect(markdown).not.toMatch(/(^|[^\\])<img/);
    expect(markdown).toContain('````text\n```\n## 탈출\n```\n````');
  });
});

describe('7. 저장한 비교 보고서는 원본을 고쳐도 조용히 바뀌지 않는다', () => {
  it('원본 기록이 바뀌면 "바뀜"을 알려 주고, 보고서는 스냅샷 내용 그대로다', () => {
    const demo = buildDemoData();
    const comparison = demo.comparisons[0];
    const before = comparisonMarkdown(comparison);
    const edited = demo.runs.map((run, index) =>
      index === 0 ? { ...run, updatedAt: '2026-11-18T09:00:00+09:00', result: { ...run.result, summary: '고친 요약' } } : run,
    );
    expect(staleRunIds(comparison, edited)).toEqual([demo.runs[0].id]);
    expect(comparisonMarkdown(comparison)).toBe(before);
    expect(before).not.toContain('고친 요약');
  });
});

describe('8. JSON 내보내기·가져오기', () => {
  it('왕복해도 내용과 참조가 그대로다 (출처는 "가져온 자료"가 된다)', () => {
    const demo = mergeDemo(structuredClone(EMPTY_PRACTICE_DATA));
    const file = buildExport(demo, { runs: demo.runs, comparisons: demo.comparisons });
    expect(file.tasks).toHaveLength(1);
    const preview = previewImport(JSON.stringify(file), structuredClone(EMPTY_PRACTICE_DATA));
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.plan.renamed).toBe(0);
    const strip = (run: PracticeRun) => ({ ...run, importedAt: undefined, events: run.events.map((event) => ({ ...event, origin: 'x' })), measures: run.measures.map((measure) => ({ ...measure, origin: 'x' })) });
    expect(preview.plan.runs.map(strip)).toEqual(demo.runs.map(strip));
    expect(preview.plan.comparisons[0].runIds).toEqual(demo.comparisons[0].runIds);
    expect(preview.plan.runs.every((run) => run.demo)).toBe(true);
    expect(comparisonMarkdown(preview.plan.comparisons[0])).toContain('합성 데모입니다');
  });

  it('id가 겹치면 새 id로 복사하고 과제·비교 참조를 함께 바꾸며, 기존 기록은 그대로다', () => {
    const existing = mergeDemo(structuredClone(EMPTY_PRACTICE_DATA));
    const before = JSON.stringify(existing);
    const file = buildExport(existing, { runs: existing.runs, comparisons: existing.comparisons });
    const preview = previewImport(JSON.stringify(file), existing);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const { plan } = preview;
    expect(plan.renamed).toBe(1 + 3 + 1);
    const newTaskId = plan.tasks[0].id;
    expect(newTaskId).not.toBe(existing.tasks[0].id);
    expect(plan.runs.every((run) => run.taskId === newTaskId)).toBe(true);
    const newRunIds = plan.runs.map((run) => run.id);
    expect(newRunIds.some((id) => existing.runs.some((run) => run.id === id))).toBe(false);
    expect(plan.comparisons[0].runIds).toEqual(newRunIds);
    expect(plan.comparisons[0].runs.map((run) => run.id)).toEqual(newRunIds);
    const merged = applyImport(existing, plan);
    expect(merged.runs).toHaveLength(6);
    expect(JSON.stringify(existing)).toBe(before);
  });

  it('잘못된 참조·지원하지 않는 버전·너무 큰 파일·깨진 항목은 아무것도 저장하지 않고 오류를 알린다', () => {
    const existing = mergeDemo(structuredClone(EMPTY_PRACTICE_DATA));
    const file = buildExport(existing, { runs: existing.runs, comparisons: [] });
    const cases: [string, RegExp][] = [
      [JSON.stringify({ ...file, tasks: [] }), /파일에 없는 과제/],
      [JSON.stringify({ ...file, version: 2 }), /지원하지 않는 파일 버전/],
      [JSON.stringify({ ...file, format: 'other' }), /실습 기록 파일이 아니에요/],
      ['x'.repeat(IMPORT_SIZE_LIMIT + 1), /너무 커요/],
      ['{', /JSON 형식이 아니에요/],
      [JSON.stringify({ ...file, runs: [...file.runs, { dataVersion: 1, id: 'bad' }] }), /기록 4번/],
      [JSON.stringify({ ...file, runs: [file.runs[0], file.runs[0]] }), /id가 겹치는 기록/],
    ];
    for (const [text, pattern] of cases) {
      const preview = previewImport(text, existing);
      expect(preview.ok).toBe(false);
      if (!preview.ok) expect(preview.error).toMatch(pattern);
    }
  });

  it('내보내기 전에 결과 본문·발췌·환경 정보를 뺄 수 있고, 뺀 항목이 파일에 적힌다', () => {
    const demo = mergeDemo(structuredClone(EMPTY_PRACTICE_DATA));
    const file = buildExport(demo, { runs: demo.runs, comparisons: demo.comparisons }, { body: false, excerpts: false, environment: false });
    expect(file.omitted).toEqual(['결과 본문', '증거 발췌와 성공 조건 근거', '환경과 도구 버전']);
    const all = [...file.runs, ...file.comparisons.flatMap((comparison) => comparison.runs)];
    expect(all.every((run) => run.result.body === '' && run.input.environment === '' && run.input.toolVersion === '')).toBe(true);
    expect(all.flatMap((run) => run.events.flatMap((event) => event.evidence)).some((item) => item.kind === 'excerpt')).toBe(false);
    // 원본은 그대로다
    expect(demo.runs[0].result.body).not.toBe('');
    expect(buildExport(demo, { runs: demo.runs, comparisons: [] }, FULL_EXPORT).omitted).toEqual([]);
  });
});

describe('평가 기준', () => {
  it('기본 기준 네 가지에 0~3점 설명이 모두 있다', () => {
    const rubric = defaultRubric();
    expect(rubric.criteria.map((item) => item.name)).toEqual(['근거 정확성', '조사 범위', '완료 기준 충족', '협업 기여']);
    expect(rubric.criteria.every((item) => item.levels.every((level) => level.length > 0))).toBe(true);
  });
});

describe('실습 기록 화면 주소', async () => {
  const { parseRoute } = await import('../router');
  it('목록·만들기·상세·비교 주소를 읽고, 기존 주소는 그대로다', () => {
    expect(parseRoute('#/runs')).toEqual({ page: 'runs' });
    expect(parseRoute('#/runs/new')).toEqual({ page: 'run-new' });
    expect(parseRoute('#/runs/new?recipe=builtin-graphrag-feasibility')).toEqual({ page: 'run-new', recipeId: 'builtin-graphrag-feasibility' });
    expect(parseRoute('#/runs/new?task=task-1')).toEqual({ page: 'run-new', taskId: 'task-1' });
    expect(parseRoute('#/run/run-1')).toEqual({ page: 'run', id: 'run-1' });
    expect(parseRoute('#/compare/c-1')).toEqual({ page: 'compare', id: 'c-1' });
    expect(parseRoute('#/recipe/x')).toEqual({ page: 'preview', id: 'x' });
    expect(parseRoute('#r=abc')).toEqual({ page: 'shared', encoded: 'abc' });
  });
});
