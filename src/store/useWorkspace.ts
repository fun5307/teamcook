// 사용자가 연 프로젝트 폴더와 기록 폴더. 폴더 손잡이는 브라우저(IndexedDB)에만 기억해 두고,
// 다음에 올 때 "다시 열기"를 누르면 브라우저가 권한을 다시 묻는다. 서버로 가는 것은 없다.
// 폴더 열기는 Chrome·Edge에서만 된다 (File System Access API).

import { create } from 'zustand';
import type { DirLike } from '@/lib/workspace/fs';
import { applyChanges, planSave, scanTeam, type ApplyResult, type FileChange, type TeamSnapshot } from '@/lib/workspace/team';
import type { AgentCard } from '@/types';

export type HandleKey = 'project' | 'claude-logs' | 'codex-logs';

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<DirLike>;
};
type PermissionHandle = DirLike & {
  queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<string>;
  requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<string>;
};

export const folderAccessSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ───────── 손잡이 기억하기 (IndexedDB) ─────────
const DB = 'teamcook-handles';
const STORE = 'handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function remember(key: HandleKey, handle: DirLike | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      if (handle) tx.objectStore(STORE).put(handle, key);
      else tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 기억하지 못해도 이번 방문에는 쓸 수 있다
  }
}

async function recall(key: HandleKey): Promise<DirLike | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as DirLike | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function allowed(handle: DirLike, mode: 'read' | 'readwrite', ask: boolean): Promise<boolean> {
  const target = handle as PermissionHandle;
  if (!target.queryPermission) return true;
  if ((await target.queryPermission({ mode })) === 'granted') return true;
  if (!ask || !target.requestPermission) return false;
  return (await target.requestPermission({ mode })) === 'granted';
}

/** 폴더 고르기 창을 연다. 사용자가 취소하면 null. */
export async function pickFolder(key: HandleKey, mode: 'read' | 'readwrite'): Promise<DirLike | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  try {
    const handle = await picker.call(window, { mode, id: `teamcook-${key}` });
    await remember(key, handle);
    return handle;
  } catch {
    return null;
  }
}

/** 지난번에 열었던 폴더. ask가 true면 권한을 다시 묻는다 (버튼을 눌렀을 때만 가능). */
export async function recallFolder(key: HandleKey, mode: 'read' | 'readwrite', ask: boolean): Promise<DirLike | null> {
  const handle = await recall(key);
  if (!handle) return null;
  try {
    return (await allowed(handle, mode, ask)) ? handle : null;
  } catch {
    return null;
  }
}

export async function recalledName(key: HandleKey): Promise<string | null> {
  return (await recall(key))?.name ?? null;
}

export const forgetFolder = (key: HandleKey) => remember(key, null);

// ───────── 열려 있는 프로젝트 ─────────
interface WorkspaceState {
  root: DirLike | null;
  snapshot: TeamSnapshot | null;
  /** 화면에서 고치고 있는 팀 (저장 전) */
  cards: AgentCard[];
  busy: boolean;
  error: string | null;
  /** 테스트·내부용: 이미 가진 폴더로 연다 */
  openWith: (root: DirLike) => Promise<void>;
  rescan: () => Promise<void>;
  close: () => void;
  setCards: (cards: AgentCard[]) => void;
  changes: () => { changes: FileChange[]; problems: string[] };
  save: () => Promise<ApplyResult | null>;
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  root: null,
  snapshot: null,
  cards: [],
  busy: false,
  error: null,

  openWith: async (root) => {
    set({ busy: true, error: null });
    try {
      const snapshot = await scanTeam(root);
      set({ root, snapshot, cards: snapshot.members.map((member) => member.card), busy: false });
    } catch (error) {
      set({ busy: false, error: `폴더를 읽지 못했어요: ${(error as Error).message}` });
    }
  },

  rescan: async () => {
    const { root } = get();
    if (root) await get().openWith(root);
  },

  close: () => {
    void forgetFolder('project');
    set({ root: null, snapshot: null, cards: [], error: null });
  },

  setCards: (cards) => set({ cards }),

  changes: () => {
    const { snapshot, cards } = get();
    return snapshot ? planSave(snapshot, cards) : { changes: [], problems: [] };
  },

  save: async () => {
    const { root } = get();
    const plan = get().changes();
    if (!root || plan.problems.length > 0 || plan.changes.length === 0) return null;
    set({ busy: true, error: null });
    try {
      const result = await applyChanges(root, plan.changes);
      // 쓴 뒤에는 폴더를 다시 읽어 화면과 파일을 맞춘다. 충돌한 파일이 있으면 고치던 내용은 사라지므로 화면에서 알린다.
      const snapshot = await scanTeam(root);
      set({ snapshot, cards: snapshot.members.map((member) => member.card), busy: false });
      return result;
    } catch (error) {
      set({ busy: false, error: `저장하지 못했어요: ${(error as Error).message}` });
      return null;
    }
  },
}));

/** 프로젝트 폴더를 고르고 연다. 성공하면 true. */
export async function openProject(): Promise<boolean> {
  const handle = await pickFolder('project', 'readwrite');
  if (!handle) return false;
  await useWorkspace.getState().openWith(handle);
  return useWorkspace.getState().root !== null;
}

/** 지난번 프로젝트를 다시 연다 (권한을 다시 묻는다). */
export async function reopenProject(): Promise<boolean> {
  const handle = await recallFolder('project', 'readwrite', true);
  if (!handle) return false;
  await useWorkspace.getState().openWith(handle);
  return useWorkspace.getState().root !== null;
}
