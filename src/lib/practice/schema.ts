// 저장해 둔 실습 기록과 가져온 JSON 파일을 안전한 모양으로 다듬는다.
// 바깥에서 온 데이터는 믿지 않는다: 모양을 확인하고, 모르는 값은 '모름' 쪽으로 낮춘다.
// 특히 출처를 '자동 관측'으로 올리지 못하게 한다 (2차에는 자동 관측이 없다).

import { parseRecipe } from '../recipeSchema';
import { newId } from '../id';
import { isZonedIso } from './time';
import {
  PRACTICE_DATA_VERSION,
  type CheckState,
  type CollabEvent,
  type Comparison,
  type Correction,
  type Criterion,
  type EventType,
  type Evidence,
  type EvidenceKind,
  type Measure,
  type MetricKind,
  type OrderSnapshot,
  type Origin,
  type PracticeData,
  type PracticeRun,
  type PracticeTask,
  type Rubric,
  type RunInput,
  type RunResult,
  type RunStatus,
  type Score,
  type ScoreValue,
  type SourceRef,
  type SuccessCheck,
} from './types';

export class PracticeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PracticeFormatError';
  }
}

/** 어디서 읽는지. import면 출처가 '가져온 자료'로 표시된다. */
export type ParseMode = 'storage' | 'import';

const SHORT = 300;
const MEDIUM = 4000;
const LONG = 50000;
const MAX_LIST = 200;

const STATUSES: RunStatus[] = ['ready', 'recording', 'done', 'stopped'];
const CHECKS: CheckState[] = ['met', 'partial', 'unmet', 'unknown'];
const EVENTS: EventType[] = ['message', 'disagreement', 'reinvestigation', 'decision-change', 'user-intervention'];
const EVIDENCE: EvidenceKind[] = ['excerpt', 'url', 'note'];
const METRICS: MetricKind[] = ['elapsed', 'worker-time', 'tokens', 'cost', 'other'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, MAX_LIST) : [];
}
function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
function zoned(value: unknown): string | undefined {
  return isZonedIso(value) ? value : undefined;
}
function id(value: unknown, prefix: string, used?: Set<string>): string {
  let result = text(value, SHORT);
  if (!result || used?.has(result)) result = newId(prefix);
  used?.add(result);
  return result;
}

/**
 * 출처. '자동 관측'은 받아들이지 않는다: 저장된 것은 '확인 불가', 가져온 것은 '가져온 자료'로 낮춘다.
 * 가져온 파일 안의 '사용자 기록'은 '가져온 자료'로 바꾼다 (이 브라우저의 사용자가 적은 것이 아니므로).
 */
function origin(value: unknown, mode: ParseMode): Origin {
  if (mode === 'import') return value === 'unknown' ? 'unknown' : 'imported';
  if (value === 'user' || value === 'imported' || value === 'unknown') return value;
  return 'unknown';
}

function parseCriterion(value: unknown): Criterion | null {
  if (!isObject(value)) return null;
  const name = text(value.name, SHORT).trim();
  if (!name) return null;
  const levels = Array.isArray(value.levels) ? value.levels : [];
  const criterion: Criterion = {
    id: text(value.id, SHORT) || newId('crit'),
    name,
    description: text(value.description, MEDIUM),
    levels: [0, 1, 2, 3].map((index) => text(levels[index], MEDIUM)) as Criterion['levels'],
  };
  if (value.collaborative === true) criterion.collaborative = true;
  return criterion;
}

export function parseRubric(value: unknown): Rubric {
  if (!isObject(value)) throw new PracticeFormatError('평가 기준이 없어요.');
  const used = new Set<string>();
  const criteria: Criterion[] = [];
  for (const item of list(value.criteria)) {
    const criterion = parseCriterion(item);
    if (!criterion || used.has(criterion.id)) continue;
    used.add(criterion.id);
    criteria.push(criterion);
  }
  const version = typeof value.version === 'number' && Number.isInteger(value.version) ? value.version : 1;
  return { id: text(value.id, SHORT) || 'custom', version, criteria };
}

function parseInput(value: unknown): RunInput {
  const raw = isObject(value) ? value : {};
  return {
    text: text(raw.text, LONG),
    materials: text(raw.materials, MEDIUM),
    tool: text(raw.tool, SHORT),
    model: text(raw.model, SHORT),
    toolVersion: text(raw.toolVersion, SHORT),
    environment: text(raw.environment, SHORT),
  };
}

