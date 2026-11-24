// 내 컴퓨터 도우미(teamcook open)와 이야기하는 쪽.
// 도우미가 띄운 화면이면 주소에 일회용 열쇠(?key=)가 붙어 온다. 열쇠는 이 탭(sessionStorage)에만 두고 주소에서 지운다.
// 도우미 너머의 폴더는 브라우저 폴더 손잡이와 같은 모양(DirLike)으로 쓴다. 그래서 팀 읽기·저장·업무 일지 코드를 그대로 쓴다.
// 웹사이트(Vercel)에서 열면 열쇠가 없으므로 아무것도 묻지 않고, 지금처럼 폴더 고르기로 동작한다.

import type { ActivitySummary } from '../journal/activity';
import type { DirLike, FileData, FileLike } from '../workspace/fs';

export type LocalRoot = 'project' | 'claude-logs' | 'codex-logs';

export interface LocalInfo {
  version: number;
  claude: { path: string; exists: boolean };
  codex: { path: string; exists: boolean };
  project: { path: string; name: string } | null;
  zstd: boolean;
}

export interface RecentProject {
  path: string;
  name: string;
  lastUsed: number;
  claudeSessions: number;
  codexSessions: number;
  exists: boolean;
}

export interface LocalEvent {
  root: LocalRoot;
  files: string[];
}

const KEY_STORE = 'teamcook-local-key';
let key: string | null = null;
let base = '';
let info: LocalInfo | null = null;

/** 도우미가 띄운 화면인지 알아본다. 화면을 그리기 전에 한 번 부른다. */
export async function initLocal(): Promise<LocalInfo | null> {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('key');
  let stored: string | null = null;
  try {
    if (fromUrl) sessionStorage.setItem(KEY_STORE, fromUrl);
    stored = sessionStorage.getItem(KEY_STORE);
  } catch {
    // 저장소를 못 써도 이번 화면에서는 주소의 열쇠를 쓴다
  }
  key = fromUrl ?? stored;
  if (fromUrl) {
    params.delete('key');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }
  if (!key) return null;
  try {
    info = await request<LocalInfo>('/api/hello');
  } catch {
    info = null;
  }
  return info;
}

/** 테스트용: 브라우저 밖에서 도우미 주소와 열쇠를 정해 준다 */
export async function connectLocal(url: string, givenKey: string): Promise<LocalInfo> {
  base = url.replace(/\/$/, '');
  key = givenKey;
  info = await request<LocalInfo>('/api/hello');
  return info;
}

export const isLocal = () => info !== null;
export const localInfo = () => info;

