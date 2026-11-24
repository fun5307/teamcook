// Claude Code 대화 기록(~/.claude/projects/<프로젝트>/<세션>.jsonl)을 업무 일지로 바꾼다.
// 위치는 공식 문서에 있다: 서브에이전트 기록은 <세션>/subagents/agent-<agentId>.jsonl (code.claude.com/docs/en/sub-agents).
// 줄 형식은 문서에 없어, 2026-11-17에 이 컴퓨터의 실제 기록(Claude Code)에서 본 모양을 따른다:
//   - 맡기기: assistant 줄의 tool_use (name 'Agent' 또는 예전 이름 'Task'), input {subagent_type, description, prompt}
//   - 돌려받기: user 줄의 tool_result (tool_use_id로 짝) + 같은 줄의 toolUseResult {agentId, totalTokens, totalDurationMs, totalToolUseCount, status}
// 기록 파일은 수십 MB가 될 수 있어 한 줄씩 넣는다 (addLine). 관계없는 줄은 JSON으로 풀지도 않는다.

import type { ActivityItems, AgentStep, Delegation, JournalSession, SessionActivity } from './types';

const AGENT_TOOLS = new Set(['Agent', 'Task']);
/** 파일을 고치는 도구. 셸 명령(Bash)으로 바꾼 파일은 기록만으로는 알 수 없어 세지 않는다. */
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
/** 요약용(lite)으로 읽을 때 글 하나를 이 길이에서 자른다 (요약에는 긴 글이 필요 없고 메모리를 아낀다) */
export const LITE_TEXT = 400;
/** 대화 제목을 고를 때 쓰려고 사용자의 처음 말 몇 개만 둔다 */
export const MAX_PROMPTS = 5;

export interface BuilderOptions {
  /** true면 시킨 말·돌려받은 말을 LITE_TEXT에서 자른다 (활동 요약용) */
  lite?: boolean;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** content가 문자열이거나 [{type:'text', text}] 배열일 때 글만 모은다 */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => (isObject(block) && block.type === 'text' ? (str(block.text) ?? '') : ''))
    .filter(Boolean)
    .join('\n');
}

/** 사용자가 직접 친 말인지 (도구 결과, 시스템이 끼워 넣은 글이 아닌지) */
function isHumanPrompt(text: string): boolean {
  const trimmed = text.trim();
  return trimmed !== '' && !trimmed.startsWith('<') && !trimmed.startsWith('[Request interrupted');
}

/** 도구 호출이 파일을 고치는 것이면 그 경로를 돌려준다 */
function editedPath(block: Json): string | undefined {
  const name = str(block.name) ?? '';
  if (!EDIT_TOOLS.has(name) || !isObject(block.input)) return undefined;
  return str(block.input.file_path) ?? str(block.input.notebook_path);
}

export class ClaudeSessionBuilder {
  private session: JournalSession;
  private byToolUse = new Map<string, Delegation>();
  private lite: boolean;
  private turns = 0;
  private prompts: string[] = [];
  private toolCounts: Record<string, number> = {};
  private edits: Record<string, number> = {};
  /** 같은 도구 호출이 스트리밍으로 여러 줄에 반복돼도 한 번만 센다 */
  private seenToolUse = new Set<string>();
  /** 메시지 id → 출력 토큰. 같은 메시지가 여러 줄에 반복되므로 id마다 한 번만 센다 */
  private outputByMessage = new Map<string, number>();
  /** lite일 때 이어하기 복사본을 걸러내려고 항목마다 키를 남긴다 */
  private items: Pick<ActivityItems, 'prompts' | 'tools'> = { prompts: [], tools: [] };

  constructor(id: string, options: BuilderOptions = {}) {
    this.lite = options.lite === true;
    this.session = { tool: 'claude-code', id, firstPrompt: '', delegations: [], skippedLines: 0 };
  }

