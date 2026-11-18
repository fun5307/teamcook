// Codex 대화 기록(~/.codex/sessions/연/월/일/rollout-*.jsonl)을 업무 일지로 바꾼다.
// 이 위치와 줄 형식은 공식 문서에서 찾지 못했다 (2026-11-17). 이 컴퓨터의 실제 기록에서 본 모양을 따른다:
//   - 첫 줄 session_meta: payload {id, cwd, timestamp, parent_thread_id?, agent_role?, agent_nickname?}
//     서브에이전트는 파일이 따로 있고, parent_thread_id가 부모 세션을 가리킨다.
//   - response_item + payload.type 'message': role 'user' | 'assistant', content [{text}]
//     thread_source가 'subagent'가 아닌 것(예: 승인 검토용 내부 스레드)은 사용자의 팀원이 아니라서 뺀다.
//     서브에이전트 파일 앞쪽에는 부모의 대화가 복사돼 있고, subagent_history_start_ordinal부터가 자기 기록이다.
//   - response_item + payload.type 'agent_message': {author, recipient, content [{text}]} 에이전트끼리 주고받은 말.
//     서브에이전트 파일의 첫 agent_message가 "시킨 말"이다.
//   - event_msg + payload.type 'token_count': info.total_token_usage.total_tokens (마지막 것이 합계)
// 형식이 바뀌면 읽지 못할 수 있다. 모르는 줄은 건너뛴다.

import type { Delegation, JournalSession } from './types';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** 기록 파일 하나를 읽은 것 */
export interface CodexRollout {
  id: string;
  parentId?: string;
  role?: string;
  nickname?: string;
  cwd?: string;
  startedAt?: string;
  endedAt?: string;
  /** 'subagent'면 사용자가 부른 팀원, 다른 값이면 도구 내부용 스레드 */
  threadSource?: string;
  userMessages: string[];
  assistantMessages: string[];
  /** 에이전트끼리 주고받은 말 */
  agentMessages: { author: string; recipient: string; text: string; at?: string }[];
  totalTokens?: number;
  skippedLines: number;
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => (isObject(block) ? (str(block.text) ?? '') : ''))
    .filter(Boolean)
    .join('\n');
}

/** 도구가 끼워 넣은 글(환경 정보 등)이 아니라 사람이 한 말로 보이는지 */
const looksHuman = (text: string) => {
  const trimmed = text.trim();
  return trimmed !== '' && !trimmed.startsWith('<') && !trimmed.startsWith('# AGENTS.md instructions');
};

export class CodexRolloutBuilder {
  private rollout: CodexRollout = { id: '', userMessages: [], assistantMessages: [], agentMessages: [], skippedLines: 0 };
  /** 이 번호부터가 이 스레드 자신의 기록 (앞은 부모에게서 복사된 것) */
  private ownFrom = 0;

  addLine(line: string): void {
    if (
      !line.includes('"session_meta"') &&
      !line.includes('"response_item"') &&
      !line.includes('"token_count"')
    ) {
      return;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      this.rollout.skippedLines += 1;
      return;
    }
    if (!isObject(entry) || !isObject(entry.payload)) return;
    const payload = entry.payload;
    const at = str(entry.timestamp);
    if (at) {
      this.rollout.startedAt ??= at;
      this.rollout.endedAt = at;
    }
    if (entry.type === 'session_meta') {
      // 서브에이전트 파일에는 부모의 session_meta가 복사돼 또 나올 수 있다. 첫 줄 것만 자기 것이다.
      if (this.rollout.id) return;
      this.rollout.id =str(payload.id) ?? str(payload.session_id) ?? '';
      const parent = str(payload.parent_thread_id);
      if (parent) this.rollout.parentId = parent;
      const role = str(payload.agent_role);
      if (role) this.rollout.role = role;
      const nickname = str(payload.agent_nickname);
      if (nickname) this.rollout.nickname = nickname;
      const cwd = str(payload.cwd);
      if (cwd) this.rollout.cwd = cwd;
      const source = str(payload.thread_source);
      if (source) this.rollout.threadSource = source;
      const start = payload.subagent_history_start_ordinal;
      if (typeof start === 'number') this.ownFrom = start;
      return;
    }
    // 부모에게서 복사된 앞부분은 이 역할이 한 일이 아니다
    if (typeof entry.ordinal === 'number' && entry.ordinal < this.ownFrom) return;
    if (entry.type === 'response_item' && payload.type === 'agent_message') {
      const text = contentText(payload.content);
      if (text.trim()) {
        this.rollout.agentMessages.push({
          author: str(payload.author) ?? '',
          recipient: str(payload.recipient) ?? '',
          text: text.trim(),
          ...(at ? { at } : {}),
        });
      }
      return;
    }
    if (entry.type === 'response_item' && payload.type === 'message') {
      const text = contentText(payload.content);
      if (payload.role === 'user' && looksHuman(text)) this.rollout.userMessages.push(text.trim());
      if (payload.role === 'assistant' && text.trim()) this.rollout.assistantMessages.push(text.trim());
      return;
    }
    if (entry.type === 'event_msg' && payload.type === 'token_count' && isObject(payload.info)) {
      const total = isObject(payload.info.total_token_usage) ? payload.info.total_token_usage.total_tokens : undefined;
      if (typeof total === 'number' && Number.isFinite(total)) this.rollout.totalTokens = total;
    }
  }

