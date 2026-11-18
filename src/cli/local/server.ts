// 내 컴퓨터 도우미 서버 (teamcook open).
// - 이 컴퓨터 안에서만 열린다 (127.0.0.1). 같은 와이파이의 다른 컴퓨터도 들어올 수 없다.
// - 화면 파일은 누구나 받아도 되지만, 폴더를 읽고 쓰는 /api/는 실행할 때 만든 일회용 열쇠가 있어야 한다.
//   열쇠는 브라우저 주소로만 건네고, 다른 웹사이트는 열쇠를 모르니 아무것도 물어볼 수 없다.
// - 무엇을 읽고 쓸 수 있는지는 policy.ts가 정한다. 아무것도 실행하지 않고, 바깥으로 보내지 않는다.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, watch, type FSWatcher } from 'node:fs';
import { mkdir, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { discoverProjects, openLogStream, zstdSupported, type RecentProject } from './discover';
import { canOpenDir, canReadFile, canRemove, canSee, canWrite, isLogFile, ROOT_IDS, splitPath, type RootId } from './policy';

export interface ServerOptions {
  /** 화면 파일(dist) 폴더. 없으면 /api만 연다 (테스트용) */
  uiDir: string | null;
  port: number;
  claudeProjects: string;
  codexSessions: string;
  /** 실시간 알림을 켤지 (테스트에서는 끈다) */
  watch?: boolean;
  /** 테스트용으로 열쇠를 정해 줄 때 */
  key?: string;
}

export interface LocalServer {
  url: string;
  key: string;
  port: number;
  close(): Promise<void>;
}

interface Project {
  path: string;
  name: string;
}

const MAX_WRITE = 2 * 1024 * 1024;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage, limit = MAX_WRITE): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, '파일이 너무 커요 (2MB까지).');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sameKey(given: string | undefined | null, key: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 심볼릭 링크 등으로 기준 폴더 밖을 가리키면 거절한다 */
async function staysInside(base: string, full: string): Promise<boolean> {
  let probe = full;
  while (!existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return false;
    probe = parent;
  }
  try {
    const [real, realBase] = await Promise.all([realpath(probe), realpath(base)]);
    return real === realBase || real.startsWith(realBase + path.sep);
  } catch {
    return false;
  }
}

export async function startLocalServer(options: ServerOptions): Promise<LocalServer> {
  const key = options.key ?? randomBytes(24).toString('hex');
  let project: Project | null = null;
  let port = options.port;
  let recentCache: { at: number; list: RecentProject[] } | null = null;
  const zstd = zstdSupported();

  const baseOf = (root: RootId): string => {
    if (root === 'claude-logs') return options.claudeProjects;
    if (root === 'codex-logs') return options.codexSessions;
    if (!project) throw new HttpError(409, '아직 연 프로젝트가 없어요.');
    return project.path;
  };

  const target = async (url: URL) => {
    const root = url.searchParams.get('root') as RootId;
    if (!ROOT_IDS.includes(root)) throw new HttpError(400, '알 수 없는 폴더예요.');
    const parts = splitPath(url.searchParams.get('path') ?? '');
    if (!parts) throw new HttpError(400, '이상한 경로예요.');
    const base = baseOf(root);
    const full = path.join(base, ...parts);
    if (!(await staysInside(base, full))) throw new HttpError(403, '이 폴더 밖은 열지 않아요.');
    return { root, parts, base, full };
  };

  /** Codex의 압축 기록은 .zst를 뗀 이름으로 보여 주고, 읽을 때 풀어 준다 */
  const logFileOf = (root: RootId, full: string) => {
    if (root === 'codex-logs' && zstd && !existsSync(full) && existsSync(`${full}.zst`)) return `${full}.zst`;
    return full;
  };

  const statOf = async (root: RootId, parts: string[], full: string) => {
    const real = logFileOf(root, full);
    let info;
    try {
      info = await stat(real);
    } catch {
      throw new HttpError(404, '없어요.');
    }
    if (info.isDirectory()) {
      if (!canOpenDir(root, parts)) throw new HttpError(403, '이 폴더는 열지 않아요.');
      return { kind: 'directory' as const, size: 0, mtime: info.mtimeMs };
    }
    if (!info.isFile() || !canReadFile(root, parts)) throw new HttpError(403, '이 파일은 읽지 않아요.');
    return { kind: 'file' as const, size: info.size, mtime: info.mtimeMs };
  };

  // ───────── 실시간 알림 (Server-Sent Events) ─────────
  /** 역할 파일들의 이름·수정 시각·크기. 이게 바뀌면 밖에서 고친 것이다. */
  let signature: string | null = null;
  const agentSignature = async (dir: string) => {
    const parts: string[] = [dir];
    for (const rel of ['.claude/agents', '.codex/agents']) {
      try {
        for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          const info = await stat(path.join(dir, rel, entry.name));
          parts.push(`${rel}/${entry.name}:${info.mtimeMs}:${info.size}`);
        }
      } catch {
        // 폴더가 없으면 빈 것으로 본다
      }
    }
    return parts.join('|');
  };
  const listeners = new Set<http.ServerResponse>();
  const pending = new Map<RootId, Set<string>>();
  let flushTimer: NodeJS.Timeout | null = null;
  const queue = (root: RootId, rel: string) => {
    if (!pending.has(root)) pending.set(root, new Set());
    pending.get(root)!.add(rel);
    flushTimer ??= setTimeout(() => {
      flushTimer = null;
      for (const [id, files] of pending) {
        const data = `data: ${JSON.stringify({ root: id, files: [...files].slice(0, 50) })}\n\n`;
        for (const res of listeners) res.write(data);
      }
      pending.clear();
    }, 400);
  };
  const watchers: FSWatcher[] = [];
  const timers: NodeJS.Timeout[] = [];
  if (options.watch !== false) {
    for (const root of ['claude-logs', 'codex-logs'] as const) {
      const dir = baseOf(root);
      if (!existsSync(dir)) continue;
      try {
        watchers.push(
          watch(dir, { recursive: true }, (_event, filename) => {
            if (!filename) return;
            const rel = filename.toString().split(path.sep).join('/');
            const name = rel.split('/').pop() ?? '';
            if (isLogFile(root, name)) queue(root, rel.replace(/\.zst$/, ''));
          }),
        );
      } catch {
        // 이 컴퓨터가 폴더 지켜보기를 지원하지 않으면 실시간 알림 없이 동작한다
      }
    }
    // 프로젝트 역할 폴더는 작아서 1.5초마다 훑어본다 (node_modules 같은 큰 폴더를 지켜보지 않으려고)
    timers.push(
      setInterval(async () => {
        if (!project) return;
        const next = await agentSignature(project.path);
        if (project && signature !== null && next !== signature) queue('project', 'agents');
        signature = next;
      }, 1500),
    );
    timers.push(setInterval(() => listeners.forEach((res) => res.write(': still here\n\n')), 25_000));
  }

  // ───────── API ─────────
  const api = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
    const route = `${req.method} ${url.pathname}`;
    if (route === 'GET /api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': hello\n\n');
      listeners.add(res);
      req.on('close', () => listeners.delete(res));
      return;
    }
    if (route === 'GET /api/hello') {
      return send(res, 200, {
        version: 1,
        claude: { path: options.claudeProjects, exists: existsSync(options.claudeProjects) },
        codex: { path: options.codexSessions, exists: existsSync(options.codexSessions) },
        project,
        zstd,
      });
    }
    if (route === 'GET /api/projects') {
      if (!recentCache || Date.now() - recentCache.at > 10_000 || url.searchParams.has('fresh')) {
        recentCache = { at: Date.now(), list: await discoverProjects(options.claudeProjects, options.codexSessions) };
      }
      return send(res, 200, recentCache.list);
    }
    if (route === 'POST /api/project') {
      let wanted: unknown;
      try {
        wanted = (JSON.parse(await readBody(req, 8192)) as { path?: unknown }).path;
      } catch {
        throw new HttpError(400, '경로를 읽지 못했어요.');
      }
      if (typeof wanted !== 'string' || !path.isAbsolute(wanted)) throw new HttpError(400, '폴더의 전체 경로를 넣어 주세요. 예: C:\\work\\my-app');
      const resolved = path.resolve(wanted);
      let info;
      try {
        info = await stat(resolved);
      } catch {
        throw new HttpError(404, `폴더가 없어요: ${resolved}`);
      }
      if (!info.isDirectory()) throw new HttpError(400, '폴더가 아니에요.');
      project = { path: resolved, name: path.basename(resolved) || resolved };
      // 연 순간의 모습을 기억해 두어야, 바로 뒤에 밖에서 고친 것도 알아챈다
      signature = await agentSignature(resolved);
      return send(res, 200, project);
    }
    if (route === 'DELETE /api/project') {
      project = null;
      signature = null;
      return send(res, 200, { ok: true });
    }
    if (route === 'GET /api/fs/stat') {
      const { root, parts, full } = await target(url);
      // 없는 것은 오류가 아니라 흔한 대답이라 200으로 돌려준다 (브라우저 콘솔이 오류로 가득 차지 않게)
      try {
        return send(res, 200, await statOf(root, parts, full));
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return send(res, 200, { kind: 'none', size: 0, mtime: 0 });
        throw error;
      }
    }
    if (route === 'GET /api/fs/list') {
      const { root, parts, full } = await target(url);
      if (!canOpenDir(root, parts)) throw new HttpError(403, '이 폴더는 열지 않아요.');
      let entries;
      try {
        entries = await readdir(full, { withFileTypes: true });
      } catch {
        throw new HttpError(404, '없어요.');
      }
      const names = new Set(entries.map((entry) => entry.name));
      const out: { name: string; kind: 'file' | 'directory'; size: number; mtime: number }[] = [];
      for (const entry of entries) {
        // 심볼릭 링크는 따라가지 않는다
        const kind = entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : null;
        if (!kind) continue;
        let name = entry.name;
        if (root === 'codex-logs' && kind === 'file' && name.endsWith('.jsonl.zst') && zstd) {
          name = name.slice(0, -4);
          if (names.has(name)) continue;
        }
        if (!canSee(root, parts, name, kind)) continue;
        try {
          const info = await stat(path.join(full, entry.name));
          out.push({ name, kind, size: info.size, mtime: info.mtimeMs });
        } catch {
          // 그 사이 지워졌으면 건너뛴다
        }
      }
      return send(res, 200, out);
    }
    if (route === 'GET /api/fs/read') {
      const { root, parts, full } = await target(url);
      const info = await statOf(root, parts, full);
      if (info.kind !== 'file') throw new HttpError(400, '파일이 아니에요.');
      const real = logFileOf(root, full);
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      const stream = root === 'project' ? createReadStream(real) : openLogStream(real);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      return;
    }
    if (route === 'PUT /api/fs/write') {
      const { root, parts, base, full } = await target(url);
      if (!canWrite(root, parts, existsSync(full))) throw new HttpError(403, '이 파일은 쓰지 않아요. 역할 파일과 .teamcook/ 아래만 써요.');
      const text = await readBody(req);
      await mkdir(path.dirname(full), { recursive: true });
      if (!(await staysInside(base, full))) throw new HttpError(403, '이 폴더 밖은 쓰지 않아요.');
      await writeFile(full, text, 'utf8');
      return send(res, 200, { ok: true });
    }
    if (route === 'DELETE /api/fs/remove') {
      const { root, parts, full } = await target(url);
      if (!canRemove(root, parts)) throw new HttpError(403, '역할 파일만 지울 수 있어요.');
      if (!existsSync(full)) throw new HttpError(404, '없어요.');
      await rm(full);
      return send(res, 200, { ok: true });
    }
    throw new HttpError(404, '없는 주소예요.');
  };

  // ───────── 화면 파일 ─────────
  const serveUi = async (res: http.ServerResponse, url: URL) => {
    if (!options.uiDir) return send(res, 404, { error: '화면 파일이 없어요.' });
    const parts = splitPath(decodeURIComponent(url.pathname));
    if (!parts) return send(res, 400, { error: '이상한 경로예요.' });
    let file = path.join(options.uiDir, ...parts);
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(options.uiDir, 'index.html');
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
      });
      res.end(body);
    } catch {
      send(res, 404, { error: '없어요.' });
    }
  };

  const server = http.createServer(async (req, res) => {
    try {
      // 이 컴퓨터의 주소로 들어온 요청만 받는다 (다른 이름으로 위장한 접속 막기)
      const host = req.headers.host ?? '';
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(res, 403, { error: '이 컴퓨터 안에서만 열 수 있어요.' });
      const url = new URL(req.url ?? '/', `http://${host}`);
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: '허용하지 않는 요청이에요.' });
        return await serveUi(res, url);
      }
      const origin = req.headers.origin;
      if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
        return send(res, 403, { error: '다른 사이트에서 온 요청은 받지 않아요.' });
      }
      const given = url.pathname === '/api/events' ? url.searchParams.get('key') : (req.headers['x-teamcook-key'] as string | undefined);
      if (!sameKey(given, key)) return send(res, 401, { error: '열쇠가 맞지 않아요. 터미널에 나온 주소로 다시 열어 주세요.' });
      await api(req, res, url);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      if (error instanceof HttpError) send(res, error.status, { error: error.message });
      else send(res, 500, { error: `도우미가 처리하지 못했어요: ${(error as Error).message}` });
    }
  });

  // 포트가 쓰이고 있으면 다음 번호를 시도한다
  for (let attempt = 0; ; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt >= 10 || options.port === 0) throw error;
      port += 1;
    }
  }
  port = (server.address() as { port: number }).port;

  return {
    url: `http://127.0.0.1:${port}/`,
    key,
    port,
    close: async () => {
      watchers.forEach((item) => item.close());
      timers.forEach((item) => clearInterval(item));
      if (flushTimer) clearTimeout(flushTimer);
      listeners.forEach((res) => res.end());
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