  private clip(text: string): string {
    return this.lite && text.length > LITE_TEXT ? `${text.slice(0, LITE_TEXT)}…` : text;
  }

  /** 사용자가 직접 친 말 하나를 센다 */
  private human(text: string, at?: string): void {
    const trimmed = text.trim();
    this.turns += 1;
    if (this.lite) this.items.prompts.push({ key: `${at ?? ''}|${trimmed.slice(0, 80)}`, text: trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed, ...(at ? { at } : {}) });
    if (this.prompts.length < MAX_PROMPTS) this.prompts.push(trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed);
    if (!this.session.firstPrompt) this.session.firstPrompt = this.clip(trimmed);
  }

  addLine(line: string): void {
    // 맡기기·돌려받기·사람의 말이 들어갈 수 있는 줄만 푼다
    if (!line.includes('"type":"assistant"') && !line.includes('"type":"user"')) return;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      this.session.skippedLines += 1;
      return;
    }
    if (!isObject(entry) || entry.isSidechain === true) return;
    const message = isObject(entry.message) ? entry.message : null;
    if (!message) return;
    const at = str(entry.timestamp);
    if (at) {
      this.session.startedAt ??= at;
      this.session.endedAt = at;
    }
    this.session.cwd ??= str(entry.cwd);
    const blocks = Array.isArray(message.content) ? message.content.filter(isObject) : [];

    if (entry.type === 'assistant') {
      const said = textOf(message.content);
      if (said.trim()) this.session.finalAnswer = this.clip(said);
      const messageId = str(message.id);
      const usage = isObject(message.usage) ? num(message.usage.output_tokens) : undefined;
      if (messageId && usage !== undefined) {
        this.outputByMessage.set(messageId, Math.max(usage, this.outputByMessage.get(messageId) ?? 0));
      }
      for (const block of blocks) {
        if (block.type !== 'tool_use') continue;
        const toolId = str(block.id);
        const name = str(block.name) ?? '';
        if (name && toolId && !this.seenToolUse.has(toolId)) {
          this.seenToolUse.add(toolId);
          this.toolCounts[name] = (this.toolCounts[name] ?? 0) + 1;
          const edited = editedPath(block);
          if (edited) this.edits[edited] = (this.edits[edited] ?? 0) + 1;
          if (this.lite) this.items.tools.push({ id: toolId, name, ...(at ? { at } : {}), ...(edited ? { edit: edited } : {}) });
        }
        if (!AGENT_TOOLS.has(name)) continue;
        const input = isObject(block.input) ? block.input : {};
        const id = str(block.id);
        if (!id || this.byToolUse.has(id)) continue;
        const delegation: Delegation = {
          id,
          role: str(input.subagent_type) || 'general-purpose',
          instruction: this.clip(str(input.prompt) ?? ''),
          status: 'unknown',
        };
        const title = str(input.description);
        if (title) delegation.title = title;
        if (at) delegation.startedAt = at;
        this.byToolUse.set(id, delegation);
        this.session.delegations.push(delegation);
      }
      return;
    }

