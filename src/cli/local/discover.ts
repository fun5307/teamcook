// 최근에 AI를 쓴 프로젝트 찾기. Claude Code·Codex의 대화 기록 파일 앞부분에서 작업 폴더(cwd)만 꺼낸다.
// 대화 내용은 읽지 않는다: 파일마다 cwd가 나올 때까지 앞의 몇 줄만 읽고 닫는다.

import { createReadStream, existsSync, statSync, type Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import * as zlib from 'node:zlib';

export interface RecentProject {
  path: string;
  name: string;
  /** 마지막으로 기록이 바뀐 때 (ms) */
  lastUsed: number;
  claudeSessions: number;
  codexSessions: number;
  /** 지금도 그 폴더가 있는가 */
  exists: boolean;
}

type ZstdZlib = typeof zlib & { createZstdDecompress?: () => NodeJS.ReadWriteStream };
/** 이 Node에 압축 풀기(zstd)가 들어 있는가 (Node 22.15·23.8부터) */
export const zstdSupported = () => typeof (zlib as ZstdZlib).createZstdDecompress === 'function';

export function openLogStream(file: string): Readable {
  const raw = createReadStream(file);
  if (!file.endsWith('.zst')) return raw;
  const unzip = (zlib as ZstdZlib).createZstdDecompress!();
  raw.on('error', (error) => unzip.destroy(error));
  return raw.pipe(unzip) as unknown as Readable;
}

/** 앞에서부터 줄을 읽다가 pick이 값을 돌려주면 멈춘다 */
export async function firstMatch<T>(file: string, maxLines: number, pick: (entry: Record<string, unknown>) => T | undefined): Promise<T | undefined> {
  let stream: Readable;
  try {
    stream = openLogStream(file);
  } catch {
    return undefined;
  }
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let count = 0;
  try {
    for await (const line of lines) {
      count += 1;
      if (count > maxLines) break;
      try {
        const found = pick(JSON.parse(line) as Record<string, unknown>);
        if (found !== undefined) return found;
      } catch {
        // 깨진 줄은 건너뛴다
      }
    }
  } catch {
    return undefined;
  } finally {
    lines.close();
    stream.destroy();
  }
  return undefined;
}

const keyOf = (dir: string) => path.resolve(dir).replace(/[\\/]+$/, '').toLowerCase();

async function safeDirents(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

interface Hit {
  cwd: string;
  mtime: number;
  tool: 'claude' | 'codex';
}

async function claudeHits(projectsDir: string): Promise<Hit[]> {
  const hits: Hit[] = [];
  for (const entry of await safeDirents(projectsDir)) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(projectsDir, entry.name);
    const files: { file: string; mtime: number }[] = [];
    for (const child of await safeDirents(dir)) {
      if (!child.isFile() || !child.name.endsWith('.jsonl')) continue;
      try {
        files.push({ file: path.join(dir, child.name), mtime: (await stat(path.join(dir, child.name))).mtimeMs });
      } catch {
        // 지워졌으면 건너뛴다
      }
    }
    files.sort((a, b) => b.mtime - a.mtime);
    // 가장 최근 대화 몇 개에서만 작업 폴더를 찾는다
    let cwd: string | undefined;
    for (const item of files.slice(0, 3)) {
      cwd = await firstMatch(item.file, 60, (line) => (typeof line.cwd === 'string' ? line.cwd : undefined));
      if (cwd) break;
    }
    if (!cwd) continue;
    for (const item of files) hits.push({ cwd, mtime: item.mtime, tool: 'claude' });
  }
  return hits;
}

export async function codexFiles(dir: string, depth: number, out: string[]): Promise<void> {
  for (const entry of await safeDirents(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && (entry.name.endsWith('.jsonl') || (entry.name.endsWith('.jsonl.zst') && zstdSupported()))) out.push(full);
    else if (entry.isDirectory() && depth > 0) await codexFiles(full, depth - 1, out);
  }
}

async function codexHits(sessionsDir: string, limit: number): Promise<Hit[]> {
  const files: string[] = [];
  await codexFiles(sessionsDir, 3, files);
  // 'rollout-날짜시각-…' 이름이라 이름순이 시간순이다
  files.sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
  const hits: Hit[] = [];
  for (const file of files.slice(0, limit)) {
    const meta = await firstMatch(file, 3, (line) => {
      if (line.type !== 'session_meta') return undefined;
      const payload = (line.payload ?? {}) as Record<string, unknown>;
      return { cwd: typeof payload.cwd === 'string' ? payload.cwd : '', child: Boolean(payload.parent_thread_id) };
    });
    // 팀원(서브에이전트)의 기록은 부모 대화에 딸린 것이라 세지 않는다
    if (!meta?.cwd || meta.child) continue;
    try {
      hits.push({ cwd: meta.cwd, mtime: statSync(file).mtimeMs, tool: 'codex' });
    } catch {
      // 지워졌으면 건너뛴다
    }
  }
  return hits;
}

/** 두 도구의 기록을 합쳐 최근 프로젝트 목록을 만든다 */
export async function discoverProjects(claudeProjects: string, codexSessions: string, options: { limit?: number; codexFiles?: number } = {}): Promise<RecentProject[]> {
  const hits = [...(await claudeHits(claudeProjects)), ...(await codexHits(codexSessions, options.codexFiles ?? 400))];
  const byPath = new Map<string, RecentProject>();
  for (const hit of hits) {
    const key = keyOf(hit.cwd);
    let item = byPath.get(key);
    if (!item) {
      const resolved = path.resolve(hit.cwd);
      item = { path: resolved, name: path.basename(resolved) || resolved, lastUsed: 0, claudeSessions: 0, codexSessions: 0, exists: false };
      byPath.set(key, item);
    }
    item.lastUsed = Math.max(item.lastUsed, hit.mtime);
    if (hit.tool === 'claude') item.claudeSessions += 1;
    else item.codexSessions += 1;
  }
  const list = [...byPath.values()].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, options.limit ?? 30);
  for (const item of list) {
    try {
      item.exists = existsSync(item.path) && statSync(item.path).isDirectory();
    } catch {
      item.exists = false;
    }
  }
  return list;
}
