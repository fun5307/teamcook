// 내 프로젝트 폴더 열기: 팀 읽기, 고친 것만 파일에 쓰기, 레시피 들이기, 업무 일지 해석

import { describe, expect, it } from 'vitest';
import { cardToClaudeMd } from '../../converters/claude';
import { cardToCodexToml } from '../../converters/codex';
import { providerData } from '../../data/providers';
import { builtinRecipes } from '../../data/recipes';
import { claudeProjectSlug, parseClaudeAgentSteps, parseClaudeSession } from '../journal/claude';
import { buildCodexSessions, parseCodexRollout } from '../journal/codex';
import { summarizeRoles } from '../journal/types';
import { createMemoryDir, dumpDir, writeText } from './fs';
import { applyChanges, planHire, planSave, scanTeam } from './team';

const crossReview = builtinRecipes.find((recipe) => recipe.id === 'builtin-cross-review')!;
const [writer, reviewer] = crossReview.cards;

// 다른 도구로(손으로) 만든 파일: teamcook 주석이 없고 모양이 다르다
const HAND_TOML = `# 내가 손으로 쓴 주석
name = "planner"
description = "계획을 세운다"
model_reasoning_effort = "high"

developer_instructions = """
너는 계획 담당이다.
"""
`;
const HAND_MD = `---
name: helper
description: 잡일을 돕는다
tools: Read, Grep
---

너는 도우미다.
`;

async function project() {
  return createMemoryDir('my-app', {
    '.codex/agents/writer.toml': cardToCodexToml(writer),
    '.claude/agents/writer.md': cardToClaudeMd(writer),
    '.codex/agents/reviewer.toml': cardToCodexToml(reviewer),
    '.codex/agents/planner.toml': HAND_TOML,
    '.claude/agents/helper.md': HAND_MD,
    '.claude/agents/broken.md': '머리말이 없는 파일',
    '.codex/config.toml': '[agents]\nmax_concurrent_threads_per_session = 4\n',
    '.claude/settings.json': '{"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"1"},"permissions":{"allow":["Bash(npm test)"]}}',
    'src/index.ts': 'console.log(1)',
  });
}

describe('폴더에 있는 팀 읽기', () => {
  it('숨김 폴더의 역할 파일을 읽어 팀원으로 보여 주고, 같은 이름의 두 형식은 한 사람으로 묶는다', async () => {
    const team = await scanTeam(await project());
    expect(team.folderName).toBe('my-app');
    expect(team.members.map((member) => member.card.name)).toEqual(['helper', 'planner', 'reviewer', 'writer']);
    const w = team.members.find((member) => member.card.name === 'writer')!;
    expect(w.files.map((file) => file.path).sort()).toEqual(['.claude/agents/writer.md', '.codex/agents/writer.toml']);
    expect(w.diverged).toBe(false);
    expect(w.card.displayName).toBe(writer.displayName);
    expect(w.card.instructions).toBe(writer.instructions);
    expect(team.hasDir).toEqual({ 'codex-cli': true, 'claude-code': true });
  });

  it('읽지 못한 파일은 목록으로 알려 주고, 설정 파일은 읽기만 한다', async () => {
    const root = await project();
    const before = await dumpDir(root);
    const team = await scanTeam(root);
    expect(team.unreadable.map((item) => item.path)).toEqual(['.claude/agents/broken.md']);
    expect(team.codexMaxThreads).toBe(4);
    expect(team.agentTeamsEnabled).toBe(true);
    // 읽기만 했으니 폴더는 그대로다
    expect(await dumpDir(root)).toEqual(before);
  });

  it('두 형식의 내용이 서로 다르면 알려 준다', async () => {
    const root = await project();
    await writeText(root, '.claude/agents/writer.md', cardToClaudeMd({ ...writer, instructions: '다른 지시문' }));
    const team = await scanTeam(root);
    expect(team.members.find((member) => member.card.name === 'writer')!.diverged).toBe(true);
  });

  it('역할 폴더가 없는 프로젝트는 빈 팀이다', async () => {
    const team = await scanTeam(await createMemoryDir('empty', { 'README.md': 'hi' }));
    expect(team.members).toEqual([]);
    expect(team.hasDir).toEqual({ 'codex-cli': false, 'claude-code': false });
  });
});

