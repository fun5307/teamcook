// 이 서비스의 모든 화면이 읽고 쓰는 데이터 모델.
// PROJECT_BRIEF.md 4.1의 초안을 2026-11-16 공식 문서 재확인 결과에 맞춰 다듬었다.

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'xai';

/** 실행 엔진: 실제로 에이전트를 돌리는 도구 */
export type EngineId =
  | 'codex-cli'
  | 'claude-code'
  | 'antigravity-cli'
  | 'grok-build'
  | 'api'
  | 'manual';

/**
 * 카드의 권한.
 * - read-only: 읽기만 (검토자·조사원)
 * - edit: 파일 수정 가능
 * - full: 따로 제한하지 않음 = 부모(메인) 세션의 설정을 그대로 따름
 *
 * 주의(2026-11-16 확인): 에이전트 파일로는 권한을 "줄이거나 부탁"할 수만 있다.
 * Codex는 에이전트 파일로 샌드박스를 바꿀 수 없고, Claude Code는 tools 목록으로 줄일 수만 있다.
 */
export type Permission = 'read-only' | 'edit' | 'full';

/** 역할 태그. 경로 해석기가 '무거운 역할 / 가벼운 역할 / 검토자'를 구분할 때 쓴다. */
export type RoleTag =
  | 'writer'
  | 'implementer'
  | 'reviewer'
  | 'researcher'
  | 'planner'
  | 'synthesizer';

/** 특정 형식에만 있는 필드를 버리지 않고 보관하는 곳 (왕복 손실 방지) */
export interface CardExtra {
  /** Codex TOML에만 있는 필드 (예: model_reasoning_effort, skills) */
  codex?: Record<string, unknown>;
  /** Claude 머리말에만 있는 필드 (예: permissionMode, maxTurns) */
  claude?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 에이전트 카드 */
export interface AgentCard {
  id: string;
  /** 영문 소문자·숫자·하이픈·밑줄 (파일 이름이 됨) */
  name: string;
  /** 화면 표시용 (한글 가능) */
  displayName: string;
  /** 한 줄 역할 설명 → description */
  role: string;
  /** 지시문 → Codex developer_instructions / Claude 본문 */
  instructions: string;
  preferredEngine: EngineId;
  /** preferredEngine용 모델 이름. 다른 형식으로 내보낼 때는 쓰지 않는다. */
  model?: string;
  permission: Permission;
  /** Claude용 도구 목록 (선택). 없으면 permission에 맞는 기본 목록을 쓴다. */
  tools?: string[];
  /** 'writer' | 'reviewer' | 'researcher' 등 (RoleTag 권장) */
  tags?: string[];
  extra?: CardExtra;
}

/** 넘겨주기 (캔버스의 화살표) */
export interface Handoff {
  id: string;
  /** AgentCard.id */
  from: string;
  /** AgentCard.id */
  to: string;
  /** 예: '초안 전달', '검토 결과' */
  label?: string;
}

/** 공유 링크 형식 버전. 구조를 바꾸면 올리고, 옛 버전을 읽는 코드는 남긴다. */
export const RECIPE_SCHEMA_VERSION = 1 as const;

/** 레시피 = 공유 가능한 팀 (서비스의 중심 데이터) */
export interface Recipe {
  schemaVersion: typeof RECIPE_SCHEMA_VERSION;
  id: string;
  title: string;
  /** 무엇을 하는 레시피인지 한두 줄 */
  summary: string;
  /** 예: '기능 구현 후 검토', '자료 조사' */
  useCase: string;
  /** 선택: 닉네임 */
  author?: string;
  cards: AgentCard[];
  handoffs: Handoff[];
  settings: {
    /** 동시에 돌릴 에이전트 수 → Codex [agents] max_concurrent_threads_per_session */
    maxThreads: number;
    /**
     * 에이전트가 에이전트를 부르는 깊이.
     * 2026-11-16 기준 Codex 공식 설정표에 대응 키가 없어 내보내지 않는다 (호환용으로만 보관).
     */
    maxDepth: number;
  };
  /** 실행 팁 (예: 첫 프롬프트 예시) */
  howToRun?: string;
}

/** 사용자가 체크하는 '내 AI 현황' */
export interface UserPlans {
  openai: 'none' | 'free' | 'go' | 'plus' | 'pro';
  anthropic: 'none' | 'free' | 'pro' | 'max' | 'ultra';
  google: 'none' | 'free' | 'paid';
  xai: 'none' | 'free' | 'supergrok';
  /** '보유 여부'만. 키 값은 절대 받지 않는다. */
  apiKeys: Partial<Record<ProviderId, boolean>>;
}

/** 실행 경로 사다리: 1 구독 로그인, 2 API 키, 3 무료·제한 경로, 4 수동 */
export type PathLevel = 1 | 2 | 3 | 4;

// ───────────────────────── 제공사 데이터 (providers.json의 모양) ─────────────────────────

export interface PlanInfo {
  id: string;
  label: string;
  paid: boolean;
  price?: string;
}

export interface ProviderInfo {
  /** 회사 이름. 예: 'OpenAI' */
  name: string;
  /** 사람들이 부르는 제품 이름. 예: 'ChatGPT' */
  productName: string;
  plans: PlanInfo[];
  /** API 키(종량제) 안내 한 줄 */
  apiNote: string;
  sourceUrl: string;
  lastVerified: string;
}

/** 엔진을 쓸 수 있는 조건 하나 */
export interface AccessRule {
  path: 1 | 2 | 3;
  /** 이 플랜 중 하나면 쓸 수 있다 (구독·무료 경로) */
  plans?: string[];
  /** true면 해당 제공사 API 키가 있으면 쓸 수 있다 */
  apiKey?: boolean;
  /** 경로 설명. 예: 'ChatGPT Plus·Pro 로그인' */
  label: string;
  /** '필요한 플랜' 배지 문구. 예: 'Claude Pro 필요', 'ChatGPT 무료' */
  badge?: string;
  /** 이 조건이 무료인지 */
  free?: boolean;
  /** 사용자에게 그대로 보여 줄 주의 문장 */
  notes: string[];
}

export interface EngineInfo {
  name: string;
  provider: ProviderId | null;
  /** ready: 설정 파일 내보내기 지원 / preparing: 준비 중 / builtin: api·manual 같은 내부용 */
  status: 'ready' | 'preparing' | 'builtin';
  /** 설정 파일 위치. 예: '.codex/agents/*.toml' */
  configFormat?: string;
  access: AccessRule[];
  /** 막혔을 때 보여 줄 이유. 예: 'Claude Code는 Pro 이상에서만 쓸 수 있어요' */
  lockReason: string;
  /** official: 공식 문서로 확인 / third-party: 제3자 자료만 확인 */
  confidence: 'official' | 'third-party';
  sourceUrl: string;
  lastVerified: string;
}

export interface ProviderData {
  schemaVersion: 1;
  lastVerified: string;
  providers: Record<ProviderId, ProviderInfo>;
  engines: Record<EngineId, EngineInfo>;
}
