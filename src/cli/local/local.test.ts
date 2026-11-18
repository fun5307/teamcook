// 내 컴퓨터 도우미: 읽고 쓰는 곳의 규칙, 서버, 화면 쪽 연결을 실제 임시 폴더로 확인한다.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectLocal, localDir, selectProject } from '../../lib/local/client';
import { findClaudeProjectDirs, listClaudeSessions, readClaudeSession, readCodexJournal } from '../../lib/journal/read';
import { readText, writeText } from '../../lib/workspace/fs';
import { applyChanges, planSave, scanTeam } from '../../lib/workspace/team';
import { discoverProjects } from './discover';
import { canReadFile, canRemove, canSee, canWrite, splitPath } from './policy';
import { startLocalServer, type LocalServer } from './server';

describe('도우미 규칙 (policy)', () => {
  it('위로 올라가거나 드라이브·역슬래시가 섞인 경로는 거절한다', () => {
    for (const bad of ['../x', 'a/../../b', 'C:/x', 'a\\b', 'a/./b']) expect(splitPath(bad)).toBeNull();
    expect(splitPath('.claude/agents/a.md')).toEqual(['.claude', 'agents', 'a.md']);
  });

  it('프로젝트에서는 역할 파일·.teamcook·설정 두 개만 읽는다', () => {
    expect(canReadFile('project', ['.claude', 'agents', 'a.md'])).toBe(true);
    expect(canReadFile('project', ['.codex', 'agents', 'b.toml'])).toBe(true);
    expect(canReadFile('project', ['.codex', 'config.toml'])).toBe(true);
    expect(canReadFile('project', ['.teamcook', 'r', 'RECIPE.md'])).toBe(true);
    for (const bad of [['.env'], ['src', 'main.ts'], ['.claude', 'settings.local.json'], ['.codex', 'auth.json'], ['.claude', 'agents', 'x', 'deep.md']]) {
      expect(canReadFile('project', bad)).toBe(false);
    }
  });

  it('기록 폴더에서는 대화 기록 파일만 읽는다', () => {
    expect(canReadFile('claude-logs', ['p', 's.jsonl'])).toBe(true);
    expect(canReadFile('claude-logs', ['p', 's.jsonl.zst'])).toBe(false);
    expect(canReadFile('codex-logs', ['2026', 'r.jsonl.zst'])).toBe(true);
    for (const bad of ['auth.json', '.credentials.json', 'settings.json', 'config.toml']) {
      expect(canReadFile('claude-logs', [bad])).toBe(false);
      expect(canReadFile('codex-logs', [bad])).toBe(false);
    }
  });

  it('쓰기는 역할 파일과 .teamcook뿐, 설정 파일은 없을 때 새로 만들기만', () => {
    expect(canWrite('project', ['.claude', 'agents', 'a.md'], true)).toBe(true);
    expect(canWrite('project', ['.teamcook', 'r', 'RECIPE.md'], false)).toBe(true);
    expect(canWrite('project', ['.codex', 'config.toml'], false)).toBe(true);
    expect(canWrite('project', ['.codex', 'config.toml'], true)).toBe(false);
    expect(canWrite('project', ['src', 'main.ts'], true)).toBe(false);
    expect(canWrite('claude-logs', ['p', 's.jsonl'], true)).toBe(false);
    expect(canRemove('project', ['.codex', 'agents', 'b.toml'])).toBe(true);
    expect(canRemove('project', ['.teamcook', 'r', 'RECIPE.md'])).toBe(false);
  });

  it('목록에는 들어갈 수 있는 폴더와 읽을 수 있는 파일만 보인다', () => {
    expect(canSee('project', [], '.claude', 'directory')).toBe(true);
    expect(canSee('project', [], 'src', 'directory')).toBe(false);
    expect(canSee('project', ['.claude'], 'settings.local.json', 'file')).toBe(false);
  });
});

const hasZstd = typeof (zlib as unknown as { zstdCompressSync?: unknown }).zstdCompressSync === 'function';

