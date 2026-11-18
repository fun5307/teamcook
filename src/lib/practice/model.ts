// 실습 기록을 만들고 고치는 규칙 (화면과 상관없는 순수 함수).
// - 기록을 만들 때 레시피·입력·평가 기준을 깊은 복사로 떠 둔다. 원본을 고치거나 지워도 기록은 그대로다.
// - 기록을 시작한 뒤에는 입력·레시피·평가 기준을 고치지 않고, 새 기록을 파생해 만든다.
// - 기록을 만드는 것만으로는 아무것도 '성공'으로 표시되지 않는다. 결과와 점수는 사람이 적는다.

import { collaborationOf } from '../../data/collaboration';
import type { Recipe } from '../../types';
import { newId } from '../id';
import { defaultRubric, METRIC_UNITS } from './rubric';
import { isZonedIso, nowIso } from './time';
import {
  PRACTICE_DATA_VERSION,
  type Measure,
  type OrderSnapshot,
  type PracticeRun,
  type PracticeTask,
  type Rubric,
  type RunInput,
  type RunStatus,
  type SuccessCheck,
} from './types';

export const EMPTY_INPUT: RunInput = {
  text: '',
  materials: '',
  tool: '',
  model: '',
  toolVersion: '',
  environment: '',
};

/** 새 비교 과제. 같은 과제로 다시 기록할 때 입력·자료 조건·평가 기준·성공 조건을 이것에서 가져온다. */
export function createTask(fields: {
  title: string;
  input: string;
  materials: string;
  rubric?: Rubric;
  successCriteria?: string[];
  order?: OrderSnapshot;
}): PracticeTask {
  return {
    id: newId('task'),
    title: fields.title.trim() || firstLine(fields.input) || '이름 없는 과제',
    input: fields.input,
    materials: fields.materials,
    rubric: structuredClone(fields.rubric ?? defaultRubric()),
    successCriteria: [...(fields.successCriteria ?? [])],
    ...(fields.order ? { order: structuredClone(fields.order) } : {}),
    createdAt: nowIso(),
  };
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0].slice(0, 60);
}

function checksFrom(criteria: string[] | undefined): SuccessCheck[] {
  return (criteria ?? [])
    .filter((text) => text.trim())
    .map((text) => ({ id: newId('check'), text, state: 'unknown', evidence: '' }));
}

/**
 * 새 기록. recipe가 있으면 레시피 기반, 없으면 단일 AI 기록이다.
 * 성공 조건은 과제에 적힌 것을 쓰고(같은 과제의 다른 기록과 같은 조건), 과제에 없으면 레시피의 것을 쓴다.
 * 모든 성공 조건은 '확인 불가'로 시작한다 (기록을 만드는 것만으로 충족되지 않는다).
 */
export function createRun(options: {
  title?: string;
  recipe?: Recipe;
  task: PracticeTask;
  input: RunInput;
}): PracticeRun {
  const { recipe, task } = options;
  const now = nowIso();
  const criteria = task.successCriteria.length > 0 ? task.successCriteria : recipe?.successCriteria;
  const run: PracticeRun = {
    dataVersion: PRACTICE_DATA_VERSION,
    id: newId('run'),
    title: options.title?.trim() || (recipe ? `${recipe.title} 실습` : '단일 AI 실습'),
    createdAt: now,
    updatedAt: now,
    taskId: task.id,
    status: 'ready',
    archived: false,
    kind: recipe ? 'recipe' : 'single',
    input: { ...options.input, text: task.input, materials: task.materials },
    rubric: structuredClone(task.rubric),
    result: {
      summary: '',
      body: '',
      sources: [],
      checks: checksFrom(criteria),
      deviations: '',
      unresolved: '',
    },
    events: [],
    scores: [],
    measures: [],
    corrections: [],
  };
  if (task.order) {
    run.order = structuredClone(task.order);
    run.result.workResults = task.order.work.map((item) => ({ workId: item.id, state: 'unknown', note: '' }));
  }
  if (recipe) {
    run.snapshot = {
      sourceId: recipe.id,
      sourceSchemaVersion: recipe.schemaVersion,
      recipe: structuredClone(recipe),
    };
  }
  return run;
}

/**
 * 조건을 바꾸기 위해 새 기록을 파생한다. 레시피 스냅샷·입력·평가 기준은 그대로 복사하고,
 * 결과·사건·점수·측정은 복사하지 않는다.
 */
export function deriveRun(source: PracticeRun): PracticeRun {
  const now = nowIso();
  return {
    ...structuredClone(source),
    id: newId('run'),
    title: `${source.title} (조건 변경)`,
    createdAt: now,
    updatedAt: now,
    status: 'ready',
    archived: false,
    demo: undefined,
    importedAt: undefined,
    derivedFrom: source.id,
    result: {
      summary: '',
      body: '',
      sources: [],
      checks: source.result.checks.map((check) => ({ ...check, id: newId('check'), state: 'unknown', evidence: '' })),
      ...(source.result.workResults ? { workResults: source.result.workResults.map((item) => ({ ...item, state: 'unknown' as const, note: '' })) } : {}),
      deviations: '',
      unresolved: '',
    },
    events: [],
    scores: [],
    startedAt: undefined,
    endedAt: undefined,
    measures: [],
    corrections: [],
  };
}

