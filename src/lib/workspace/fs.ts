// 사용자가 고른 프로젝트 폴더를 읽고 쓰는 얇은 층.
// 브라우저의 File System Access API(Chrome·Edge)가 주는 폴더 손잡이를 그대로 받는다.
// 테스트에서는 같은 모양의 메모리 폴더(createMemoryDir)를 쓴다.
// 서버로 보내는 것은 없다. 읽고 쓰는 것은 모두 사용자의 컴퓨터 안에서 일어난다.

export interface FileData {
  text(): Promise<string>;
  size?: number;
  lastModified?: number;
  stream?: () => ReadableStream<Uint8Array>;
  slice?: (start?: number, end?: number) => { text(): Promise<string> };
}

export interface FileLike {
  kind: 'file';
  name: string;
  getFile(): Promise<FileData>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

export interface DirLike {
  kind: 'directory';
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileLike>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterable<[string, DirLike | FileLike]>;
}

const parts = (path: string) => path.split('/').filter(Boolean);

/** 'a/b' 같은 경로의 폴더. 없으면 null (create를 주면 만든다). */
export async function getDir(root: DirLike, path: string, create = false): Promise<DirLike | null> {
  let dir = root;
  for (const name of parts(path)) {
    try {
      dir = await dir.getDirectoryHandle(name, { create });
    } catch {
      return null;
    }
  }
  return dir;
}

/** 파일 내용. 없으면 null. */
export async function readText(root: DirLike, path: string): Promise<string | null> {
  const names = parts(path);
  const fileName = names.pop();
  if (!fileName) return null;
  const dir = await getDir(root, names.join('/'));
  if (!dir) return null;
  try {
    const handle = await dir.getFileHandle(fileName);
    return await (await handle.getFile()).text();
  } catch {
    return null;
  }
}

/** 파일을 쓴다. 중간 폴더가 없으면 만든다. */
export async function writeText(root: DirLike, path: string, text: string): Promise<void> {
  const names = parts(path);
  const fileName = names.pop();
  if (!fileName) throw new Error('파일 이름이 없어요.');
  const dir = await getDir(root, names.join('/'), true);
  if (!dir) throw new Error(`폴더를 만들지 못했어요: ${names.join('/')}`);
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function removeFile(root: DirLike, path: string): Promise<void> {
  const names = parts(path);
  const fileName = names.pop();
  if (!fileName) return;
  const dir = await getDir(root, names.join('/'));
  if (dir) await dir.removeEntry(fileName);
}

/** 폴더 바로 아래의 파일들 (이름순) */
export async function listFiles(dir: DirLike): Promise<FileLike[]> {
  const files: FileLike[] = [];
  for await (const [, entry] of dir.entries()) {
    if (entry.kind === 'file') files.push(entry);
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listDirs(dir: DirLike): Promise<DirLike[]> {
  const dirs: DirLike[] = [];
  for await (const [, entry] of dir.entries()) {
    if (entry.kind === 'directory') dirs.push(entry);
  }
  return dirs.sort((a, b) => a.name.localeCompare(b.name));
}

// ───────────────────────── 테스트용 메모리 폴더 ─────────────────────────

class NotFound extends Error {
  name = 'NotFoundError';
}

class MemoryFile implements FileLike {
  kind = 'file' as const;
  constructor(
    public name: string,
    public content: string,
  ) {}
  async getFile(): Promise<FileData> {
    const content = this.content;
    return { text: async () => content, size: content.length, lastModified: 0 };
  }
  async createWritable() {
    let next = '';
    return {
      write: async (data: string) => {
        next += data;
      },
      close: async () => {
        this.content = next;
      },
    };
  }
}

class MemoryDir implements DirLike {
  kind = 'directory' as const;
  children = new Map<string, MemoryDir | MemoryFile>();
  constructor(public name: string) {}
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const found = this.children.get(name);
    if (found instanceof MemoryDir) return found;
    if (found || !options?.create) throw new NotFound(name);
    const dir = new MemoryDir(name);
    this.children.set(name, dir);
    return dir;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    const found = this.children.get(name);
    if (found instanceof MemoryFile) return found;
    if (found || !options?.create) throw new NotFound(name);
    const file = new MemoryFile(name, '');
    this.children.set(name, file);
    return file;
  }
  async removeEntry(name: string) {
    if (!this.children.delete(name)) throw new NotFound(name);
  }
  async *entries(): AsyncIterable<[string, DirLike | FileLike]> {
    for (const [name, entry] of this.children) yield [name, entry];
  }
}

/** { '.codex/agents/a.toml': '...' } 같은 목록으로 메모리 폴더를 만든다 (테스트용) */
export async function createMemoryDir(name: string, files: Record<string, string> = {}): Promise<DirLike> {
  const root = new MemoryDir(name);
  for (const [path, content] of Object.entries(files)) await writeText(root, path, content);
  return root;
}

/** 메모리 폴더의 모든 파일을 { 경로: 내용 }으로 (테스트용) */
export async function dumpDir(dir: DirLike, prefix = ''): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for await (const [name, entry] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'file') out[path] = await (await entry.getFile()).text();
    else Object.assign(out, await dumpDir(entry, path));
  }
  return out;
}
