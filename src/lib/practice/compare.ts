// 비교 조건을 따진다. 과제 id가 같다는 것만으로 '동일 조건'이라고 하지 않는다:
// 실제 입력 원문·자료 조건·평가 기준을 하나하나 비교하고, 도구·모델 등의 차이도 숨기지 않는다.
// 점수를 더하거나 순위를 매기거나 승자를 고르지 않는다.

import { participantName, runStyle, RUN_STYLE_LABELS } from './model';
import { rubricSignature } from './rubric';
import type { Comparison, Measure, MetricKind, PracticeRun } from './types';

export type ConditionKey =
  | 'input'
  | 'materials'
  | 'rubric'
  | 'checks'
  | 'style'
  | 'recipe'
  | 'tool'
  | 'model'
  | 'toolVersion'
  | 'environment';

/** 같아야 '동일 조건'이 되는 조건. 실험 변수로 고를 수 없다. */
export const CORE_CONDITIONS: ConditionKey[] = ['input', 'materials', 'rubric', 'checks'];
/** 일부러 바꾼 '실험 변수'로 고를 수 있는 조건 */
export const VARIABLE_CONDITIONS: ConditionKey[] = ['style', 'recipe', 'tool', 'model', 'toolVersion', 'environment'];

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  input: '입력 원문',
  materials: '자료 조건',
  rubric: '평가 기준',
  checks: '성공 조건',
  style: '방식',
  recipe: '레시피',
  tool: '도구',
  model: '모델',
  toolVersion: '도구 버전',
  environment: '환경',
};

/** 화면에 보일 값. 빈 값은 '' (확인 불가로 표시). */
export function conditionValue(run: PracticeRun, key: ConditionKey): string {
  switch (key) {
    case 'input':
      return run.input.text.trim();
    case 'materials':
      return run.input.materials.trim();
    case 'rubric':
      return `${run.rubric.criteria.map((item) => item.name).join(', ')} (v${run.rubric.version})`;
    case 'checks':
      return run.result.checks.map((check) => check.text).join(' / ');
    case 'style':
      return RUN_STYLE_LABELS[runStyle(run)];
    case 'recipe':
      return run.snapshot ? run.snapshot.recipe.title : '레시피 없음 (단일 AI)';
    default:
      return run.input[key].trim();
  }
}

/** 비교에 쓰는 값. 평가 기준은 이름이 아니라 내용 전체로 비교한다. */
function compareKey(run: PracticeRun, key: ConditionKey): string {
  if (key === 'rubric') return rubricSignature(run.rubric);
  if (key === 'recipe') return run.snapshot ? JSON.stringify(run.snapshot.recipe) : '';
  if (key === 'checks') return JSON.stringify(run.result.checks.map((check) => check.text.trim()));
  return conditionValue(run, key);
}

export type ConditionState = 'same' | 'different' | 'unknown';

export interface ConditionRow {
  key: ConditionKey;
  label: string;
  values: string[];
  state: ConditionState;
  /** 사용자가 일부러 바꾼 조건으로 표시했는지 (차이는 그대로 보인다) */
  variable: boolean;
}

export interface ConditionReport {
  rows: ConditionRow[];
  /** 같아야 하는데 다르거나 확인할 수 없는 조건, 그리고 실험 변수로 고르지 않은 차이 */
  problems: ConditionRow[];
  /** 모든 조건이 같거나, 다른 것은 모두 실험 변수로 고른 것일 때만 true */
  sameCondition: boolean;
  /** 평가 기준이 모두 같아 항목별로 나란히 놓을 수 있는지 */
  rubricComparable: boolean;
}

export function compareConditions(runs: PracticeRun[], variables: string[] = []): ConditionReport {
  const rows: ConditionRow[] = [...CORE_CONDITIONS, ...VARIABLE_CONDITIONS].map((key) => {
    const values = runs.map((run) => conditionValue(run, key));
    const keys = runs.map((run) => compareKey(run, key));
    // 레시피는 단일 AI 기록에 없는 게 정상이라 '확인 불가'로 보지 않는다
    const unknown = key !== 'recipe' && key !== 'checks' && values.some((value) => value === '');
    const state: ConditionState = unknown ? 'unknown' : new Set(keys).size === 1 ? 'same' : 'different';
    const variable = VARIABLE_CONDITIONS.includes(key) && variables.includes(key);
    return { key, label: CONDITION_LABELS[key], values, state, variable };
  });
  const problems = rows.filter((row) => row.state === 'unknown' || (row.state === 'different' && !row.variable));
  const rubricRow = rows.find((row) => row.key === 'rubric');
  return {
    rows,
    problems,
    sameCondition: runs.length >= 2 && problems.length === 0,
    rubricComparable: rubricRow?.state === 'same',
  };
}

/** 비교 묶음의 머리말 한 줄: 기록 수, 조건 종류. 한 번의 결과를 일반적 우위로 읽지 않게 함께 보여 준다. */
export function comparisonScopeLine(comparison: Comparison): string {
  const report = compareConditions(comparison.runs, comparison.variables);
  const kind = report.sameCondition ? '동일 조건 비교' : '탐색용 비교 (조건이 다르거나 확인되지 않음)';
  return `기록 ${comparison.runs.length}개, 방식마다 실행 1회씩 · ${kind}. 이 결과만으로 어느 방식이 일반적으로 낫다고 말할 수 없어요.`;
}

/** 스냅샷 뒤에 원본 기록이 바뀌었는지. 원본이 없으면(가져온 비교 등) 따지지 않는다. */
export function staleRunIds(comparison: Comparison, currentRuns: PracticeRun[]): string[] {
  const byId = new Map(currentRuns.map((run) => [run.id, run]));
  return comparison.runs
    .filter((snap) => {
      const current = byId.get(snap.id);
      return current !== undefined && current.updatedAt !== snap.updatedAt;
    })
    .map((snap) => snap.id);
}

// ───────────────────────── 측정값 비교 ─────────────────────────

export interface MeasureCell {
  measures: Measure[];
}

export interface MeasureRow {
  metric: MetricKind;
  label: string;
  cells: MeasureCell[];
  /** 단위나 범위가 달라 직접 견주면 안 되는지 */
  incomparable: boolean;
}

/** 지표별로 기록마다 적힌 측정값을 모은다. 값을 더하거나 환산하지 않는다. */
export function measureRows(runs: PracticeRun[]): MeasureRow[] {
  const labels = new Map<string, MetricKind>();
  for (const run of runs) {
    for (const measure of run.measures) {
      const label = measure.metric === 'other' ? measure.label || '기타' : measure.metric;
      labels.set(label, measure.metric);
    }
  }
  return [...labels.entries()].map(([label, metric]) => {
    const cells = runs.map((run) => ({
      measures: run.measures.filter((measure) =>
        metric === 'other' ? measure.metric === 'other' && (measure.label || '기타') === label : measure.metric === metric,
      ),
    }));
    const known = cells.flatMap((cell) => cell.measures).filter((measure) => measure.value !== null);
    const incomparable =
      new Set(known.map((measure) => measure.unit)).size > 1 ||
      ((metric === 'tokens' || metric === 'cost') && new Set(known.map((measure) => measure.scope.trim())).size > 1) ||
      cells.some((cell) => cell.measures.length > 1);
    return { metric, label, cells, incomparable };
  });
}

/** 협업 사건을 "누가 → 누구" 형태로 */
export function eventRoute(run: PracticeRun, from?: string, to?: string): string {
  const a = participantName(run, from);
  const b = participantName(run, to);
  if (a && b) return `${a} → ${b}`;
  return a || b || '';
}
