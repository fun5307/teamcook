// 실습 기록과 비교 묶음을 JSON 파일로 내보내고 가져온다.
// - 내보내기: 고른 기록·비교와, 그것들이 가리키는 과제를 함께 담는다. 결과 본문·발췌·환경 정보는 빼고 내보낼 수 있다.
// - 가져오기: 먼저 전부 검사한다. 하나라도 잘못되면 아무것도 저장하지 않는다 (부분 덮어쓰기 없음).
//   이미 있는 id와 겹치면 새 id로 복사하고, 안쪽 참조(과제, 파생 원본, 비교 묶음)를 함께 바꾼다.
// 레시피 공유 링크에는 실습 기록을 넣지 않는다.

import { newId } from '../id';
import { parseComparison, parseRun, parseTask, PracticeFormatError } from './schema';
import { nowIso } from './time';
import { PRACTICE_DATA_VERSION, type Comparison, type PracticeData, type PracticeRun, type PracticeTask } from './types';

export const EXPORT_FORMAT = 'teamcook-practice';
/** 가져올 수 있는 파일 크기 (저장 공간 한도보다 작게) */
export const IMPORT_SIZE_LIMIT = 1_000_000;
const MAX_IMPORT_ITEMS = 300;

export interface ExportOptions {
  /** 결과 본문 포함 */
  body: boolean;
  /** 증거 발췌·성공 조건 근거 포함 */
  excerpts: boolean;
  /** 환경·도구 버전 포함 */
  environment: boolean;
}

export const FULL_EXPORT: ExportOptions = { body: true, excerpts: true, environment: true };

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof PRACTICE_DATA_VERSION;
  exportedAt: string;
  /** 빼고 내보낸 항목 (가져온 쪽에서 비어 있는 이유를 알 수 있게) */
  omitted: string[];
  tasks: PracticeTask[];
  runs: PracticeRun[];
  comparisons: Comparison[];
}

function redact(run: PracticeRun, options: ExportOptions): PracticeRun {
  const copy = structuredClone(run);
  if (!options.body) copy.result.body = '';
  if (!options.excerpts) {
    copy.events = copy.events.map((event) => ({
      ...event,
      evidence: event.evidence.filter((item) => item.kind !== 'excerpt'),
    }));
    copy.result.checks = copy.result.checks.map((check) => ({ ...check, evidence: '' }));
  }
  if (!options.environment) {
    copy.input.environment = '';
    copy.input.toolVersion = '';
  }
  return copy;
}

export function omittedLabels(options: ExportOptions): string[] {
  const list: string[] = [];
  if (!options.body) list.push('결과 본문');
  if (!options.excerpts) list.push('증거 발췌와 성공 조건 근거');
  if (!options.environment) list.push('환경과 도구 버전');
  return list;
}

/** 내보낼 파일을 만든다. 기록과 비교가 가리키는 과제는 자동으로 함께 넣는다. */
export function buildExport(
  data: Pick<PracticeData, 'tasks'>,
  selection: { runs: PracticeRun[]; comparisons: Comparison[] },
  options: ExportOptions = FULL_EXPORT,
): ExportFile {
  const runs = selection.runs.map((run) => redact(run, options));
  const comparisons = selection.comparisons.map((comparison) => ({
    ...structuredClone(comparison),
    runs: comparison.runs.map((run) => redact(run, options)),
  }));
  const taskIds = new Set(
    [...runs, ...comparisons.flatMap((comparison) => comparison.runs)]
      .map((run) => run.taskId)
      .filter((id): id is string => Boolean(id)),
  );
  return {
    format: EXPORT_FORMAT,
    version: PRACTICE_DATA_VERSION,
    exportedAt: nowIso(),
    omitted: omittedLabels(options),
    tasks: data.tasks.filter((task) => taskIds.has(task.id)).map((task) => structuredClone(task)),
    runs,
    comparisons,
  };
}

export interface ImportPlan {
  tasks: PracticeTask[];
  runs: PracticeRun[];
  comparisons: Comparison[];
  /** 겹쳐서 새 id를 받은 항목 수 */
  renamed: number;
  warnings: string[];
  omitted: string[];
}

export type ImportPreview = { ok: true; plan: ImportPlan } | { ok: false; error: string };

/**
 * 파일 내용을 검사하고, 저장할 모양으로 바꾼다. 저장은 하지 않는다.
 * 실패하면 이유를 돌려주고, 기존 데이터는 그대로다.
 */
export function previewImport(text: string, existing: PracticeData): ImportPreview {
  try {
    return { ok: true, plan: planImport(text, existing) };
  } catch (error) {
    if (error instanceof PracticeFormatError) return { ok: false, error: error.message };
    return { ok: false, error: '파일을 읽지 못했어요.' };
  }
}