function parseSources(value: unknown): SourceRef[] {
  const used = new Set<string>();
  const result: SourceRef[] = [];
  for (const item of list(value)) {
    if (!isObject(item)) continue;
    const label = text(item.label, MEDIUM);
    const url = text(item.url, MEDIUM);
    if (!label.trim() && !url.trim()) continue;
    const source: SourceRef = { id: id(item.id, 'src', used), label };
    if (url) source.url = url;
    result.push(source);
  }
  return result;
}

/** 주문 복사본. 모양만 확인하고 글자로만 다룬다. */
export function parseOrderSnapshot(value: unknown): OrderSnapshot | undefined {
  if (!isObject(value)) return undefined;
  const orderId = text(value.orderId, SHORT);
  if (!orderId) return undefined;
  const items = (raw: unknown) => list(raw).filter(isObject);
  const strs = (raw: unknown) => list(raw).filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, MEDIUM));
  return {
    orderId,
    revision: typeof value.revision === 'number' && Number.isFinite(value.revision) ? value.revision : 1,
    title: text(value.title, SHORT),
    requestText: text(value.requestText, LONG),
    materials: items(value.materials).map((item) => ({ name: text(item.name, SHORT), kind: text(item.kind, 40), status: text(item.status, 40) })),
    requirements: items(value.requirements).map((item) => ({ kind: text(item.kind, 40), text: text(item.text, MEDIUM) })).filter((item) => item.text),
    work: items(value.work)
      .map((item) => ({ id: text(item.id, SHORT), title: text(item.title, SHORT), outputs: strs(item.outputs), criteria: strs(item.criteria) }))
      .filter((item) => item.id),
    open: strs(value.open),
  };
}

function parseResult(value: unknown): RunResult {
  const raw = isObject(value) ? value : {};
  const used = new Set<string>();
  const checks: SuccessCheck[] = [];
  for (const item of list(raw.checks)) {
    if (!isObject(item)) continue;
    const checkText = text(item.text, MEDIUM);
    if (!checkText.trim()) continue;
    checks.push({
      id: id(item.id, 'check', used),
      text: checkText,
      state: pick(item.state, CHECKS, 'unknown'),
      evidence: text(item.evidence, MEDIUM),
    });
  }
  const result: RunResult = {
    summary: text(raw.summary, MEDIUM),
    body: text(raw.body, LONG),
    sources: parseSources(raw.sources),
    checks,
    deviations: text(raw.deviations, MEDIUM),
    unresolved: text(raw.unresolved, MEDIUM),
  };
  if (Array.isArray(raw.workResults)) {
    result.workResults = list(raw.workResults)
      .filter(isObject)
      .map((item) => ({ workId: text(item.workId, SHORT), state: pick(item.state, CHECKS, 'unknown'), note: text(item.note, MEDIUM) }))
      .filter((item) => item.workId);
  }
  if (Array.isArray(raw.participants)) {
    result.participants = raw.participants.filter((item): item is string => typeof item === 'string').slice(0, 50);
  }
  return result;
}

function parseEvidence(value: unknown): Evidence[] {
  const used = new Set<string>();
  const result: Evidence[] = [];
  for (const item of list(value)) {
    if (!isObject(item)) continue;
    const body = text(item.text, MEDIUM);
    if (!body.trim()) continue;
    result.push({ id: id(item.id, 'ev', used), kind: pick(item.kind, EVIDENCE, 'note'), text: body });
  }
  return result;
}

function parseEvents(value: unknown, mode: ParseMode): CollabEvent[] {
  const used = new Set<string>();
  const result: CollabEvent[] = [];
  for (const item of list(value)) {
    if (!isObject(item)) continue;
    const event: CollabEvent = {
      id: id(item.id, 'event', used),
      type: pick(item.type, EVENTS, 'message'),
      description: text(item.description, MEDIUM),
      evidence: parseEvidence(item.evidence),
      origin: origin(item.origin, mode),
    };
    for (const key of ['from', 'to'] as const) {
      const field = text(item[key], SHORT);
      if (field) event[key] = field;
    }
    for (const key of ['addedEvidence', 'outcome'] as const) {
      const field = text(item[key], MEDIUM);
      if (field) event[key] = field;
    }
    const at = zoned(item.at);
    if (at) event.at = at;
    result.push(event);
  }
  return result;
}

function parseScores(value: unknown, criteria: Criterion[]): Score[] {
  const known = new Set(criteria.map((item) => item.id));
  const seen = new Set<string>();
  const result: Score[] = [];
  for (const item of list(value)) {
    if (!isObject(item)) continue;
    const criterionId = text(item.criterionId, SHORT);
    // 기준에 없는 점수, 같은 기준의 두 번째 점수는 버린다
    if (!known.has(criterionId) || seen.has(criterionId)) continue;
    const raw = item.value;
    let scoreValue: ScoreValue;
    if (raw === 0 || raw === 1 || raw === 2 || raw === 3 || raw === 'na') scoreValue = raw;
    else scoreValue = 'unknown';
    seen.add(criterionId);
    result.push({
      criterionId,
      value: scoreValue,
      rationale: text(item.rationale, MEDIUM),
      evaluator: text(item.evaluator, SHORT),
      evaluatedAt: zoned(item.evaluatedAt) ?? '',
    });
  }
  return result;
}

