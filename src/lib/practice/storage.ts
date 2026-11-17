// 실습 기록을 브라우저(localStorage)에 저장하고 읽는다. 화면과 따로 둔 저장 API다.
// 레시피 저장소('agent-recipes')와 다른 이름을 써서 서로 덮어쓰지 않는다.
// 저장에 실패하면(용량 초과 등) 예외 대신 실패 결과를 돌려주고, 이전에 저장된 내용은 건드리지 않는다.

import { loadPracticeData } from './schema';
import { EMPTY_PRACTICE_DATA, type PracticeData } from './types';

export const PRACTICE_STORAGE_KEY = 'teamcook-practice';

/** 한 번에 저장할 수 있는 크기 (브라우저 저장 공간은 보통 5MB 안팎이고, 레시피도 같이 쓴다) */
export const PRACTICE_STORAGE_LIMIT = 3_000_000;

export type SaveResult = { ok: true } | { ok: false; reason: 'too-large' | 'storage-error'; message: string };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export interface LoadResult {
  data: PracticeData;
  /** 저장된 내용을 JSON으로 읽지 못했는지 (그 경우 원문은 덮어쓰지 않도록 따로 보관한다) */
  broken: string | null;
}

export function loadPractice(storage: StorageLike | null = defaultStorage()): LoadResult {
  if (!storage) return { data: structuredClone(EMPTY_PRACTICE_DATA), broken: null };
  let raw: string | null = null;
  try {
    raw = storage.getItem(PRACTICE_STORAGE_KEY);
  } catch {
    return { data: structuredClone(EMPTY_PRACTICE_DATA), broken: null };
  }
  if (!raw) return { data: structuredClone(EMPTY_PRACTICE_DATA), broken: null };
  try {
    return { data: loadPracticeData(JSON.parse(raw)), broken: null };
  } catch {
    // 원문을 버리지 않고 '읽지 못한 항목'으로 둔다. 다음 저장 때도 그대로 남는다.
    return { data: { ...structuredClone(EMPTY_PRACTICE_DATA), unreadable: [raw] }, broken: raw };
  }
}

/** 전체 묶음을 저장한다. 실패하면 저장소는 이전 상태 그대로다. */
export function savePractice(data: PracticeData, storage: StorageLike | null = defaultStorage()): SaveResult {
  if (!storage) {
    return { ok: false, reason: 'storage-error', message: '이 브라우저에서는 저장 공간을 쓸 수 없어요.' };
  }
  const json = JSON.stringify(data);
  if (json.length > PRACTICE_STORAGE_LIMIT) {
    return {
      ok: false,
      reason: 'too-large',
      message: `저장할 내용이 너무 커요(${Math.round(json.length / 1000).toLocaleString()}KB, 한도 ${PRACTICE_STORAGE_LIMIT / 1000_000}MB). 긴 결과 본문을 줄이거나 오래된 기록을 JSON으로 내보낸 뒤 정리해 주세요.`,
    };
  }
  try {
    storage.setItem(PRACTICE_STORAGE_KEY, json);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'storage-error',
      message: '브라우저 저장 공간에 저장하지 못했어요(공간 부족이거나 저장이 막혀 있어요). 바뀐 내용은 저장되지 않았습니다.',
    };
  }
}
