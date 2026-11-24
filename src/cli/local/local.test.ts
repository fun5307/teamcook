// 내 컴퓨터 도우미: 읽고 쓰는 곳의 규칙, 서버, 화면 쪽 연결을 실제 임시 폴더로 확인한다.
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectLocal, fetchActivity, localDir, selectProject } from '../../lib/local/client';
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

describe('도우미: 이 폴더에서 AI가 한 일 (/api/activity)', () => {
  let tmp: string;
  let server: LocalServer;
  let projectPath: string;
  let claudeFile: string;
  const KEY = 'a'.repeat(48);
  const put = (file: string, text: string) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text, 'utf8');
  };
  const j = (value: unknown) => JSON.stringify(value);

  beforeAll(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'teamcook-activity-'));
    projectPath = path.join(tmp, 'proj');
    mkdirSync(projectPath, { recursive: true });
    const claude = path.join(tmp, 'claude-projects');
    const dir = path.join(claude, projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
    const editA = path.join(projectPath, 'src', 'a.ts');
    claudeFile = path.join(dir, 's2.jsonl');
    put(
      claudeFile,
      [
        j({ type: 'user', cwd: projectPath, timestamp: '2026-11-20T01:00:00Z', message: { role: 'user', content: '로그인 버그를 고쳐 줘' } }),
        j({
          type: 'assistant',
          timestamp: '2026-11-20T01:01:00Z',
          message: {
            id: 'm1',
            role: 'assistant',
            usage: { output_tokens: 30 },
            content: [
              { type: 'tool_use', id: 'tA', name: 'Agent', input: { subagent_type: 'reviewer', description: '검토', prompt: '봐 줘' } },
              { type: 'tool_use', id: 'tB', name: 'Agent', input: { subagent_type: 'sneaky', description: '몰래', prompt: '읽어 줘' } },
              { type: 'tool_use', id: 'tE', name: 'Edit', input: { file_path: editA } },
            ],
          },
        }),
        j({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tA', content: '좋아요' }] }, toolUseResult: { agentId: 'abc123', totalTokens: 50, totalDurationMs: 2000, status: 'completed' } }),
        // 기록 안의 agentId가 경로를 벗어나려 해도 따라가지 않아야 한다
        j({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tB', content: '끝' }] }, toolUseResult: { agentId: 'x/../../decoy', totalTokens: 1 } }),
      ].join('\n'),
    );
    // 이어하기로 만들어진 복사본: s2의 줄이 그대로 들어 있고 새로 한 일은 없다 (요약이 부풀려지면 안 된다)
    const original = readFileSync(claudeFile, 'utf8');
    const waitUntil = Date.now() + 30;
    while (Date.now() < waitUntil) {
      // 복사본이 원본보다 확실히 나중에 만들어지도록 잠깐 기다린다 (파일 생성 시각 비교용)
    }
    put(path.join(dir, 's2-resumed.jsonl'), original);
    // 팀원 reviewer(읽기 전용이어야 하는데)가 파일을 고친 기록
    put(path.join(dir, 's2', 'subagents', 'agent-abc123.jsonl'), j({ type: 'assistant', message: { id: 'z', content: [{ type: 'tool_use', id: 'u1', name: 'Write', input: { file_path: path.join(projectPath, 'NOTES.md') } }] } }));
    // 위의 'x/../../decoy'를 그대로 따라가면 읽히는 자리에 미끼를 둔다
    put(path.join(dir, 's2', 'decoy.jsonl'), j({ type: 'assistant', message: { id: 'd', content: [{ type: 'tool_use', id: 'd1', name: 'Write', input: { file_path: path.join(projectPath, 'DECOY.md') } }] } }));

    const codex = path.join(tmp, 'codex-sessions');
    const meta = (id: string, cwd: string, extra: Record<string, unknown> = {}) => j({ type: 'session_meta', timestamp: '2026-11-21T02:00:00Z', payload: { id, cwd, ...extra } });
    const user = (text: string) => j({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    const change = (file: string) => j({ type: 'event_msg', payload: { type: 'item_completed', item: { type: 'FileChange', status: 'completed', changes: { [file]: { type: 'update' } } } } });
    put(path.join(codex, '2026/11/21/rollout-2026-11-21T02-00-00-root.jsonl'), [meta('root', projectPath), user('테스트를 추가해 줘'), change('src/a.ts')].join('\n'));
    put(
      path.join(codex, '2026/11/21/rollout-2026-11-21T02-01-00-child.jsonl'),
      [meta('child', projectPath, { parent_thread_id: 'root', agent_role: 'writer', thread_source: 'subagent' }), j({ type: 'response_item', payload: { type: 'agent_message', author: 'main', recipient: 'w', content: [{ text: '써 줘' }] } }), change('src/w.ts')].join('\n'),
    );
    put(path.join(codex, '2026/11/21/rollout-2026-11-21T03-00-00-other.jsonl'), [meta('other', path.join(tmp, 'elsewhere')), user('남의 프로젝트'), change('x.ts')].join('\n'));

    server = await startLocalServer({ uiDir: null, port: 0, claudeProjects: claude, codexSessions: codex, watch: false, key: KEY });
    await connectLocal(server.url, KEY);
  });

  afterAll(async () => {
    await server.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('프로젝트를 열기 전에는 요약하지 않는다', async () => {
    await expect(fetchActivity()).rejects.toThrow();
  });

  it('두 도구의 기록을 이 프로젝트 것만 모아 요약한다', async () => {
    await selectProject(projectPath);
    const summary = await fetchActivity();
    // 다른 프로젝트의 Codex 기록(other)은 들어오지 않는다
    expect(summary.totals).toMatchObject({ sessions: 2, claude: 1, codex: 1, turns: 2, claudeOutputTokens: 30 });
    const files = summary.topFiles.map((file) => file.path).sort();
    expect(files).toEqual(['NOTES.md', 'src/a.ts', 'src/w.ts']);
    expect(summary.topFiles.find((file) => file.path === 'src/a.ts')).toMatchObject({ edits: 2, sessions: 2 });
    // 팀원 reviewer·writer가 고친 파일이 팀원 기록으로 남는다
    expect(summary.roleEdits.map((item) => [item.role, item.files]).sort()).toEqual([
      ['reviewer', ['NOTES.md']],
      ['writer', ['src/w.ts']],
    ]);
    expect(summary.roles.find((role) => role.role === 'reviewer')).toMatchObject({ count: 1, tokens: 50, durationMs: 2000, editedFiles: 1 });
  });

  it('이어하기로 복사된 대화는 두 번 세지 않고, 알린다', async () => {
    const summary = await fetchActivity();
    // s2-resumed.jsonl은 s2의 복사본이라 새로 한 일이 없다: 대화 수·파일 고침·토큰이 두 배가 되지 않는다
    expect(summary.totals).toMatchObject({ sessions: 2, claude: 1, turns: 2, claudeOutputTokens: 30 });
    expect(summary.topFiles.find((file) => file.path === 'src/a.ts')?.edits).toBe(2);
    expect(summary.notes.some((note) => note.includes('이어하기'))).toBe(true);
  });

  it('기록 안의 agentId로 경로를 벗어나 다른 파일을 읽지 않는다', async () => {
    const summary = await fetchActivity();
    expect(summary.topFiles.map((file) => file.path)).not.toContain('DECOY.md');
    // 읽지 못한 맡긴 일은 0이 아니라 모름
    expect(summary.uncheckedDelegations).toBe(1);
    expect(summary.roles.find((role) => role.role === 'sneaky')?.editedFiles).toBeNull();
  });

  it('기록이 늘면 다시 읽고, 그대로면 읽은 것을 쓴다', async () => {
    const before = await fetchActivity();
    appendFileSync(claudeFile, `\n${j({ type: 'user', timestamp: '2026-11-20T03:00:00Z', message: { role: 'user', content: '한 번 더 부탁해요' } })}`);
    const after = await fetchActivity();
    expect(after.totals.turns).toBe(before.totals.turns + 1);
    expect((await fetchActivity()).totals.turns).toBe(after.totals.turns);
  });
});