function parseMeasures(value: unknown, mode: ParseMode): Measure[] {
  const used = new Set<string>();
  const result: Measure[] = [];
  for (const item of list(value)) {
    if (!isObject(item)) continue;
    const raw = item.value;
    const measure: Measure = {
      id: id(item.id, 'measure', used),
      metric: pick(item.metric, METRICS, 'other'),
      // 숫자가 아니면 0이 아니라 '미확인'(null)으로 둔다
      value: typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
      unit: text(item.unit, 40),
      scope: text(item.scope, SHORT),
      source: text(item.source, SHORT),
      origin: origin(item.origin, mode),
    };
    const label = text(item.label, SHORT);
    if (label) measure.label = label;
    result.push(measure);
  }
  return result;
}

function parseCorrections(value: unknown): Correction[] {
  const used = new Set<string>();
  const result: Correction[] = [];
  for (const item of list(value)) {
    if (!isObject(item)) continue;
    const at = zoned(item.at);
    const reason = text(item.reason, MEDIUM);
    if (!at || !reason.trim()) continue;
    result.push({ id: id(item.id, 'fix', used), at, reason, area: item.area === 'note' ? 'note' : 'result' });
  }
  return result;
}

function checkVersion(value: unknown, what: string) {
  if (typeof value !== 'number') throw new PracticeFormatError(`${what}의 데이터 버전이 없어요.`);
  if (value > PRACTICE_DATA_VERSION) {
    throw new PracticeFormatError(`${what}이 더 새로운 버전에서 만들어졌어요. 페이지를 새로고침한 뒤 다시 시도해 보세요.`);
  }
  if (value < 1) throw new PracticeFormatError(`알 수 없는 ${what} 데이터 버전이에요.`);
}

/** 실습 기록 한 건. 형식이 맞지 않으면 PracticeFormatError를 던진다. */
export function parseRun(raw: unknown, mode: ParseMode = 'storage'): PracticeRun {
  if (!isObject(raw)) throw new PracticeFormatError('실습 기록 데이터가 아니에요.');
  checkVersion(raw.dataVersion, '실습 기록');
  const runId = text(raw.id, SHORT);
  if (!runId) throw new PracticeFormatError('실습 기록에 id가 없어요.');
  const createdAt = zoned(raw.createdAt);
  if (!createdAt) throw new PracticeFormatError('실습 기록의 만든 시각이 없거나 시간대가 없어요.');
  const rubric = parseRubric(raw.rubric);
  const kind = raw.kind === 'single' ? 'single' : 'recipe';

  const run: PracticeRun = {
    dataVersion: PRACTICE_DATA_VERSION,
    id: runId,
    title: text(raw.title, SHORT).trim() || '이름 없는 기록',
    createdAt,
    updatedAt: zoned(raw.updatedAt) ?? createdAt,
    status: pick(raw.status, STATUSES, 'ready'),
    archived: raw.archived === true,
    kind,
    input: parseInput(raw.input),
    rubric,
    result: parseResult(raw.result),
    events: parseEvents(raw.events, mode),
    scores: parseScores(raw.scores, rubric.criteria),
    measures: parseMeasures(raw.measures, mode),
    corrections: parseCorrections(raw.corrections),
  };
  const taskId = text(raw.taskId, SHORT);
  if (taskId) run.taskId = taskId;
  const order = parseOrderSnapshot(raw.order);
  if (order) run.order = order;
  const derivedFrom = text(raw.derivedFrom, SHORT);
  if (derivedFrom) run.derivedFrom = derivedFrom;
  if (raw.demo === true) run.demo = true;
  const importedAt = zoned(raw.importedAt);
  if (importedAt) run.importedAt = importedAt;
  for (const key of ['startedAt', 'endedAt'] as const) {
    const at = zoned(raw[key]);
    if (at) run[key] = at;
  }

  if (kind === 'recipe') {
    const snapshot = isObject(raw.snapshot) ? raw.snapshot : null;
    if (!snapshot) throw new PracticeFormatError('레시피 기반 기록에 당시 레시피(스냅샷)가 없어요.');
    try {
      const recipe = parseRecipe(snapshot.recipe);
      run.snapshot = {
        sourceId: text(snapshot.sourceId, SHORT) || recipe.id,
        sourceSchemaVersion:
          typeof snapshot.sourceSchemaVersion === 'number' ? snapshot.sourceSchemaVersion : recipe.schemaVersion,
        recipe,
      };
    } catch (error) {
      throw new PracticeFormatError(`당시 레시피를 읽지 못했어요: ${(error as Error).message}`);
    }
  }
  return run;
}

