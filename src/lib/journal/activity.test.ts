import { describe, expect, it } from 'vitest';
import { buildActivitySummary, buildLineage, checkPermissions, dedupeSessions, pickTitle, relativeToProject } from './activity';
import { ClaudeAgentEditsBuilder, ClaudeSessionBuilder } from './claude';
import { buildCodexSessions, CodexRolloutBuilder } from './codex';
import type { JournalSession } from './types';

const PROJECT = { path: 'C:\\work\\app', name: 'app' };
const line = (value: unknown) => JSON.stringify(value);

// ───────── Claude Code 기록 ─────────
const claudeUser = (content: unknown, extra: Record<string, unknown> = {}) =>
  line({ type: 'user', cwd: PROJECT.path, timestamp: '2026-11-20T01:00:00Z', message: { role: 'user', content }, ...extra });
const claudeAssistant = (id: string, blocks: unknown[], outputTokens?: number, at = '2026-11-20T01:01:00Z') =>
  line({
    type: 'assistant',
    timestamp: at,
    message: { id, role: 'assistant', content: blocks, ...(outputTokens !== undefined ? { usage: { input_tokens: 5, output_tokens: outputTokens } } : {}) },
  });
const tool = (id: string, name: string, input: Record<string, unknown>) => ({ type: 'tool_use', id, name, input });

function readClaude(lines: string[], lite = false): JournalSession {
  const builder = new ClaudeSessionBuilder('s1', { lite });
  for (const item of lines) builder.addLine(item);
  return builder.result();
}

describe('활동: Claude Code 기록', () => {
  const lines = [
    claudeUser('<command-name>/model</command-name>'),
    claudeUser('로그인 버그를 고쳐 줘'),
    claudeAssistant('m1', [{ type: 'text', text: '살펴볼게요' }], 10),
    // 스트리밍으로 같은 메시지가 여러 줄에 반복된다: 같은 id는 한 번만 센다
    claudeAssistant('m1', [tool('t1', 'Edit', { file_path: 'C:\\work\\app\\src\\a.ts' })], 40),
    claudeAssistant('m1', [tool('t1', 'Edit', { file_path: 'C:\\work\\app\\src\\a.ts' })], 40),
    claudeAssistant('m2', [tool('t2', 'Write', { file_path: 'C:\\work\\app\\src\\b.ts' }), tool('t3', 'Read', { file_path: 'x' })], 25),
    claudeAssistant('m3', [tool('t4', 'Bash', { command: 'echo hi > c.txt' })], 5),
    claudeUser([{ type: 'text', text: '고마워' }, { type: 'text', text: '(두 번째 조각)' }]),
    claudeUser([{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }]),
    claudeUser('메타 줄', { isMeta: true }),
  ];

  it('사용자가 직접 친 말만 세고, 도구가 끼워 넣은 줄은 세지 않는다', () => {
    const session = readClaude(lines);
    expect(session.activity?.turns).toBe(2);
    expect(session.firstPrompt).toBe('로그인 버그를 고쳐 줘');
    expect(session.activity?.prompts).toEqual(['로그인 버그를 고쳐 줘', '고마워']);
  });

  it('파일 고침 도구만 세고, 반복된 줄은 한 번만 센다 (셸 명령은 세지 않는다)', () => {
    const { activity } = readClaude(lines);
    expect(activity?.edits).toEqual({ 'C:\\work\\app\\src\\a.ts': 1, 'C:\\work\\app\\src\\b.ts': 1 });
    expect(activity?.toolCounts).toEqual({ Edit: 1, Write: 1, Read: 1, Bash: 1 });
  });

  it('출력 토큰은 메시지마다 한 번씩(가장 큰 값)만 합친다', () => {
    expect(readClaude(lines).activity?.outputTokens).toBe(40 + 25 + 5);
    expect(readClaude([claudeUser('안녕하세요 반가워요')]).activity?.outputTokens).toBeUndefined();
  });

  it('lite로 읽으면 긴 글을 자른다', () => {
    const long = 'x'.repeat(2000);
    const session = readClaude([claudeUser(long)], true);
    expect(session.firstPrompt.length).toBeLessThan(500);
    expect(readClaude([claudeUser(long)]).firstPrompt).toBe(long);
  });

  it('팀원 기록 파일에서 고친 파일을 모은다', () => {
    const builder = new ClaudeAgentEditsBuilder();
    for (const item of [
      claudeAssistant('a1', [tool('u1', 'Edit', { file_path: 'C:\\work\\app\\x.ts' })]),
      claudeAssistant('a1', [tool('u1', 'Edit', { file_path: 'C:\\work\\app\\x.ts' })]),
      claudeAssistant('a2', [tool('u2', 'NotebookEdit', { notebook_path: 'C:\\work\\app\\n.ipynb' }), tool('u3', 'Grep', { pattern: 'x' })]),
      '깨진 줄 "tool_use" "type":"assistant"',
    ]) {
      builder.addLine(item);
    }
    expect(builder.result()).toEqual({ 'C:\\work\\app\\x.ts': 1, 'C:\\work\\app\\n.ipynb': 1 });
  });
});

