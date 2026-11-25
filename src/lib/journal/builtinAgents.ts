// Claude Code와 Codex가 기본으로 갖고 있는 도우미(내장 서브에이전트)의 이름과 하는 일.
// 업무 일지에 `web-fetch`, `worker`처럼 사용자가 만든 적 없는 이름이 나오는 까닭이 이것이다. 이 도우미들은 .claude/agents·.codex/agents의
// 파일이 아니라 도구 안에 들어 있다. 기록의 역할 이름(Claude의 subagent_type, Codex의 agent_role)을 이 표에서 찾아 소개를 붙인다.
//
// 확인 (2026-11-25, 공식 문서 확인. 실제 실행 확인은 아래에 적은 것뿐):
//   - Claude Code: https://code.claude.com/docs/en/sub-agents 의 "Built-in subagents" 절 (Explore, Plan, general-purpose + 기타 표의
//     claude, statusline-setup, claude-code-guide, web-fetch). 실제 기록에서도 web-fetch를 확인했다.
//   - Codex: https://developers.openai.com/codex/subagents (default, worker, explorer. 세 가지만 나온다). 실제 기록에서 worker를 확인했다.
//     Codex 쪽 설명은 문서 요약에 기댄 부분이 있어 각 도우미의 권한까지는 단정하지 않는다.
// 도구가 새 도우미를 더하면 이 표에도 더해야 한다. 여기 없는 이름은 "모르는 이름"으로 두고 지어내지 않는다.
// 같은 이름의 팀원 파일이 이 폴더에 있으면 그 팀원이 우선이다 (Codex 문서: 이름이 같은 내 에이전트가 내장보다 우선한다).

import type { JournalTool } from './types';

export interface BuiltinAgent {
  /** 어느 도구의 기본 도우미인가 */
  tool: JournalTool;
  /** 한 줄 소개: "누구일까요?"의 답 */
  who: string;
  /** 하는 일과 못 하는 일 */
  detail: string;
  /** 언제 불리는가 */
  calledWhen: string;
}

const CODEX_CALLED =
  'Codex는 시키는 말이 있거나 AGENTS.md·스킬에 맡기라고 적혀 있을 때 도우미를 불러요. 권한은 메인 에이전트의 설정을 그대로 따라요.';

export const BUILTIN_AGENTS: Record<string, BuiltinAgent> = {
  // ── Claude Code ──
  'web-fetch': {
    tool: 'claude-code',
    who: '웹 페이지를 대신 읽어 오는 심부름꾼',
    detail: '주소의 페이지를 읽고 물어본 것에 답해 돌려줘요. 웹 읽기만 하고 파일은 만지지 못해요.',
    calledWhen: '웹 페이지를 읽어야 할 때 메인 AI가 스스로 불러요.',
  },
  Explore: {
    tool: 'claude-code',
    who: '코드를 훑어 찾아 오는 탐색꾼',
    detail: '파일과 코드를 빠르게 뒤져서 찾고 살펴봐요. 읽기 전용이라 쓰기·편집은 막혀 있어요.',
    calledWhen: '코드를 찾거나 이해만 하면 되고 고칠 필요가 없을 때 메인 AI가 스스로 불러요.',
  },
  Plan: {
    tool: 'claude-code',
    who: '계획 모드에서 코드를 조사해 오는 조사원',
    detail: '계획을 내놓기 전에 코드를 읽고 필요한 정보를 모아 와요. 읽기 전용이라 쓰기·편집은 막혀 있어요.',
    calledWhen: '계획 모드에서 코드를 파악해야 할 때 메인 AI가 스스로 불러요.',
  },
  'general-purpose': {
    tool: 'claude-code',
    who: '탐색도 하고 수정도 하는 만능 도우미',
    detail: '여러 단계가 이어지는 복잡한 일을 맡아요. 도우미가 쓸 수 있는 도구를 모두 쓸 수 있어서 파일도 고쳐요. 역할을 정하지 않고 맡기면 이 도우미가 일해요.',
    calledWhen: '탐색과 수정이 둘 다 필요한 일일 때 메인 AI가 스스로 불러요.',
  },
  claude: {
    tool: 'claude-code',
    who: '맞는 전문 도우미가 없을 때 나서는 일반 도우미',
    detail: '모든 도구를 쓸 수 있는 일반 도우미예요. 백그라운드로 보낸 세션의 기본 에이전트이기도 해요.',
    calledWhen: '더 맞는 전문 도우미가 없을 때 불려요.',
  },
  'claude-code-guide': {
    tool: 'claude-code',
    who: 'Claude Code 사용법을 알려 주는 안내 담당',
    detail: 'Claude Code 기능에 대한 질문에 문서를 찾아 읽고 답해요. 읽기만 해요.',
    calledWhen: 'Claude Code 기능을 물어볼 때 불려요.',
  },
  'statusline-setup': {
    tool: 'claude-code',
    who: 'Claude Code 상태 표시줄을 설정해 주는 도우미',
    detail: '화면 아래의 상태 표시줄 설정을 만들어 줘요.',
    calledWhen: '/statusline을 실행할 때 불려요.',
  },
  // ── Codex ──
  default: {
    tool: 'codex-cli',
    who: '맞는 역할이 없을 때의 기본 도우미',
    detail: '특별한 역할이 정해지지 않은 일반 목적의 대체 도우미예요.',
    calledWhen: CODEX_CALLED,
  },
  worker: {
    tool: 'codex-cli',
    who: '구현과 수정을 맡는 실행 담당',
    detail: '코드를 만들고 고치는 일에 맞춰진 도우미예요.',
    calledWhen: CODEX_CALLED,
  },
  explorer: {
    tool: 'codex-cli',
    who: '코드를 읽으며 살펴 오는 탐색 담당',
    detail: '읽는 일 위주로 코드를 탐색하는 도우미예요. 문서에 별도의 읽기 전용 설정이 있다고 적혀 있지는 않아요.',
    calledWhen: CODEX_CALLED,
  },
};

/**
 * 기본 도우미면 소개를, 아니면 null (이름이 정확히 같을 때만).
 * tool을 주면 그 도구의 도우미일 때만 돌려준다 (활동 탭처럼 도구를 모르면 이름만 본다).
 */
export function builtinAgent(role: string, tool?: JournalTool): BuiltinAgent | null {
  if (!Object.prototype.hasOwnProperty.call(BUILTIN_AGENTS, role)) return null;
  const found = BUILTIN_AGENTS[role]!;
  return tool && found.tool !== tool ? null : found;
}