/** 입력·레시피·평가 기준을 고칠 수 있는지. 기록을 시작하면(준비가 아니면) 잠긴다. */
export function conditionsLocked(run: Pick<PracticeRun, 'status'>): boolean {
  return run.status !== 'ready';
}

/** 결과·평가를 고칠 때 정정 이유가 필요한지. 완료한 기록을 고치면 이유를 남긴다. */
export function needsCorrectionReason(run: Pick<PracticeRun, 'status'>): boolean {
  return run.status === 'done';
}

export const STATUS_ORDER: RunStatus[] = ['ready', 'recording', 'done', 'stopped'];

/** 기록 목록 필터에서 쓰는 '방식' 이름: 단일 AI 또는 레시피의 조리법 */
export type RunStyle = 'single' | 'subagents' | 'agent-team' | 'debate';

export function runStyle(run: PracticeRun): RunStyle {
  if (run.kind === 'single' || !run.snapshot) return 'single';
  return collaborationOf(run.snapshot.recipe);
}

export const RUN_STYLE_LABELS: Record<RunStyle, string> = {
  single: '단일 AI',
  subagents: '서브에이전트',
  'agent-team': '에이전트 팀',
  debate: '토론형',
};

// ───────────────────────── 측정값 검사 ─────────────────────────

export interface MeasureProblem {
  measureId?: string;
  message: string;
}

/**
 * 측정값과 시작·끝 시각을 검사한다. 값이 비어 있는 것(미확인)은 문제가 아니다.
 * - 음수, 숫자가 아닌 값, 지표에 맞지 않는 단위, 소수 토큰
 * - 끝 시각이 시작 시각보다 앞섬
 * - 금액에 통화가 없음, 토큰·금액에 범위가 없음
 */
export function measureProblems(run: Pick<PracticeRun, 'measures' | 'startedAt' | 'endedAt'>): MeasureProblem[] {
  const problems: MeasureProblem[] = [];
  if (run.startedAt && !isZonedIso(run.startedAt)) problems.push({ message: '시작 시각 형식이 잘못됐어요.' });
  if (run.endedAt && !isZonedIso(run.endedAt)) problems.push({ message: '끝 시각 형식이 잘못됐어요.' });
  if (
    run.startedAt &&
    run.endedAt &&
    isZonedIso(run.startedAt) &&
    isZonedIso(run.endedAt) &&
    Date.parse(run.endedAt) < Date.parse(run.startedAt)
  ) {
    problems.push({ message: '끝 시각이 시작 시각보다 앞서요.' });
  }
  for (const measure of run.measures) {
    problems.push(...singleMeasureProblems(measure).map((message) => ({ measureId: measure.id, message })));
  }
  return problems;
}

export function singleMeasureProblems(measure: Measure): string[] {
  const list: string[] = [];
  const units = METRIC_UNITS[measure.metric];
  if (measure.value !== null) {
    if (!Number.isFinite(measure.value)) list.push('값이 숫자가 아니에요.');
    else if (measure.value < 0) list.push('값은 0보다 작을 수 없어요.');
    else if (measure.metric === 'tokens' && !Number.isInteger(measure.value)) list.push('토큰 수는 정수로 적어 주세요.');
  }
  if (units.length > 0 && !units.includes(measure.unit)) list.push(`단위는 ${units.join(', ')} 가운데 하나여야 해요.`);
  if (measure.metric === 'other' && !measure.label?.trim()) list.push('지표 이름을 적어 주세요.');
  if ((measure.metric === 'tokens' || measure.metric === 'cost') && measure.value !== null && !measure.scope.trim()) {
    list.push('무엇을 센 값인지(범위)를 적어 주세요. 도구마다 세는 방식이 달라요.');
  }
  return list;
}

/** 시작·끝 시각이 모두 있으면 그 사이의 분. 하나라도 없거나 순서가 틀리면 null (미확인). */
export function elapsedMinutesFromTimes(run: Pick<PracticeRun, 'startedAt' | 'endedAt'>): number | null {
  if (!run.startedAt || !run.endedAt || !isZonedIso(run.startedAt) || !isZonedIso(run.endedAt)) return null;
  const diff = Date.parse(run.endedAt) - Date.parse(run.startedAt);
  if (diff < 0) return null;
  return Math.round(diff / 60000);
}

/** 화면·보고서용 측정값 문자열. 값이 없으면 '미확인' (0으로 바꾸지 않는다). */
export function measureValueText(measure: Measure): string {
  if (measure.value === null) return '미확인';
  return `${measure.value.toLocaleString('ko-KR')} ${measure.unit}`.trim();
}

/** 참여자 id를 이름으로. 스냅샷 카드 id, 'main', 'user', 또는 자유 입력 */
export function participantName(run: PracticeRun, id: string | undefined): string {
  if (!id) return '';
  if (id === 'main') return '메인 AI';
  if (id === 'user') return '사용자';
  const card = run.snapshot?.recipe.cards.find((item) => item.id === id);
  return card ? card.displayName || card.name : id;
}