// ───────── Codex 기록 ─────────
const meta = (id: string, extra: Record<string, unknown> = {}) =>
  line({ type: 'session_meta', timestamp: '2026-11-20T02:00:00Z', payload: { id, cwd: PROJECT.path, ...extra } });
const codexUser = (text: string) => line({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
const codexAssistant = (text: string) => line({ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } });
const fileChange = (changes: Record<string, unknown>, status = 'completed') =>
  line({ type: 'event_msg', payload: { type: 'item_completed', item: { type: 'FileChange', id: 'f', changes, status } } });
const execCall = () => line({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: 'ls' } });
const agentMessage = (text: string) => line({ type: 'response_item', payload: { type: 'agent_message', author: 'main', recipient: 'x', content: [{ text }] } });
const tokens = (total: number) => line({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: total } } } });

function readCodex(lines: string[], lite = false) {
  const builder = new CodexRolloutBuilder({ lite });
  for (const item of lines) builder.addLine(item);
  return builder.result();
}

describe('활동: Codex 기록', () => {
  it('FileChange 기록으로 고친 파일을 센다 (실패한 것·다른 항목은 세지 않는다)', () => {
    const rollout = readCodex([
      meta('a'),
      codexUser('테스트를 추가해 줘'),
      execCall(),
      fileChange({ 'src/a.ts': { type: 'update', unified_diff: '…' }, 'src/new.ts': { type: 'add', content: '…' } }),
      fileChange({ 'src/a.ts': { type: 'update', unified_diff: '…' } }),
      fileChange({ 'src/failed.ts': { type: 'update' } }, 'failed'),
      line({ type: 'event_msg', payload: { type: 'item_completed', item: { type: 'CommandExecution', command: 'FileChange' } } }),
      tokens(1234),
    ]);
    expect(rollout.edits).toEqual({ 'src/a.ts': 2, 'src/new.ts': 1 });
    expect(rollout.toolCounts).toEqual({ exec: 1 });
    expect(rollout.userCount).toBe(1);
    expect(rollout.totalTokens).toBe(1234);
  });

  it('lite로 읽으면 사용자 말은 처음 몇 개만, 결과는 마지막 하나만 둔다', () => {
    const many = Array.from({ length: 12 }, (_, index) => codexUser(`요청 번호 ${index + 1} 입니다`));
    const rollout = readCodex([meta('a'), ...many, codexAssistant('첫 답'), codexAssistant('마지막 답')], true);
    expect(rollout.userCount).toBe(12);
    expect(rollout.userMessages).toHaveLength(5);
    expect(rollout.assistantMessages).toEqual(['마지막 답']);
  });

  it('팀원이 또 다른 팀원에게 맡긴 일까지 따라가고, 팀원이 고친 파일은 팀원 쪽에 둔다', () => {
    const root = readCodex([meta('root'), codexUser('팀으로 풀어 줘'), codexAssistant('끝')]);
    const child = readCodex([
      meta('child', { parent_thread_id: 'root', agent_role: 'writer', thread_source: 'subagent' }),
      agentMessage('이걸 써 줘'),
      fileChange({ 'src/w.ts': { type: 'add' } }),
      codexAssistant('썼어요'),
    ]);
    const grand = readCodex([
      meta('grand', { parent_thread_id: 'child', agent_role: 'tester', thread_source: 'subagent' }),
      agentMessage('검사해 줘'),
      codexAssistant('통과'),
    ]);
    const [session] = buildCodexSessions([grand, child, root]);
    expect(session.delegations.map((item) => [item.role, item.parentId])).toEqual([
      ['writer', undefined],
      ['tester', 'child'],
    ]);
    expect(session.delegations[0].edited).toEqual({ 'src/w.ts': 1 });
    expect(session.delegations[1].edited).toEqual({});
    expect(session.activity?.edits).toEqual({});
  });

  it('부모 기록이 없는 팀원의 수정은 두 번 세지 않는다', () => {
    const orphan = readCodex([
      meta('o', { parent_thread_id: 'gone', agent_role: 'writer', thread_source: 'subagent' }),
      agentMessage('써 줘'),
      fileChange({ 'src/o.ts': { type: 'add' } }),
    ]);
    const [session] = buildCodexSessions([orphan]);
    expect(session.delegations[0].edited).toEqual({ 'src/o.ts': 1 });
    expect(session.activity?.edits).toEqual({});
  });
});