export function parseTask(raw: unknown): PracticeTask {
  if (!isObject(raw)) throw new PracticeFormatError('비교 과제 데이터가 아니에요.');
  const taskId = text(raw.id, SHORT);
  if (!taskId) throw new PracticeFormatError('비교 과제에 id가 없어요.');
  return {
    id: taskId,
    title: text(raw.title, SHORT).trim() || '이름 없는 과제',
    input: text(raw.input, LONG),
    materials: text(raw.materials, MEDIUM),
    rubric: parseRubric(raw.rubric),
    ...(parseOrderSnapshot(raw.order) ? { order: parseOrderSnapshot(raw.order) } : {}),
    successCriteria: list(raw.successCriteria)
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map((item) => item.slice(0, MEDIUM)),
    createdAt: zoned(raw.createdAt) ?? '',
  };
}

export function parseComparison(raw: unknown, mode: ParseMode = 'storage'): Comparison {
  if (!isObject(raw)) throw new PracticeFormatError('비교 묶음 데이터가 아니에요.');
  checkVersion(raw.dataVersion, '비교 묶음');
  const comparisonId = text(raw.id, SHORT);
  if (!comparisonId) throw new PracticeFormatError('비교 묶음에 id가 없어요.');
  const runs = list(raw.runs).map((item) => parseRun(item, mode));
  if (runs.length < 2) throw new PracticeFormatError('비교 묶음에는 기록이 2개 이상 있어야 해요.');
  const createdAt = zoned(raw.createdAt);
  if (!createdAt) throw new PracticeFormatError('비교 묶음의 만든 시각이 없어요.');
  const comparison: Comparison = {
    dataVersion: PRACTICE_DATA_VERSION,
    id: comparisonId,
    title: text(raw.title, SHORT).trim() || '이름 없는 비교',
    runIds: runs.map((run) => run.id),
    variables: list(raw.variables)
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.slice(0, SHORT)),
    conclusion: text(raw.conclusion, LONG),
    limits: text(raw.limits, LONG),
    createdAt,
    updatedAt: zoned(raw.updatedAt) ?? createdAt,
    snapshotAt: zoned(raw.snapshotAt) ?? createdAt,
    runs,
  };
  if (raw.demo === true) comparison.demo = true;
  const importedAt = zoned(raw.importedAt);
  if (importedAt) comparison.importedAt = importedAt;
  return comparison;
}

/**
 * 브라우저에 저장된 묶음 전체를 읽는다. 읽지 못한 항목은 버리지 않고 unreadable에 둔다.
 * 전에 못 읽어 둔 것도 다시 읽어 본다 (새 버전에서 읽힐 수 있다).
 */
export function loadPracticeData(raw: unknown): PracticeData {
  const data: PracticeData = { version: PRACTICE_DATA_VERSION, tasks: [], runs: [], comparisons: [], unreadable: [] };
  if (!isObject(raw)) return data;
  const retry = Array.isArray(raw.unreadable) ? raw.unreadable : [];
  const groups: [unknown[], (item: unknown) => void][] = [
    [Array.isArray(raw.tasks) ? raw.tasks : [], (item) => data.tasks.push(parseTask(item))],
    [Array.isArray(raw.runs) ? raw.runs : [], (item) => data.runs.push(parseRun(item))],
    [Array.isArray(raw.comparisons) ? raw.comparisons : [], (item) => data.comparisons.push(parseComparison(item))],
  ];
  for (const [items, add] of groups) {
    for (const item of items) {
      try {
        add(item);
      } catch {
        data.unreadable.push(item);
      }
    }
  }
  // 예전에 못 읽은 것: 종류를 알 수 없으므로 모양으로 짐작해 다시 넣어 본다
  for (const item of retry) {
    try {
      if (isObject(item) && 'runs' in item) data.comparisons.push(parseComparison(item));
      else if (isObject(item) && 'dataVersion' in item) data.runs.push(parseRun(item));
      else data.tasks.push(parseTask(item));
    } catch {
      data.unreadable.push(item);
    }
  }
  // 같은 id가 두 번 들어간 경우 앞의 것만 남긴다 (중복 이관 방지)
  data.tasks = uniqueById(data.tasks);
  data.runs = uniqueById(data.runs);
  data.comparisons = uniqueById(data.comparisons);
  return data;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}
