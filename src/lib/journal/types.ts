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
  /** 이 일을 맡긴 팀원의 id (Delegation.id). 없으면 메인 AI가 직접 맡긴 것. Codex는 팀원이 또 팀원에게 맡길 수 있다. */
  parentId?: string;
  /**
   * 이 팀원이 고친 파일(경로 → 고친 횟수). 파일 수정 도구(Claude Code의 Edit·Write, Codex의 FileChange)로 남은 것만 센다.
   * 없으면 '모름'(세부 기록을 읽지 않았다), 빈 객체면 '고친 기록 없음'이다. 셸 명령으로 바꾼 파일은 알 수 없다.
   */
  edited?: Record<string, number>;
}

/** 대화 하나에서 메인 AI가 한 일의 통계 (기록에 남은 것만) */
export interface SessionActivity {
  /** 사용자가 직접 친 말의 수 */
  turns: number;
  /** 사용자가 처음 친 말 몇 개 (대화 제목 고르는 데 쓴다. 길이를 자른다) */
  prompts: string[];
  /** 도구 이름별 사용 횟수 */
  toolCounts: Record<string, number>;
  /** 메인 AI가 고친 파일 (경로 → 고친 횟수) */
  edits: Record<string, number>;
  /** Claude Code: 메시지마다 한 번씩 센 출력 토큰의 합 */
  outputTokens?: number;
  /** Codex: 도구가 기록한 토큰 합계 */
  totalTokens?: number;
  /**
   * 항목마다 고유 키를 단 원본 목록 (활동 요약용 lite로 읽을 때만 있다).
   * Claude Code의 이어하기(resume)는 앞 대화의 줄을 새 파일에 복사해서, 같은 일이 여러 파일에 들어 있다.
   * 줄의 uuid는 복사할 때 새로 매겨져 쓸 수 없고, 아래 키들은 복사본에서도 그대로여서 겹침을 걸러내는 데 쓴다.
   */
  items?: ActivityItems;
}

export interface ActivityItems {
  /** 사용자가 직접 친 말. key = 보낸 시각 + 글 앞부분 */
  prompts: { key: string; text: string; at?: string }[];
  /** 도구 호출. id = tool_use id. edit = 파일 고침 도구면 고친 경로 */
  tools: { id: string; name: string; at?: string; edit?: string }[];
  /** 메시지 id → 출력 토큰 */
  outputs: Record<string, number>;
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
  /** 메인 AI가 한 일의 통계 */
  activity?: SessionActivity;
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