describe('고친 것만 파일에 쓰기', () => {
  it('아무것도 고치지 않으면 바뀌는 파일이 없다 (손으로 만든 파일의 모양도 그대로)', async () => {
    const team = await scanTeam(await project());
    expect(planSave(team, team.members.map((member) => member.card))).toEqual({ changes: [], problems: [] });
  });

  it('한 사람의 맡은 일을 고치면 그 사람의 파일만 바뀌고, 다시 읽으면 고친 내용이 나온다', async () => {
    const root = await project();
    const team = await scanTeam(root);
    const before = await dumpDir(root);
    const cards = team.members.map((member) =>
      member.card.name === 'writer' ? { ...member.card, role: '기능을 구현하고 테스트를 돌린다' } : member.card,
    );
    const plan = planSave(team, cards);
    expect(plan.changes.map((change) => [change.kind, change.path]).sort()).toEqual([
      ['update', '.claude/agents/writer.md'],
      ['update', '.codex/agents/writer.toml'],
    ]);
    const result = await applyChanges(root, plan.changes);
    expect(result.conflicts).toEqual([]);
    const after = await dumpDir(root);
    for (const path of Object.keys(before)) {
      if (!path.includes('writer')) expect(after[path]).toBe(before[path]);
    }
    const again = await scanTeam(root);
    expect(again.members.find((member) => member.card.name === 'writer')!.card.role).toBe('기능을 구현하고 테스트를 돌린다');
    expect(again.members.find((member) => member.card.name === 'writer')!.card.instructions).toBe(writer.instructions);
  });

  it('손으로 만든 파일을 고쳐도 teamcook이 모르는 설정(model_reasoning_effort)은 남는다', async () => {
    const root = await project();
    const team = await scanTeam(root);
    const cards = team.members.map((member) =>
      member.card.name === 'planner' ? { ...member.card, role: '계획을 세우고 순서를 정한다' } : member.card,
    );
    await applyChanges(root, planSave(team, cards).changes);
    const text = (await dumpDir(root))['.codex/agents/planner.toml'];
    expect(text).toContain('계획을 세우고 순서를 정한다');
    expect(text).toContain('model_reasoning_effort = "high"');
    expect(text).toContain('너는 계획 담당이다.');
  });

  it('이름을 바꾸면 옛 파일을 지우고 새 파일을 만든다. 새 팀원은 폴더에 있는 형식으로, 뺀 팀원은 파일을 지운다', async () => {
    const root = await project();
    const team = await scanTeam(root);
    const cards = team.members
      .filter((member) => member.card.name !== 'helper')
      .map((member) => (member.card.name === 'reviewer' ? { ...member.card, name: 'checker' } : member.card));
    cards.push({ ...reviewer, id: 'new-1', name: 'tester', displayName: '테스트 담당' });
    const plan = planSave(team, cards);
    expect(plan.changes.map((change) => `${change.kind} ${change.path}`).sort()).toEqual([
      'create .claude/agents/tester.md',
      'create .codex/agents/checker.toml',
      'create .codex/agents/tester.toml',
      'delete .claude/agents/helper.md',
      'delete .codex/agents/reviewer.toml',
    ]);
    await applyChanges(root, plan.changes);
    const names = (await scanTeam(root)).members.map((member) => member.card.name);
    expect(names).toEqual(['checker', 'planner', 'tester', 'writer']);
  });

  it('잘못된 이름과 겹치는 이름은 저장을 막는다', async () => {
    const team = await scanTeam(await project());
    const cards = team.members.map((member) => member.card);
    expect(planSave(team, [...cards, { ...reviewer, id: 'x', name: 'writer' }]).problems[0]).toContain('두 번 있어요');
    expect(planSave(team, [...cards, { ...reviewer, id: 'y', name: '검토자' }]).problems[0]).toContain('영문 소문자');
    expect(planSave(team, [...cards, { ...reviewer, id: 'z', name: '../evil' }]).changes).toEqual([]);
  });

  it('읽은 뒤에 밖에서 바뀐 파일은 덮어쓰지 않고 알려 준다', async () => {
    const root = await project();
    const team = await scanTeam(root);
    const cards = team.members.map((member) => (member.card.name === 'writer' ? { ...member.card, role: '새 역할' } : member.card));
    const plan = planSave(team, cards);
    // 그 사이 Claude Code나 사람이 파일을 고쳤다
    await writeText(root, '.claude/agents/writer.md', `${cardToClaudeMd(writer)}\n밖에서 덧붙인 줄\n`);
    const result = await applyChanges(root, plan.changes);
    expect(result.conflicts).toEqual(['.claude/agents/writer.md']);
    expect(result.written).toEqual(['.codex/agents/writer.toml']);
    expect((await dumpDir(root))['.claude/agents/writer.md']).toContain('밖에서 덧붙인 줄');
  });
});