// ───────── 요약 ─────────
describe('활동: 프로젝트 요약', () => {
  const claude = readClaude([
    claudeUser('로그인 버그를 고쳐 줘'),
    claudeAssistant('m1', [tool('t1', 'Edit', { file_path: 'C:\\work\\app\\src\\a.ts' })], 40),
    claudeAssistant('m2', [tool('t2', 'Agent', { subagent_type: 'reviewer', description: '검토', prompt: '봐 줘' })], 10),
  ]);
  const codex = buildCodexSessions([
    readCodex([meta('c1'), codexUser('테스트 추가해 줘'), fileChange({ 'src/a.ts': { type: 'update' } }), tokens(900)]),
  ])[0];

  it('두 도구의 대화를 한 프로젝트로 모은다', () => {
    const summary = buildActivitySummary([claude, codex], PROJECT, { now: '2026-11-24T00:00:00Z' });
    expect(summary.totals).toMatchObject({ sessions: 2, claude: 1, codex: 1, turns: 2, editCount: 2, editedFiles: 1, claudeOutputTokens: 50, codexTokens: 900 });
    // 절대 경로와 상대 경로가 같은 파일로 합쳐진다
    expect(summary.topFiles).toEqual([{ path: 'src/a.ts', edits: 2, sessions: 2 }]);
    expect(summary.sessions.map((item) => item.tokens)).toEqual(
      expect.arrayContaining([
        { kind: 'output', value: 50 },
        { kind: 'total', value: 900 },
      ]),
    );
  });

  it('세부 기록을 못 본 맡긴 일은 0이 아니라 모름으로 센다', () => {
    const summary = buildActivitySummary([claude], PROJECT);
    expect(summary.uncheckedDelegations).toBe(1);
    expect(summary.roles).toEqual([{ role: 'reviewer', count: 1, tokens: null, durationMs: null, editedFiles: null }]);
  });

  it('팀원이 고친 파일은 팀원 기록과 파일 순위에 들어간다', () => {
    const withEdits: JournalSession = {
      ...claude,
      delegations: claude.delegations.map((item) => ({ ...item, tokens: 100, durationMs: 2000, edited: { 'C:\\work\\app\\README.md': 2 } })),
    };
    const summary = buildActivitySummary([withEdits], PROJECT);
    expect(summary.roleEdits).toEqual([{ role: 'reviewer', tool: 'claude-code', sessionId: 's1', at: '2026-11-20T01:01:00Z', files: ['README.md'] }]);
    expect(summary.roles[0]).toMatchObject({ tokens: 100, durationMs: 2000, editedFiles: 1 });
    expect(summary.topFiles.find((file) => file.path === 'README.md')?.edits).toBe(2);
    expect(summary.uncheckedDelegations).toBe(0);
  });

  it('프로젝트 경로 안팎을 나눠 적는다', () => {
    expect(relativeToProject('c:\\WORK\\app\\src\\x.ts', 'C:\\work\\app\\')).toBe('src/x.ts');
    expect(relativeToProject('C:\\work\\app-two\\x.ts', 'C:\\work\\app')).toBe('C:/work/app-two/x.ts');
    expect(relativeToProject('src/x.ts', 'C:\\work\\app')).toBe('src/x.ts');
  });

  it('대화 제목은 "계속해" 같은 짧은 말을 건너뛴다', () => {
    expect(pickTitle(['응', '계속해', '결제 모듈의 환불 버그를 고쳐 줘'])).toBe('결제 모듈의 환불 버그를 고쳐 줘');
    expect(pickTitle(['응'], '')).toBe('응');
    expect(pickTitle([], '  처음   말 ')).toBe('처음 말');
    expect(pickTitle(['가'.repeat(300)]).length).toBeLessThanOrEqual(101);
  });

  it('대화가 없으면 빈 요약이다', () => {
    const summary = buildActivitySummary([], PROJECT);
    expect(summary.totals).toMatchObject({ sessions: 0, turns: 0, editCount: 0 });
    expect(summary.sessions).toEqual([]);
  });
});

