// 조리법(협업 방식) 정보. 화면 문구, 공식 문서 확인 기록, 내보낼 설정 내용을 여기에만 둔다.
// 사실이 바뀌면 이 파일만 고치면 된다 (확인 날짜와 출처 필수).

import type { Collaboration, Recipe } from '../types';

export interface CollaborationInfo {
  id: Collaboration;
  /** 화면에 보이는 이름 */
  label: string;
  /** 갤러리 카드에 붙는 짧은 이름표 */
  chip: string;
  /** 한두 줄 설명 (쉬운 말) */
  description: string;
  /** 누가 쓸 수 있나 */
  availability: string;
  /** true면 '실험 기능' 경고를 붙인다 */
  experimental: boolean;
  /** 사용자에게 그대로 보여 줄 주의 문장 */
  notes: string[];
  /** 확인한 공식 문서 (없으면 도구와 무관한 방식) */
  sourceUrl?: string;
  lastVerified?: string;
}

export const COLLABORATIONS: Record<Collaboration, CollaborationInfo> = {
  subagents: {
    id: 'subagents',
    label: '서브에이전트',
    chip: '서브에이전트',
    description:
      '메인 AI가 일을 나눠 서브에이전트에게 맡기고, 결과만 돌려받습니다. 서브에이전트끼리는 서로 대화하지 않아요. 가장 무난하고 사용량도 적게 듭니다.',
    availability: 'Codex, Claude Code 등 카드마다 고른 도구에서',
    experimental: false,
    notes: [],
  },
  'agent-team': {
    id: 'agent-team',
    label: '에이전트 팀',
    chip: '에이전트 팀',
    description:
      'Claude Code가 리더가 되어 팀원을 여럿 띄웁니다. 팀원끼리 직접 대화하고 할 일 목록을 함께 쓰기 때문에, 서로 의견을 주고받아야 하는 일에 맞아요.',
    availability: 'Claude Code에서만 (실험 기능)',
    experimental: true,
    notes: [
      '에이전트 팀은 Claude Code의 실험 기능이에요. 기본으로 꺼져 있어서 설정 파일로 켜야 하고, 동작이 바뀔 수 있어요.',
      '팀원 수만큼 사용량이 늘어요. 공식 문서는 3~5명으로 시작하라고 권합니다.',
      '리더는 처음 연 Claude Code 대화창으로 고정돼요. 팀원이 또 팀을 만들 수는 없어요.',
      '대화를 이어서 열면(/resume) 팀원은 되살아나지 않아요. 리더에게 팀원을 다시 만들라고 하세요.',
      '팀원이 일을 끝내고도 "완료" 표시를 빠뜨릴 때가 있어요. 멈춘 것 같으면 리더에게 확인을 부탁하세요.',
    ],
    sourceUrl: 'https://code.claude.com/docs/en/agent-teams',
    lastVerified: '2026-11-16',
  },
  debate: {
    id: 'debate',
    label: '토론형',
    chip: '토론형',
    description:
      '설정 파일 없이 프롬프트 하나로 돌립니다. AI 하나가 여러 역할을 번갈아 맡아 토론하고 결론을 냅니다. 무료 웹 채팅을 포함해 어느 AI에서나 붙여 넣으면 돼요.',
    availability: '어느 AI에서나 (무료 웹 채팅 포함)',
    experimental: false,
    notes: [
      '한 AI가 여러 역할을 연기하는 방식이라, 서로 다른 모델이 검토하는 것만큼 독립적이지는 않아요. 중요한 결정은 다른 AI에도 같은 프롬프트를 넣어 비교해 보세요.',
    ],
  },
};

export const COLLABORATION_IDS = Object.keys(COLLABORATIONS) as Collaboration[];

/** 레시피의 조리법. 없거나 모르는 값이면 'subagents'. */
export function collaborationOf(recipe: Pick<Recipe, 'collaboration'>): Collaboration {
  const value = recipe.collaboration;
  return value && value in COLLABORATIONS ? value : 'subagents';
}

/**
 * 에이전트 팀을 켜는 프로젝트용 설정 (`.claude/settings.json`).
 * 2026-11-16 확인: https://code.claude.com/docs/en/agent-teams
 * 사용자의 `~/.claude/settings.json`은 건드리지 않는다. 프로젝트 폴더용 파일만 내보낸다.
 */
export const AGENT_TEAMS_ENV_NAME = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';
export const AGENT_TEAMS_SETTINGS = { env: { [AGENT_TEAMS_ENV_NAME]: '1' } };
export const AGENT_TEAMS_SETTINGS_JSON = `${JSON.stringify(AGENT_TEAMS_SETTINGS, null, 2)}\n`;

/** 이미 `.claude/settings.json`이 있는 사람에게 보여 줄 병합 안내 */
export const AGENT_TEAMS_MERGE_HINT =
  `이미 .claude/settings.json이 있다면 덮어쓰지 말고, 그 파일의 "env" 안에 "${AGENT_TEAMS_ENV_NAME}": "1" 한 줄만 더하세요.`;

/** 오늘 날짜 (YYYY-MM-DD, 내 PC 시간 기준) */
export function today(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