describe('레시피를 이 폴더에 들이기', () => {
  it('없는 파일만 만들고, 이미 있는 역할과 설정 파일은 덮어쓰지 않는다', async () => {
    const root = await project();
    const before = await dumpDir(root);
    const plan = await planHire(root, crossReview, providerData);
    const created = plan.changes.map((change) => change.path);
    expect(plan.changes.every((change) => change.kind === 'create')).toBe(true);
    expect(created).toContain('.claude/agents/reviewer.md');
    expect(created.some((path) => path.startsWith('.teamcook/') && path.endsWith('RECIPE.md'))).toBe(true);
    expect(created).not.toContain('.codex/config.toml');
    expect(plan.skipped.map((item) => item.path)).toContain('.codex/config.toml');
    await applyChanges(root, plan.changes);
    const after = await dumpDir(root);
    for (const path of Object.keys(before)) expect(after[path]).toBe(before[path]);
  });

  it('빈 프로젝트에 들이면 그 팀이 그대로 읽힌다', async () => {
    const root = await createMemoryDir('fresh');
    await applyChanges(root, (await planHire(root, crossReview, providerData)).changes);
    const team = await scanTeam(root);
    expect(team.members.map((member) => member.card.name).sort()).toEqual(crossReview.cards.map((card) => card.name).sort());
  });
});

// ───────────────────────── 업무 일지 ─────────────────────────

const line = (value: unknown) => JSON.stringify(value);

const CLAUDE_LOG = [
  line({ type: 'user', isSidechain: false, timestamp: '2026-11-17T01:00:00.000Z', cwd: 'c:\\my-app', message: { role: 'user', content: '로그인 버그를 고쳐 줘' } }),
  line({ type: 'api-request-blob', blob: 'x'.repeat(50) }),
  line({ type: 'assistant', isSidechain: false, timestamp: '2026-11-17T01:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'reviewer에게 맡길게요.' }, { type: 'tool_use', id: 'toolu_1', name: 'Agent', input: { subagent_type: 'reviewer', description: '변경 검토', prompt: 'src/login.ts 변경을 검토해 줘' } }] } }),
  line({ type: 'assistant', isSidechain: false, timestamp: '2026-11-17T01:00:06.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_2', name: 'Task', input: { subagent_type: 'writer', prompt: '테스트를 추가해 줘' } }, { type: 'tool_use', id: 'toolu_9', name: 'Read', input: { file_path: 'a.ts' } }] } }),
  line({ type: 'user', isSidechain: false, timestamp: '2026-11-17T01:02:00.000Z', toolUseResult: { status: 'completed', agentId: 'a111', agentType: 'reviewer', content: [{ type: 'text', text: '문제 2건을 찾았습니다.' }], totalTokens: 12000, totalDurationMs: 90000, totalToolUseCount: 7 }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: '문제 2건을 찾았습니다.' }] }] } }),
  '{깨진 줄 "type":"user"',
  line({ type: 'assistant', isSidechain: true, message: { role: 'assistant', content: [{ type: 'text', text: '서브에이전트 안의 말' }] } }),
  line({ type: 'assistant', isSidechain: false, timestamp: '2026-11-17T01:03:00.000Z', message: { role: 'assistant', content: [{ type: 'text', text: '검토 결과를 반영했습니다.' }] } }),
].join('\n');

describe('업무 일지: Claude Code 기록', () => {
  it('누구에게 무엇을 시켰고 무엇을 돌려받았는지, 시간과 토큰을 뽑는다', () => {
    const session = parseClaudeSession(CLAUDE_LOG, 's1');
    expect(session.firstPrompt).toBe('로그인 버그를 고쳐 줘');
    expect(session.cwd).toBe('c:\\my-app');
    expect(session.finalAnswer).toBe('검토 결과를 반영했습니다.');
    expect(session.delegations).toHaveLength(2);
    expect(session.delegations[0]).toMatchObject({
      role: 'reviewer',
      title: '변경 검토',
      instruction: 'src/login.ts 변경을 검토해 줘',
      result: '문제 2건을 찾았습니다.',
      status: 'done',
      tokens: 12000,
      durationMs: 90000,
      toolCount: 7,
      agentId: 'a111',
    });
  });

  it('돌려받은 기록이 없는 일은 결과를 지어내지 않고 "모름"으로 둔다. 깨진 줄은 건너뛰고 센다', () => {
    const session = parseClaudeSession(CLAUDE_LOG, 's1');
    expect(session.delegations[1]).toMatchObject({ role: 'writer', status: 'unknown' });
    expect(session.delegations[1].result).toBeUndefined();
    expect(session.delegations[1].tokens).toBeUndefined();
    expect(session.skippedLines).toBe(1);
    // 토큰을 모르는 일이 섞인 역할의 합계는 0이 아니라 모름(null)
    const roles = summarizeRoles(session);
    expect(roles.find((row) => row.role === 'reviewer')).toEqual({ role: 'reviewer', count: 1, tokens: 12000, durationMs: 90000 });
    expect(roles.find((row) => row.role === 'writer')).toEqual({ role: 'writer', count: 1, tokens: null, durationMs: null });
  });

  it('서브에이전트 기록에서 한 일을 차례로 뽑고, 기록 폴더 이름을 만든다', () => {
    const steps = parseClaudeAgentSteps(
      [
        line({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'src/login.ts' } }] } }),
        line({ type: 'user', message: { content: [{ type: 'tool_result', content: '...' }] } }),
        line({ type: 'assistant', message: { content: [{ type: 'text', text: '문제 2건을 찾았습니다.' }] } }),
      ].join('\n'),
    );
    expect(steps).toEqual([
      { kind: 'tool', text: 'Read src/login.ts' },
      { kind: 'say', text: '문제 2건을 찾았습니다.' },
    ]);
    expect(claudeProjectSlug('c:\\claude-MCP')).toBe('c--claude-MCP');
  });
});

