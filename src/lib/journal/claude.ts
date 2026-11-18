// Claude Code 대화 기록(~/.claude/projects/<프로젝트>/<세션>.jsonl)을 업무 일지로 바꾼다.
// 위치는 공식 문서에 있다: 서브에이전트 기록은 <세션>/subagents/agent-<agentId>.jsonl (code.claude.com/docs/en/sub-agents).
// 줄 형식은 문서에 없어, 2026-11-17에 이 컴퓨터의 실제 기록(Claude Code)에서 본 모양을 따른다:
//   - 맡기기: assistant 줄의 tool_use (name 'Agent' 또는 예전 이름 'Task'), input {subagent_type, description, prompt}
//   - 돌려받기: user 줄의 tool_result (tool_use_id로 짝) + 같은 줄의 toolUseResult {agentId, totalTokens, totalDurationMs, totalToolUseCount, status}
// 기록 파일은 수십 MB가 될 수 있어 한 줄씩 넣는다 (addLine). 관계없는 줄은 JSON으로 풀지도 않는다.

import type { AgentStep, Delegation, JournalSession } from './types';

const AGENT_TOOLS = new Set(['Agent', 'Task']);

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

export class ClaudeSessionBuilder {
  private session: JournalSession;
  private byToolUse = new Map<string, Delegation>();

  constructor(id: string) {
    this.session = { tool: 'claude-code', id, firstPrompt: '', delegations: [], skippedLines: 0 };
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
      if (said.trim()) this.session.finalAnswer = said;
      for (const block of blocks) {
        if (block.type !== 'tool_use' || !AGENT_TOOLS.has(str(block.name) ?? '')) continue;
        const input = isObject(block.input) ? block.input : {};
        const id = str(block.id);
        if (!id || this.byToolUse.has(id)) continue;
        const delegation: Delegation = {
          id,
          role: str(input.subagent_type) || 'general-purpose',
          instruction: str(input.prompt) ?? '',
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
        if (!this.session.firstPrompt && entry.isMeta !== true && isHumanPrompt(message.content)) {
          this.session.firstPrompt = message.content.trim();
        }
        return;
      }
      for (const block of blocks) {
        if (block.type === 'text' && !this.session.firstPrompt && isHumanPrompt(str(block.text) ?? '')) {
          this.session.firstPrompt = (str(block.text) ?? '').trim();
        }
        if (block.type !== 'tool_result') continue;
        const delegation = this.byToolUse.get(str(block.tool_use_id) ?? '');
        if (!delegation) continue;
        const detail = isObject(entry.toolUseResult) ? entry.toolUseResult : {};
        delegation.result = textOf(detail.content) || textOf(block.content);
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
    return this.session;
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