class LocalError extends Error {
  name = 'NotFoundError';
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    if (status !== 404) this.name = 'LocalError';
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${base}${path}`, { ...init, headers: { ...(init.headers ?? {}), 'x-teamcook-key': key ?? '' } });
  if (!response.ok) {
    let message = `도우미가 거절했어요 (${response.status}).`;
    try {
      message = ((await response.json()) as { error?: string }).error ?? message;
    } catch {
      // 본문이 없으면 기본 문구
    }
    throw new LocalError(message, response.status);
  }
  return response;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await (await call(path, init)).json()) as T;
}

const query = (root: LocalRoot, path: string) => `root=${root}&path=${encodeURIComponent(path)}`;
const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

interface Meta {
  /** none = 없음 */
  kind: 'file' | 'directory' | 'none';
  size: number;
  mtime: number;
}

class LocalFile implements FileLike {
  kind = 'file' as const;
  constructor(
    private root: LocalRoot,
    private path: string,
    public name: string,
    private meta?: Meta,
  ) {}

  async getFile(): Promise<FileData> {
    const meta = this.meta ?? (await request<Meta>(`/api/fs/stat?${query(this.root, this.path)}`));
    if (meta.kind !== 'file') throw new LocalError(`${this.name}이(가) 없어요.`, 404);
    const url = `/api/fs/read?${query(this.root, this.path)}`;
    return {
      size: meta.size,
      lastModified: meta.mtime,
      text: async () => (await call(url)).text(),
      stream: () => {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        return new ReadableStream<Uint8Array>({
          async pull(controller) {
            reader ??= (await call(url)).body!.getReader();
            const { done, value } = await reader.read();
            if (done) controller.close();
            else controller.enqueue(value);
          },
          cancel() {
            void reader?.cancel();
          },
        });
      },
    };
  }

  async createWritable() {
    let buffer = '';
    const target = `/api/fs/write?${query(this.root, this.path)}`;
    return {
      write: async (data: string) => {
        buffer += data;
      },
      close: async () => {
        await call(target, { method: 'PUT', body: buffer, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      },
    };
  }
}

class LocalDir implements DirLike {
  kind = 'directory' as const;
  constructor(
    private root: LocalRoot,
    private path: string,
    public name: string,
  ) {}

  private async meta(path: string): Promise<Meta> {
    return request<Meta>(`/api/fs/stat?${query(this.root, path)}`);
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirLike> {
    const path = join(this.path, name);
    // 만들기는 파일을 쓸 때 도우미가 중간 폴더를 함께 만든다
    if (!options?.create) {
      const meta = await this.meta(path);
      if (meta.kind !== 'directory') throw new LocalError(`${name}은(는) 폴더가 아니에요.`, 404);
    }
    return new LocalDir(this.root, path, name);
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileLike> {
    const path = join(this.path, name);
    try {
      const meta = await this.meta(path);
      if (meta.kind !== 'file') throw new LocalError(`${name}은(는) 파일이 아니에요.`, 404);
      return new LocalFile(this.root, path, name, meta);
    } catch (error) {
      if (options?.create && (error as LocalError).status === 404) return new LocalFile(this.root, path, name);
      throw error;
    }
  }

  async removeEntry(name: string): Promise<void> {
    await call(`/api/fs/remove?${query(this.root, join(this.path, name))}`, { method: 'DELETE' });
  }

  async *entries(): AsyncIterable<[string, DirLike | FileLike]> {
    const list = await request<(Meta & { name: string })[]>(`/api/fs/list?${query(this.root, this.path)}`);
    for (const item of list) {
      const path = join(this.path, item.name);
      yield [item.name, item.kind === 'directory' ? new LocalDir(this.root, path, item.name) : new LocalFile(this.root, path, item.name, item)];
    }
  }
}

/** 도우미 너머의 폴더. project는 먼저 selectProject로 골라 둬야 한다. */
export function localDir(root: LocalRoot, name?: string): DirLike {
  const fallback = root === 'project' ? (info?.project?.name ?? 'project') : root === 'claude-logs' ? 'projects' : 'sessions';
  return new LocalDir(root, '', name ?? fallback);
}

/** 고른 프로젝트에서 AI가 한 일의 요약 (도우미가 기록을 읽어 만든다) */
export const fetchActivity = () => request<ActivitySummary>('/api/activity');

export const recentProjects = (fresh = false) => request<RecentProject[]>(`/api/projects${fresh ? '?fresh=1' : ''}`);

export async function selectProject(path: string): Promise<{ path: string; name: string }> {
  const project = await request<{ path: string; name: string }>('/api/project', {
    method: 'POST',
    body: JSON.stringify({ path }),
    headers: { 'content-type': 'application/json' },
  });
  if (info) info = { ...info, project };
  return project;
}

export async function closeProject(): Promise<void> {
  await call('/api/project', { method: 'DELETE' });
  if (info) info = { ...info, project: null };
}

/** 기록·역할 파일이 바뀌면 알려 준다. 돌려주는 함수를 부르면 그만 듣는다. */
export function subscribeLocal(onEvent: (event: LocalEvent) => void): () => void {
  if (!info || typeof EventSource === 'undefined') return () => {};
  const source = new EventSource(`${base}/api/events?key=${encodeURIComponent(key ?? '')}`);
  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data as string) as LocalEvent);
    } catch {
      // 모르는 알림은 무시한다
    }
  };
  return () => source.close();
}

/** 경로 비교용: 대소문자·구분자·끝의 / 차이를 없앤다 (Windows 경로는 대소문자를 가리지 않는다) */
export const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
