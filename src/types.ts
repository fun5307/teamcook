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
  /** Antigravity 머리말에만 있는 필드 (예: commandExecutionPolicy) */
  antigravity?: Record<string, unknown>;
  /** Grok Build 머리말에만 있는 필드 */
  grok?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 역할이 끝날 때 내놓아야 하는 산출물. id는 이름을 바꿔도 그대로다 (넘겨주기가 id로 가리킨다). */
export interface Deliverable {
  id: string;
  name: string;
  description?: string;
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
  /** 이 역할이 일을 시작하려면 받아야 하는 것 */
  requiredInputs?: string[];
  /** 끝날 때 반드시 내놓는 것 (내보내려면 1개 이상) */
  deliverables?: Deliverable[];
  /** 끝났다고 볼 수 있는 조건 (내보내려면 1개 이상) */
  completionCriteria?: string[];
  /** 하지 않을 일, 고치지 않을 범위 */
  boundaries?: string[];
  extra?: CardExtra;
}

/** 넘겨주기 (캔버스의 화살표) */
export interface Handoff {
  id: string;
  /** AgentCard.id */
  from: string;
  /** AgentCard.id */
  to: string;
  /** 추가 전달 설명. 예: '초안 전달', '검토 결과' */
  label?: string;
  /** 넘기는 산출물 (보내는 카드의 Deliverable.id). 지워진 산출물을 가리키면 '재선택 필요'다. */
  deliverableIds?: string[];
}

/**
 * 확인 기록의 종류.
 * - docs: 공식 문서로 확인 / file: 설정 파일이 만들어지는 것을 확인 / run: 실제 도구에서 실행해 확인
 * - unclassified: 예전 형식의 날짜만 있어 무엇을 확인했는지 모름
 */
export type VerificationKind = 'docs' | 'file' | 'run' | 'unclassified';
export type VerificationResult = 'success' | 'failure' | 'n/a';
/** 기록 출처. user: 사용자가 적음 / auto: 자동 점검(테스트) / author: 레시피를 만든 쪽 / unknown: 모름 */
export type VerificationSource = 'user' | 'auto' | 'author' | 'unknown';

/** 확인 기록 한 건. 없는 정보는 비워 둔다 (짐작해서 채우지 않는다). */
export interface VerificationRecord {
  id: string;
  kind: VerificationKind;
  /** YYYY-MM-DD */
  checkedAt: string;
  result: VerificationResult;
  source: VerificationSource;
  tool?: string;
  toolVersion?: string;
  environment?: string;
  note?: string;
}

/**
 * 조리법 = 팀이 함께 일하는 방식.
 * - subagents: 메인 AI가 서브에이전트에게 일을 맡기고 결과를 돌려받는다 (기본값)
 * - agent-team: Claude Code 에이전트 팀. 팀원끼리 직접 대화하고 할 일 목록을 함께 쓴다 (실험 기능, Claude Code 전용)
 * - debate: 토론형. 설정 파일 없이 프롬프트 하나로 여러 역할이 토론한다 (어느 AI에서나)
 */
export type Collaboration = 'subagents' | 'agent-team' | 'debate';

/**
 * 공유 링크·저장 형식 버전. 구조를 바꾸면 올리고, 옛 버전을 읽는 코드는 남긴다 (lib/recipeSchema.ts).
 * - 1: 처음 형식. 확인 날짜를 lastVerified 하나로 적었다.
 * - 2: 학습 목표·성공 조건·역할별 산출물·전달 정보 추가. lastVerified는 verification 기록으로 옮겼다.
 */
export const RECIPE_SCHEMA_VERSION = 2 as const;

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
  /** 조리법(협업 방식). 없으면 'subagents'로 본다. 선택 필드라 schemaVersion은 1 그대로다. */
  collaboration?: Collaboration;
  /** 이 레시피로 무엇을 익히는지 (내보내려면 필수) */
  learningObjective?: string;
  /** 처음 넣어 볼 과제의 예 */
  sampleTask?: string;
  /** 실습이 성공했다고 볼 조건 (내보내려면 1개 이상) */
  successCriteria?: string[];
  /** 시작 전에 갖춰야 할 것 */
  prerequisites?: string[];
  /** 확인 기록. 문서 확인, 파일 생성 확인, 실제 실행 확인을 구분한다. */
  verification?: VerificationRecord[];
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
  google: 'none' | 'free' | 'plus' | 'pro' | 'ultra';
  /** supergrok = 2026-10 X 구독 이전의 SuperGrok·X Premium+ (그대로 쓸 수 있다) */
  xai: 'none' | 'free' | 'plus' | 'premium' | 'super' | 'ultra' | 'supergrok';
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
  /** 요금제 구성 안내 한 줄 (예: Ultra는 5배·20배가 있다). 내 AI 화면에 보인다 */
  planNote?: string;
  sourceUrl: string;
  /** 요금제 이름·값을 확인한 곳 (sourceUrl과 다를 때) */
  planSourceUrl?: string;
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
  /** 설정 파일 형식을 확인한 공식 문서 */
  configSourceUrl?: string;
  access: AccessRule[];
  /** 막혔을 때 보여 줄 이유. 예: 'Claude Code는 Pro 이상에서만 쓸 수 있어요' */
  lockReason: string;
  /** 요금제 정보의 출처. official: 공식 문서로 확인 / third-party: 제3자 자료만 확인 */
  confidence: 'official' | 'third-party';
  sourceUrl: string;
  /** 요금제별로 열리는지 확인한 곳 (sourceUrl과 다를 때) */
  planSourceUrl?: string;
  lastVerified: string;
}

export interface ProviderData {
  schemaVersion: 1;
  lastVerified: string;
  providers: Record<ProviderId, ProviderInfo>;
  engines: Record<EngineId, EngineInfo>;
}