function planImport(text: string, existing: PracticeData): ImportPlan {
  if (text.length > IMPORT_SIZE_LIMIT) {
    throw new PracticeFormatError(
      `파일이 너무 커요(${Math.round(text.length / 1000).toLocaleString()}KB). ${IMPORT_SIZE_LIMIT / 1000_000}MB까지 가져올 수 있어요.`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PracticeFormatError('JSON 형식이 아니에요. teamcook에서 내보낸 실습 기록 파일인지 확인해 주세요.');
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== EXPORT_FORMAT) {
    throw new PracticeFormatError('teamcook 실습 기록 파일이 아니에요.');
  }
  const file = raw as Record<string, unknown>;
  if (typeof file.version !== 'number' || file.version > PRACTICE_DATA_VERSION || file.version < 1) {
    throw new PracticeFormatError('지원하지 않는 파일 버전이에요. 페이지를 새로고침한 뒤 다시 시도해 보세요.');
  }
  const arrays = ['tasks', 'runs', 'comparisons'].map((key) => (Array.isArray(file[key]) ? (file[key] as unknown[]) : []));
  const total = arrays.reduce((sum, items) => sum + items.length, 0);
  if (total === 0) throw new PracticeFormatError('파일에 가져올 기록이 없어요.');
  if (total > MAX_IMPORT_ITEMS) {
    throw new PracticeFormatError(`항목이 너무 많아요(${total}개). 한 번에 ${MAX_IMPORT_ITEMS}개까지 가져올 수 있어요.`);
  }

  const name = (index: number, what: string) => `${what} ${index + 1}번`;
  const wrap = <T>(fn: () => T, label: string): T => {
    try {
      return fn();
    } catch (error) {
      throw new PracticeFormatError(`${label}: ${(error as Error).message}`);
    }
  };
  const tasks = arrays[0].map((item, index) => wrap(() => parseTask(item), name(index, '과제')));
  const runs = arrays[1].map((item, index) => wrap(() => parseRun(item, 'import'), name(index, '기록')));
  const comparisons = arrays[2].map((item, index) =>
    wrap(() => parseComparison(item, 'import'), name(index, '비교 묶음')),
  );

  // 파일 안에서 같은 id가 두 번 나오면 어느 것을 가리키는지 알 수 없다
  for (const [items, what] of [
    [tasks, '과제'],
    [runs, '기록'],
    [comparisons, '비교 묶음'],
  ] as const) {
    const ids = items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new PracticeFormatError(`파일 안에 id가 겹치는 ${what}이 있어요.`);
  }

  // 참조 검사: 기록이 가리키는 과제는 파일 안에 있어야 한다
  const taskIds = new Set(tasks.map((task) => task.id));
  const allRuns = [...runs, ...comparisons.flatMap((comparison) => comparison.runs)];
  for (const run of allRuns) {
    if (run.taskId && !taskIds.has(run.taskId)) {
      throw new PracticeFormatError(`기록 "${run.title}"이 파일에 없는 과제를 가리켜요.`);
    }
  }
  const warnings: string[] = [];
  const fileRunIds = new Set(runs.map((run) => run.id));
  for (const run of allRuns) {
    if (run.derivedFrom && !fileRunIds.has(run.derivedFrom)) {
      delete run.derivedFrom;
      if (!warnings.includes('파생 원본 기록이 파일에 없어 연결을 지웠어요.')) {
        warnings.push('파생 원본 기록이 파일에 없어 연결을 지웠어요.');
      }
    }
  }

  // id 바꾸기: 이미 있는 id와 겹치면 새 id. 같은 id는 어디서 나오든 같은 새 id로 바꾼다.
  const taskMap = new Map<string, string>();
  const runMap = new Map<string, string>();
  const existingTasks = new Set(existing.tasks.map((task) => task.id));
  const existingRuns = new Set([
    ...existing.runs.map((run) => run.id),
    ...existing.comparisons.flatMap((comparison) => comparison.runs.map((run) => run.id)),
  ]);
  const existingComparisons = new Set(existing.comparisons.map((comparison) => comparison.id));
  for (const task of tasks) if (existingTasks.has(task.id)) taskMap.set(task.id, newId('task'));
  for (const run of allRuns) if (existingRuns.has(run.id) && !runMap.has(run.id)) runMap.set(run.id, newId('run'));
  let renamed = taskMap.size + runMap.size;

  const importedAt = nowIso();
  const remapRun = (run: PracticeRun): PracticeRun => {
    const next = { ...run, id: runMap.get(run.id) ?? run.id, importedAt };
    if (next.taskId) next.taskId = taskMap.get(next.taskId) ?? next.taskId;
    if (next.derivedFrom) next.derivedFrom = runMap.get(next.derivedFrom) ?? next.derivedFrom;
    return next;
  };
  const outTasks = tasks.map((task) => ({ ...task, id: taskMap.get(task.id) ?? task.id }));
  const outRuns = runs.map(remapRun);
  const outComparisons = comparisons.map((comparison) => {
    const collides = existingComparisons.has(comparison.id);
    if (collides) renamed += 1;
    const snapshotRuns = comparison.runs.map(remapRun);
    return {
      ...comparison,
      id: collides ? newId('compare') : comparison.id,
      runs: snapshotRuns,
      runIds: snapshotRuns.map((run) => run.id),
      importedAt,
    };
  });
  const omitted = Array.isArray(file.omitted)
    ? file.omitted.filter((item): item is string => typeof item === 'string').slice(0, 10)
    : [];
  return { tasks: outTasks, runs: outRuns, comparisons: outComparisons, renamed, warnings, omitted };
}

/** 검사를 마친 계획을 기존 데이터 뒤에 붙인 새 묶음을 만든다 (기존 항목은 바꾸지 않는다). */
export function applyImport(existing: PracticeData, plan: ImportPlan): PracticeData {
  return {
    ...existing,
    tasks: [...existing.tasks, ...plan.tasks],
    runs: [...plan.runs, ...existing.runs],
    comparisons: [...plan.comparisons, ...existing.comparisons],
  };
}