describe('도우미 서버와 화면 쪽 연결', () => {
  let tmp: string;
  let server: LocalServer;
  let projectPath: string;
  const KEY = 'k'.repeat(48);

  beforeAll(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'teamcook-local-'));
    projectPath = path.join(tmp, 'my-app');
    const put = (file: string, text: string) => {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, text, 'utf8');
    };
    put(path.join(projectPath, '.claude/agents/reviewer.md'), '---\nname: reviewer\ndescription: 검토\ntools: Read, Grep\n---\n검토만 해요.\n');
    put(path.join(projectPath, '.codex/config.toml'), '[agents]\nmax_threads = 4\n');
    put(path.join(projectPath, '.env'), 'SECRET=1');
    put(path.join(projectPath, '.claude/settings.local.json'), '{}');
    const claude = path.join(tmp, 'claude-projects');
    const slug = projectPath.replace(/[^a-zA-Z0-9]/g, '-');
    put(path.join(claude, slug, 's1.jsonl'), [
      JSON.stringify({ type: 'summary' }),
      JSON.stringify({ type: 'user', cwd: projectPath, message: { role: 'user', content: '리뷰해 줘' }, timestamp: '2026-11-18T01:00:00Z' }),
    ].join('\n'));
    put(path.join(claude, 'auth.json'), '{"token":"x"}');
    const codex = path.join(tmp, 'codex-sessions');
    const meta = (id: string) => JSON.stringify({ type: 'session_meta', payload: { id, cwd: projectPath, timestamp: '2026-11-18T02:00:00Z' } });
    const userMsg = JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '고쳐 줘' }] } });
    put(path.join(codex, '2026/11/18/rollout-2026-11-18T02-00-00-a.jsonl'), `${meta('a')}\n${userMsg}\n`);
    if (hasZstd) {
      const packed = (zlib as unknown as { zstdCompressSync: (b: Buffer) => Buffer }).zstdCompressSync(Buffer.from(`${meta('b')}\n${userMsg}\n`));
      mkdirSync(path.join(codex, '2026/11/17'), { recursive: true });
      writeFileSync(path.join(codex, '2026/11/17/rollout-2026-11-17T02-00-00-b.jsonl.zst'), packed);
    }
    server = await startLocalServer({ uiDir: null, port: 0, claudeProjects: claude, codexSessions: codex, watch: false, key: KEY });
    await connectLocal(server.url, KEY);
  });

  afterAll(async () => {
    await server.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const raw = (pathname: string, headers: Record<string, string> = {}) =>
    new Promise<number>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: server.port, path: pathname, headers }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });

  it('열쇠가 없거나 다른 이름으로 들어오면 거절한다', async () => {
    expect(await raw('/api/hello')).toBe(401);
    expect(await raw('/api/hello', { 'x-teamcook-key': KEY, host: `evil.example:${server.port}` })).toBe(403);
    expect(await raw('/api/hello', { 'x-teamcook-key': KEY, origin: 'https://evil.example' })).toBe(403);
    expect(await raw('/api/hello', { 'x-teamcook-key': KEY })).toBe(200);
  });

  it('최근 프로젝트를 두 도구의 기록에서 찾는다 (팀원 기록은 세지 않는다)', async () => {
    const list = await discoverProjects(path.join(tmp, 'claude-projects'), path.join(tmp, 'codex-sessions'));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'my-app', claudeSessions: 1, codexSessions: hasZstd ? 2 : 1, exists: true });
  });

  it('고른 프로젝트의 팀을 읽고, 고친 것을 역할 파일에 쓴다', async () => {
    await selectProject(projectPath);
    const root = localDir('project', 'my-app');
    const snapshot = await scanTeam(root);
    expect(snapshot.members.map((member) => member.card.name)).toEqual(['reviewer']);
    expect(snapshot.codexMaxThreads).toBe(4);
    const cards = snapshot.members.map((member) => ({ ...member.card, instructions: '꼼꼼히 검토만 해요.' }));
    const plan = planSave(snapshot, cards);
    const result = await applyChanges(root, plan.changes);
    expect(result.conflicts).toEqual([]);
    expect(readFileSync(path.join(projectPath, '.claude/agents/reviewer.md'), 'utf8')).toContain('꼼꼼히 검토만 해요.');
  });

  it('역할 폴더 밖은 읽지도 쓰지도 않는다', async () => {
    const root = localDir('project', 'my-app');
    expect(await readText(root, '.env')).toBeNull();
    expect(await readText(root, '.claude/settings.local.json')).toBeNull();
    await expect(writeText(root, 'src/hack.ts', 'x')).rejects.toThrow();
    await expect(writeText(root, '.codex/config.toml', 'x')).rejects.toThrow();
    expect(existsSync(path.join(projectPath, 'src/hack.ts'))).toBe(false);
    const names: string[] = [];
    for await (const [name] of root.entries()) names.push(name);
    expect(names.sort()).toEqual(['.claude', '.codex']);
    expect(await raw(`/api/fs/read?root=project&path=${encodeURIComponent('../claude-projects/auth.json')}`, { 'x-teamcook-key': KEY })).toBe(400);
    expect(await raw('/api/fs/read?root=claude-logs&path=auth.json', { 'x-teamcook-key': KEY })).toBe(403);
  });

  it('업무 일지를 같은 코드로 읽는다 (Codex 압축 기록도 풀어서)', async () => {
    const dirs = await findClaudeProjectDirs(localDir('claude-logs'), 'my-app', projectPath);
    expect(dirs).toHaveLength(1);
    const files = await listClaudeSessions(dirs[0]);
    const session = await readClaudeSession(files[0]);
    expect(session.firstPrompt).toBe('리뷰해 줘');
    const journal = await readCodexJournal(localDir('codex-logs'));
    expect(journal.compressed).toBe(0);
    expect(journal.read).toBe(hasZstd ? 2 : 1);
  });
});