  result(): CodexRollout {
    return this.rollout;
  }
}

export function parseCodexRollout(text: string): CodexRollout {
  const builder = new CodexRolloutBuilder();
  for (const line of text.split('\n')) if (line) builder.addLine(line);
  return builder.result();
}

const duration = (rollout: CodexRollout): number | undefined => {
  if (!rollout.startedAt || !rollout.endedAt) return undefined;
  const ms = Date.parse(rollout.endedAt) - Date.parse(rollout.startedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
};

/**
 * 기록 파일 여러 개를 세션으로 묶는다: 부모가 없는 것이 세션이고, parent_thread_id가 가리키는 것이 맡긴 일이다.
 * 부모 기록이 목록에 없는 서브에이전트 기록은 버리지 않고 '부모 기록 없음' 세션으로 따로 보여 준다.
 */
export function buildCodexSessions(rollouts: CodexRollout[]): JournalSession[] {
  // 도구 내부용 스레드(승인 검토 등)는 사용자의 팀원이 아니다
  const usable = rollouts.filter((rollout) => rollout.id && !(rollout.parentId && rollout.threadSource && rollout.threadSource !== 'subagent'));
  const ids = new Set(usable.map((rollout) => rollout.id));
  const toDelegation = (child: CodexRollout): Delegation => {
    const delegation: Delegation = {
      id: child.id,
      role: child.role ?? '기본 에이전트',
      instruction: child.agentMessages[0]?.text ?? '',
      status: child.assistantMessages.length > 0 ? 'done' : 'unknown',
      agentId: child.id,
    };
    if (child.nickname) delegation.title = child.nickname;
    const result = child.assistantMessages[child.assistantMessages.length - 1];
    if (result) delegation.result = result;
    if (child.startedAt) delegation.startedAt = child.startedAt;
    const ms = duration(child);
    if (ms !== undefined) delegation.durationMs = ms;
    if (child.totalTokens !== undefined) delegation.tokens = child.totalTokens;
    return delegation;
  };
  const sessions: JournalSession[] = [];
  for (const rollout of usable) {
    if (rollout.parentId && ids.has(rollout.parentId)) continue;
    const orphan = Boolean(rollout.parentId);
    const session: JournalSession = {
      tool: 'codex-cli',
      id: rollout.id,
      firstPrompt: orphan ? `(부모 기록 없음) ${rollout.role ?? ''} ${rollout.agentMessages[0]?.text ?? ''}`.trim() : (rollout.userMessages[0] ?? ''),
      delegations: orphan
        ? [toDelegation(rollout)]
        : usable
            .filter((child) => child.parentId === rollout.id)
            .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
            .map(toDelegation),
      skippedLines: rollout.skippedLines,
    };
    if (rollout.startedAt) session.startedAt = rollout.startedAt;
    if (rollout.endedAt) session.endedAt = rollout.endedAt;
    if (rollout.cwd) session.cwd = rollout.cwd;
    const final = rollout.assistantMessages[rollout.assistantMessages.length - 1];
    if (final && !orphan) session.finalAnswer = final;
    sessions.push(session);
  }
  return sessions.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
}
