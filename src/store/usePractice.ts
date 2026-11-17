// 실습 기록 저장소. 레시피 저장소(useStore)와 따로 있다.
// 모든 변경은 commit 하나를 거친다: 먼저 브라우저에 저장해 보고, 성공했을 때만 화면 상태를 바꾼다.
// 저장에 실패하면 화면도 저장소도 이전 그대로이고, 실패 이유를 돌려준다 (성공 메시지를 띄우지 않게).

import { create } from 'zustand';
import { newId } from '@/lib/id';
import { mergeDemo } from '@/lib/practice/demo';
import { createRun, createTask, deriveRun } from '@/lib/practice/model';
import { loadPractice, savePractice, type SaveResult } from '@/lib/practice/storage';
import { nowIso } from '@/lib/practice/time';
import { applyImport, type ImportPlan } from '@/lib/practice/transfer';
import { PRACTICE_DATA_VERSION, type Comparison, type PracticeData, type PracticeRun, type PracticeTask } from '@/lib/practice/types';

interface PracticeState extends PracticeData {
  /** 마지막 저장 실패 (성공하면 비운다) */
  saveError: string | null;
  commit: (change: (data: PracticeData) => PracticeData) => SaveResult;
}

function dataOf(state: PracticeData): PracticeData {
  return {
    version: state.version,
    tasks: state.tasks,
    runs: state.runs,
    comparisons: state.comparisons,
    unreadable: state.unreadable,
  };
}

export const usePractice = create<PracticeState>()((set, get) => ({
  ...loadPractice().data,
  saveError: null,
  commit: (change) => {
    const next = change(dataOf(get()));
    const result = savePractice(next);
    if (result.ok) set({ ...next, saveError: null });
    else set({ saveError: result.message });
    return result;
  },
}));

// ───────────────────────── 화면에서 부르는 동작 ─────────────────────────

const commit = (change: (data: PracticeData) => PracticeData) => usePractice.getState().commit(change);

/** 새 과제(또는 기존 과제)와 새 기록을 함께 저장한다 */
export function saveNewRun(run: PracticeRun, task: PracticeTask, taskIsNew: boolean): SaveResult {
  return commit((data) => ({
    ...data,
    tasks: taskIsNew ? [...data.tasks, task] : data.tasks,
    runs: [run, ...data.runs],
  }));
}

/** 기록 하나를 고친다. 수정 시각을 함께 남긴다. */
export function updateRun(id: string, change: (run: PracticeRun) => PracticeRun): SaveResult {
  return commit((data) => ({
    ...data,
    runs: data.runs.map((run) => (run.id === id ? { ...change(run), updatedAt: nowIso() } : run)),
  }));
}

export function setArchived(id: string, archived: boolean): SaveResult {
  return updateRun(id, (run) => ({ ...run, archived }));
}

/** 조건을 바꾸려고 새 기록을 파생한다. 새 기록의 id를 돌려준다. */
export function deriveAndSave(source: PracticeRun): { result: SaveResult; id: string } {
  const run = deriveRun(source);
  return { result: commit((data) => ({ ...data, runs: [run, ...data.runs] })), id: run.id };
}

/** 비교 묶음을 만든다. 고른 기록을 지금 모습 그대로 복사해 둔다. */
export function saveComparison(title: string, runs: PracticeRun[]): { result: SaveResult; id: string } {
  const now = nowIso();
  const comparison: Comparison = {
    dataVersion: PRACTICE_DATA_VERSION,
    id: newId('compare'),
    title,
    runIds: runs.map((run) => run.id),
    variables: [],
    conclusion: '',
    limits: '',
    createdAt: now,
    updatedAt: now,
    snapshotAt: now,
    runs: structuredClone(runs),
    demo: runs.every((run) => run.demo) ? true : undefined,
  };
  return { result: commit((data) => ({ ...data, comparisons: [comparison, ...data.comparisons] })), id: comparison.id };
}

export function updateComparison(id: string, change: (comparison: Comparison) => Comparison): SaveResult {
  return commit((data) => ({
    ...data,
    comparisons: data.comparisons.map((item) => (item.id === id ? { ...change(item), updatedAt: nowIso() } : item)),
  }));
}

/** 사용자가 명시적으로 누를 때만: 비교 묶음의 기록 복사본을 지금 원본으로 바꾼다. 원본이 없는 기록은 그대로 둔다. */
export function refreshComparison(id: string): SaveResult {
  return commit((data) => {
    const byId = new Map(data.runs.map((run) => [run.id, run]));
    return {
      ...data,
      comparisons: data.comparisons.map((item) => {
        if (item.id !== id) return item;
        const now = nowIso();
        return {
          ...item,
          runs: item.runs.map((snap) => structuredClone(byId.get(snap.id) ?? snap)),
          snapshotAt: now,
          updatedAt: now,
        };
      }),
    };
  });
}

export function importPlan(plan: ImportPlan): SaveResult {
  return commit((data) => applyImport(data, plan));
}

export function loadDemo(): SaveResult {
  return commit(mergeDemo);
}

export { createRun, createTask };