describe('활동: 권한 점검', () => {
  const records = [
    { role: 'reviewer', tool: 'codex-cli' as const, sessionId: 'a', at: '2026-11-20T01:00:00Z', files: ['src/a.ts'] },
    { role: 'reviewer', tool: 'claude-code' as const, sessionId: 'b', at: '2026-11-21T01:00:00Z', files: ['src/a.ts', 'src/b.ts'] },
    { role: 'writer', tool: 'codex-cli' as const, sessionId: 'a', files: ['src/c.ts'] },
  ];

  it('지금 읽기 전용인 팀원이 파일을 고친 기록만 짚는다', () => {
    const check = checkPermissions(records, [
      { name: 'reviewer', permission: 'read-only' },
      { name: 'writer', permission: 'edit' },
    ]);
    expect(check.readOnlyRoles).toEqual(['reviewer']);
    expect(check.issues).toEqual([{ role: 'reviewer', times: 2, files: ['src/a.ts', 'src/b.ts'], lastAt: '2026-11-21T01:00:00Z', tools: ['codex-cli', 'claude-code'] }]);
  });

  it('읽기 전용 팀원이 없거나 고친 기록이 없으면 문제가 없다', () => {
    expect(checkPermissions(records, [{ name: 'writer', permission: 'edit' }]).issues).toEqual([]);
    expect(checkPermissions([], [{ name: 'reviewer', permission: 'read-only' }])).toEqual({ readOnlyRoles: ['reviewer'], issues: [] });
  });
});

describe('업무 일지: 위임 계보', () => {
  const session = (items: { id: string; role: string; parentId?: string }[]): JournalSession => ({
    tool: 'codex-cli',
    id: 's',
    firstPrompt: '',
    skippedLines: 0,
    delegations: items.map((item) => ({ ...item, instruction: '', status: 'done' as const })),
  });

  it('누가 누구에게 맡겼는지 나무로 만든다', () => {
    const tree = buildLineage(
      session([
        { id: '1', role: 'writer' },
        { id: '2', role: 'tester', parentId: '1' },
        { id: '3', role: 'reviewer' },
      ]),
    );
    expect(tree.map((node) => [node.role, node.children.map((child) => child.role)])).toEqual([
      ['writer', ['tester']],
      ['reviewer', []],
    ]);
  });

  it('부모가 목록에 없거나 순환해도 버리지 않고 메인 AI가 맡긴 것으로 둔다', () => {
    const tree = buildLineage(
      session([
        { id: '1', role: 'a', parentId: 'missing' },
        { id: '2', role: 'b', parentId: '3' },
        { id: '3', role: 'c', parentId: '2' },
        { id: '4', role: 'd', parentId: '4' },
      ]),
    );
    const count = (nodes: typeof tree): number => nodes.reduce((sum, node) => sum + 1 + count(node.children), 0);
    expect(count(tree)).toBe(4);
  });
});