    if (entry.type === 'user') {
      if (typeof message.content === 'string') {
        if (entry.isMeta !== true && isHumanPrompt(message.content)) this.human(message.content, at);
        return;
      }
      let counted = false;
      for (const block of blocks) {
        // 사용자가 한 번 보낸 메시지에 글 조각이 여럿이어도 한 번으로 센다
        if (block.type === 'text' && !counted && entry.isMeta !== true && isHumanPrompt(str(block.text) ?? '')) {
          counted = true;
          this.human(str(block.text) ?? '', at);
        }
        if (block.type !== 'tool_result') continue;
        const delegation = this.byToolUse.get(str(block.tool_use_id) ?? '');
        if (!delegation) continue;
        const detail = isObject(entry.toolUseResult) ? entry.toolUseResult : {};
        delegation.result = this.clip(textOf(detail.content) || textOf(block.content));
        delegation.status = block.is_error === true || detail.status === 'failed' ? 'failed' : 'done';
        const tokens = num(detail.totalTokens);
        if (tokens !== undefined) delegation.tokens = tokens;
        const duration = num(detail.totalDurationMs);
        if (duration !== undefined) delegation.durationMs = duration;
        const tools = num(detail.totalToolUseCount);
        if (tools !== undefined) delegation.toolCount = tools;
        const agentId = str(detail.agentId);
        if (agentId) delegation.agentId = agentId;
      }
    }
  }

  result(): JournalSession {
    const activity: SessionActivity = { turns: this.turns, prompts: this.prompts, toolCounts: this.toolCounts, edits: this.edits };
    if (this.outputByMessage.size > 0) {
      activity.outputTokens = [...this.outputByMessage.values()].reduce((sum, value) => sum + value, 0);
    }
    if (this.lite) activity.items = { prompts: this.items.prompts, tools: this.items.tools, outputs: Object.fromEntries(this.outputByMessage) };
    this.session.activity = activity;
    return this.session;
  }
}

/** 서브에이전트 기록 파일(agent-<id>.jsonl)에서 그 팀원이 고친 파일(경로 → 횟수)을 모은다. 한 줄씩 넣는다. */
export class ClaudeAgentEditsBuilder {
  private edits: Record<string, number> = {};
  private seen = new Set<string>();

  addLine(line: string): void {
    // 파일 고치는 도구 호출이 들어 있을 수 있는 줄만 푼다
    if (!line.includes('"tool_use"') || !line.includes('"type":"assistant"')) return;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      return;
    }
    if (!isObject(entry) || !isObject(entry.message) || !Array.isArray(entry.message.content)) return;
    for (const block of entry.message.content.filter(isObject)) {
      if (block.type !== 'tool_use') continue;
      const id = str(block.id);
      if (id) {
        if (this.seen.has(id)) continue;
        this.seen.add(id);
      }
      const path = editedPath(block);
      if (path) this.edits[path] = (this.edits[path] ?? 0) + 1;
    }
  }

  result(): Record<string, number> {
    return this.edits;
  }
}

export function parseClaudeSession(text: string, id: string): JournalSession {
  const builder = new ClaudeSessionBuilder(id);
  for (const line of text.split('\n')) if (line) builder.addLine(line);
  return builder.result();
}

/** 도구 호출을 한 줄로: 이름과 가장 알아보기 쉬운 대상 하나 */
function toolLine(name: string, input: Json): string {
  const target = str(input.file_path) ?? str(input.path) ?? str(input.pattern) ?? str(input.command) ?? str(input.url) ?? str(input.query) ?? str(input.description);
  return target ? `${name} ${target.replace(/\s+/g, ' ').slice(0, 140)}` : name;
}

/** 서브에이전트 기록 파일(agent-<id>.jsonl)에서 그 역할이 한 일을 차례로 뽑는다 */
export function parseClaudeAgentSteps(text: string): AgentStep[] {
  const steps: AgentStep[] = [];
  for (const line of text.split('\n')) {
    if (!line.includes('"type":"assistant"')) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isObject(entry) || !isObject(entry.message) || !Array.isArray(entry.message.content)) continue;
    const at = str(entry.timestamp);
    for (const block of entry.message.content.filter(isObject)) {
      if (block.type === 'text' && str(block.text)?.trim()) {
        steps.push({ kind: 'say', text: str(block.text)!.trim(), ...(at ? { at } : {}) });
      } else if (block.type === 'tool_use') {
        steps.push({ kind: 'tool', text: toolLine(str(block.name) ?? '도구', isObject(block.input) ? block.input : {}), ...(at ? { at } : {}) });
      }
    }
  }
  return steps;
}

/** 프로젝트 폴더 경로에서 Claude Code가 쓰는 기록 폴더 이름을 만든다. 예: 'c:\\claude-MCP' → 'c--claude-MCP' */
export function claudeProjectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}
