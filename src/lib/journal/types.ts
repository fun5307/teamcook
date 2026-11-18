// 업무 일지: Claude Code와 Codex가 컴퓨터에 남긴 대화 기록에서 "누구에게 무슨 일을 시켰고 무엇을 돌려받았는지"를 뽑은 것.
// 읽기 전용이다. 이 사이트는 아무것도 실행하지 않고, 기록 파일을 고치지도 않는다.
// 주의: 두 도구 모두 기록 파일의 줄 형식을 공식 문서에 적어 두지 않았다 (2026-11-17 확인).
// 그래서 모르는 줄은 조용히 건너뛰고, 못 읽은 것은 "못 읽음"으로 보여 준다. 짐작해서 채우지 않는다.

export type JournalTool = 'claude-code' | 'codex-cli';

/** 맡긴 일 한 건: 메인 AI가 역할 하나에게 시킨 것과 돌려받은 것 */
export interface Delegation {
  id: string;
  /** 역할 이름. 예: 'reviewer' (Claude Code의 subagent_type, Codex의 agent_role) */
  role: string;
  /** 짧은 제목 (있으면) */
  title?: string;
  /** 시킨 말 원문 */
  instruction: string;
  /** 돌려받은 말 원문. 아직 없으면 undefined (진행 중이었거나 기록이 끊김) */
  result?: string;
  status: 'done' | 'failed' | 'unknown';
  startedAt?: string;
  durationMs?: number;
  /** 이 역할이 쓴 토큰 합계 (기록에 적혀 있을 때만) */
  tokens?: number;
  /** 도구를 쓴 횟수 (기록에 적혀 있을 때만) */
  toolCount?: number;
  /** 세부 기록 파일을 찾을 때 쓰는 id (Claude Code의 agentId, Codex의 스레드 id) */
  agentId?: string;
}

export interface JournalSession {
  tool: JournalTool;
  id: string;
  /** 사용자가 처음 한 말 (목록 제목으로 쓴다) */
  firstPrompt: string;
  startedAt?: string;
  endedAt?: string;
  /** 일한 폴더 (기록에 적힌 경로) */
  cwd?: string;
  delegations: Delegation[];
  /** 메인 AI가 사용자에게 한 마지막 말 */
  finalAnswer?: string;
  /** 읽지 못하고 건너뛴 줄 수 */
  skippedLines: number;
}

/** 역할 하나가 일하는 동안의 한 걸음 */
export interface AgentStep {
  kind: 'say' | 'tool';
  /** say: 한 말 / tool: 쓴 도구 이름과 대상 (예: 'Read src/app.ts') */
  text: string;
  at?: string;
}

/** 역할별 합계 (팀 화면의 "누가 얼마나 일했나") */
export interface RoleSummary {
  role: string;
  count: number;
  tokens: number | null;
  durationMs: number | null;
}

export function summarizeRoles(session: JournalSession): RoleSummary[] {
  const map = new Map<string, RoleSummary>();
  for (const item of session.delegations) {
    const row = map.get(item.role) ?? { role: item.role, count: 0, tokens: 0, durationMs: 0 };
    row.count += 1;
    // 하나라도 값이 없으면 합계를 '모름'(null)으로 둔다. 0으로 치지 않는다.
    row.tokens = row.tokens === null || item.tokens === undefined ? null : row.tokens + item.tokens;
    row.durationMs = row.durationMs === null || item.durationMs === undefined ? null : row.durationMs + item.durationMs;
    map.set(item.role, row);
  }
  return [...map.values()];
}