describe('활동: 이어하기(resume)로 복사된 줄 걸러내기', () => {
  const at = (minute: number) => `2026-11-20T01:0${minute}:00Z`;
  const user = (text: string, minute: number) => line({ type: 'user', timestamp: at(minute), message: { role: 'user', content: text } });
  const assistant = (id: string, blocks: unknown[], tokensOut: number, minute: number) =>
    line({ type: 'assistant', timestamp: at(minute), message: { id, role: 'assistant', content: blocks, usage: { output_tokens: tokensOut } } });
  const agent = (id: string) => tool(id, 'Agent', { subagent_type: 'reviewer', description: '검토', prompt: '봐 줘' });

  const original = [
    user('로그인 버그를 고쳐 줘', 0),
    assistant('m1', [tool('e1', 'Edit', { file_path: 'C:\work\app\src\a.ts' }), agent('d1')], 100, 1),
  ];
  // 이어하기: 앞 줄이 그대로 복사되고(줄 uuid는 새로 매겨져도 키는 같다), 새 일이 뒤에 붙는다
  const resumed = [...original, user('이어서 결제 화면도 고쳐 줘', 5), assistant('m2', [tool('e2', 'Write', { file_path: 'C:\work\app\src\b.ts' })], 40, 6)];

  it('복사된 앞부분은 처음 대화에만 세고, 이어서 한 일만 새 대화에 남긴다', () => {
    const first = readClaude(original, true);
    const second = readClaude(resumed, true);
    const [a, b] = dedupeSessions([first, second]);
    expect(a.activity).toMatchObject({ turns: 1, edits: { 'C:\work\app\src\a.ts': 1 }, outputTokens: 100 });
    expect(a.delegations).toHaveLength(1);
    expect(b.activity).toMatchObject({ turns: 1, edits: { 'C:\work\app\src\b.ts': 1 }, outputTokens: 40 });
    expect(b.delegations).toHaveLength(0);
    // 제목과 시작 시각도 복사된 앞부분이 아니라 이 대화 자신의 것이다
    expect(b.firstPrompt).toBe('이어서 결제 화면도 고쳐 줘');
    expect(b.startedAt).toBe(at(5));
    expect(b.activity?.items).toBeUndefined();
  });

  it('요약 숫자가 부풀려지지 않는다 (복사본을 더해도 같다)', () => {
    const first = readClaude(original, true);
    const alone = buildActivitySummary(dedupeSessions([first]), PROJECT);
    const withCopies = buildActivitySummary(dedupeSessions([first, readClaude(resumed, true), readClaude(original, true)]), PROJECT);
    expect(alone.totals).toMatchObject({ sessions: 1, turns: 1, editCount: 1 });
    // 대화 수는 하나 늘지만(이어서 한 일이 있는 대화), 첫 대화의 일은 한 번만 센다
    expect(withCopies.totals).toMatchObject({ sessions: 2, turns: 2, editCount: 2, claudeOutputTokens: 140 });
    expect(withCopies.roles).toEqual([expect.objectContaining({ role: 'reviewer', count: 1 })]);
  });

  it('새로 한 일이 없는(복사만 된) 대화는 뺀다', () => {
    const result = dedupeSessions([readClaude(original, true), readClaude(original, true)]);
    expect(result).toHaveLength(1);
  });

  it('항목 키가 없는 대화(Codex, lite가 아닌 읽기)는 그대로 둔다', () => {
    const plain = readClaude(original);
    const [kept] = dedupeSessions([plain, readClaude(original)]);
    expect(kept).toBe(plain);
    expect(dedupeSessions([plain, plain])).toHaveLength(2);
  });
});