const meta = (payload: object) => line({ timestamp: '2026-11-17T02:00:00.000Z', ordinal: 0, type: 'session_meta', payload });
const msg = (ordinal: number, role: string, text: string, at = '2026-11-17T02:00:10.000Z') =>
  line({ timestamp: at, ordinal, type: 'response_item', payload: { type: 'message', role, content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }] } });

const CODEX_PARENT = [
  meta({ id: 'p1', cwd: 'C:\\my-app', thread_source: 'user' }),
  msg(1, 'user', '<environment_context>...</environment_context>'),
  msg(2, 'user', 'reviewer에게 이 폴더를 검토시켜 줘'),
  msg(9, 'assistant', '검토가 끝났습니다.', '2026-11-17T02:05:00.000Z'),
].join('\n');
const CODEX_CHILD = [
  meta({ id: 'c1', parent_thread_id: 'p1', thread_source: 'subagent', agent_role: 'reviewer', agent_nickname: 'Hume', subagent_history_start_ordinal: 5, cwd: 'C:\\my-app' }),
  // 부모에게서 복사된 앞부분 (부모의 session_meta와 대화)
  line({ timestamp: '2026-11-17T02:00:00.000Z', ordinal: 1, type: 'session_meta', payload: { id: 'p1' } }),
  msg(2, 'user', 'reviewer에게 이 폴더를 검토시켜 줘'),
  msg(3, 'assistant', '부모가 한 말'),
  line({ timestamp: '2026-11-17T02:01:00.000Z', ordinal: 6, type: 'response_item', payload: { type: 'agent_message', author: '/root', recipient: '/root/hume', content: [{ type: 'input_text', text: '이 폴더를 한 줄로 평가해 줘' }] } }),
  msg(8, 'assistant', '구조가 단순하고 테스트가 없습니다.', '2026-11-17T02:01:40.000Z'),
  line({ timestamp: '2026-11-17T02:01:41.000Z', ordinal: 9, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 4321 } } } }),
].join('\n');
const CODEX_GUARDIAN = [meta({ id: 'g1', parent_thread_id: 'p1', thread_source: 'guardian_review' }), msg(1, 'assistant', '승인')].join('\n');

describe('업무 일지: Codex 기록', () => {
  it('서브에이전트 기록을 부모 세션에 묶고, 복사된 부모 대화와 내부용 스레드는 뺀다', () => {
    const sessions = buildCodexSessions([CODEX_CHILD, CODEX_GUARDIAN, CODEX_PARENT].map(parseCodexRollout));
    expect(sessions).toHaveLength(1);
    const [session] = sessions;
    expect(session.firstPrompt).toBe('reviewer에게 이 폴더를 검토시켜 줘');
    expect(session.finalAnswer).toBe('검토가 끝났습니다.');
    expect(session.delegations).toHaveLength(1);
    expect(session.delegations[0]).toMatchObject({
      role: 'reviewer',
      title: 'Hume',
      instruction: '이 폴더를 한 줄로 평가해 줘',
      result: '구조가 단순하고 테스트가 없습니다.',
      status: 'done',
      tokens: 4321,
    });
  });

  it('부모 기록이 없는 서브에이전트 기록도 버리지 않고 따로 보여 준다', () => {
    const sessions = buildCodexSessions([parseCodexRollout(CODEX_CHILD)]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].firstPrompt).toContain('부모 기록 없음');
    expect(sessions[0].delegations[0].role).toBe('reviewer');
  });

  it('형식을 모르는 파일은 빈 결과가 되고 오류를 내지 않는다', () => {
    expect(buildCodexSessions([parseCodexRollout('그냥 글\n{"a":1}')])).toEqual([]);
    expect(parseClaudeSession('그냥 글\n{"a":1}', 'x').delegations).toEqual([]);
  });
});
