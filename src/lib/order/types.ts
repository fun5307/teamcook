// 주문(작업 설계)의 데이터 모델.
// 흐름: 요청 → 주문 정리(목표·조건) → 작업 설계(작업 카드·전달) → 팀 제안(역할 배정) → 실행 준비(레시피 생성·내보내기).
// 주문은 실행이 아니다. 주문 ID와 실습 기록 ID는 서로 다른 것이다.

import type { Collaboration, EngineId, Permission, RoleTag } from '../../types';

export const ORDER_SCHEMA_VERSION = 1 as const;

export type OrderStep = 'request' | 'define' | 'work' | 'team' | 'ready';
/** 주문 상태. 실제 실행 상태가 아니다. */
export type OrderStatus = 'draft' | 'designing' | 'ready';

export type MaterialKind = 'text' | 'file' | 'link';
/**
 * 자료 읽기 상태.
 * - read: 본문을 읽었다 (붙여 넣은 글, 읽은 텍스트 파일)
 * - reference: 주소만 저장했다 (링크. 사이트가 접속해 읽지 않는다)
 * - failed: 읽지 못했다 (형식·크기·인코딩)
 */
export type MaterialStatus = 'read' | 'reference' | 'failed';

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  status: MaterialStatus;
  /** 읽은 본문 (read일 때만) */
  content?: string;
  url?: string;
  /** 읽지 못한 이유 */
  error?: string;
  /** 바이트 수 (파일) */
  size?: number;
}

/** 원문에서 근거를 찾은 위치: 'request'(요청 원문) 또는 자료 id, 그리고 짧은 발췌 */
export interface Evidence {
  sourceId: string;
  excerpt: string;
}

/**
 * 출처 방식.
 * - explicit: 사용자가 쓴 문장을 그대로 옮김 (분류는 규칙이 했다)
 * - rule: 규칙(작업 유형 틀)이 덧붙인 제안
 * - user: 사용자가 이 화면에서 직접 적음
 * - assumption: 가정 (확인되지 않은 전제)
 */
export type RequirementSource = 'explicit' | 'rule' | 'user' | 'assumption';
export type ProposalState = 'proposed' | 'accepted' | 'excluded';

export type RequirementKind = 'goal' | 'deliverable' | 'current' | 'constraint' | 'exclusion' | 'success';

export interface Requirement {
  id: string;
  kind: RequirementKind;
  text: string;
  source: RequirementSource;
  state: ProposalState;
  evidence?: Evidence;
}

export type QuestionState = 'open' | 'answered' | 'undecided' | 'later';

export interface OpenQuestion {
  id: string;
  text: string;
  /** 고를 수 있는 답 (있으면) */
  options?: string[];
  answer?: string;
  state: QuestionState;
  /** 확정 전에 꼭 정해야 하는지 (사용자가 지정) */
  mustDecide: boolean;
  affects: string[];
}

export interface WorkOutput {
  id: string;
  name: string;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  inputs: string[];
  outputs: WorkOutput[];
  criteria: string[];
  /** 공통 조건과 다른 이 작업만의 조건 */
  overrides: string[];
  /** 이 작업이 끝나면 사용자 확인 후 다음으로 (프롬프트로 전달되는 안내일 뿐, 강제 승인이 아니다) */
  checkpoint: boolean;
  /** 확정에 꼭 필요한 작업인지 (담당·산출물·완료 기준이 없으면 막는다) */
  required: boolean;
  /** 규칙이 넣은 작업이면 'rule', 사용자가 만든 작업이면 'user' */
  origin: 'rule' | 'user';
  state: ProposalState;
  /** 작업 유형 (역할 제안에 쓴다) */
  type: RoleTag;
  evidence?: Evidence;
}

export interface Dependency {
  id: string;
  from: string;
  to: string;
  /** 넘기는 산출물 (선행 작업의 WorkOutput.id) */
  outputIds: string[];
  note: string;
}

export interface OrderRole {
  id: string;
  /** 영문 소문자 (파일 이름) */
  name: string;
  displayName: string;
  tag: RoleTag;
  engine: EngineId;
  permission: Permission;
  /** 기존 레시피의 카드를 틀로 썼으면 그 위치 (지시문을 가져온다) */
  template?: { recipeId: string; cardId: string };
  /** 열어 둔 프로젝트 폴더의 팀원이면 그 이름 */
  fromWorkspace?: boolean;
}

export interface Assignment {
  workId: string;
  roleId: string;
  /** owner: 맡아서 함 / reviewer: 결과를 검토함 */
  responsibility: 'owner' | 'reviewer';
}

export type WorkScope = 'quick' | 'evidence' | 'alternatives';

export interface Recommendation {
  /** 쓴 패턴 이름. 예: '구현과 검토 분리' */
  pattern: string;
  /** 틀로 쓴 기존 레시피 (있으면) */
  recipeId?: string;
  reasons: string[];
  state: ProposalState;
}

/** 이 주문에서 만든 레시피와의 연결 */
export interface RecipeLink {
  recipeId: string;
  /** 레시피를 만들 때의 주문 수정 번호 */
  orderRevision: number;
  /** 만들었을 때의 레시피 내용 지문 (그 뒤 레시피가 손으로 바뀌었는지 볼 때 쓴다) */
  fingerprint: string;
}

export interface OrderDraft {
  schemaVersion: typeof ORDER_SCHEMA_VERSION;
  id: string;
  /** 저장할 때마다 1씩 오른다 */
  revision: number;
  status: OrderStatus;
  step: OrderStep;
  createdAt: string;
  updatedAt: string;
  title: string;
  request: {
    text: string;
    materials: Material[];
    /** 마지막으로 '정리'했을 때의 원문. 지금 원문과 다르면 "원문이 바뀌었어요"를 보여 준다. */
    textAtDraft?: string;
  };
  requirements: Requirement[];
  questions: OpenQuestion[];
  work: WorkItem[];
  deps: Dependency[];
  roles: OrderRole[];
  assignments: Assignment[];
  style: Collaboration;
  scope?: WorkScope;
  recommendation?: Recommendation;
  link?: RecipeLink;
  /** 기존 레시피에서 시작했으면 그 레시피 id (원본은 바꾸지 않는다) */
  sourceRecipeId?: string;
  /** 규칙이 알아본 요청 유형. 알아보지 못했으면 빈 배열 */
  detected: string[];
}

export const STEP_LABELS: Record<OrderStep, string> = {
  request: '요청',
  define: '주문 정리',
  work: '작업 설계',
  team: '팀 제안',
  ready: '실행 준비',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: '초안',
  designing: '설계 중',
  ready: '실행 준비됨',
};

export const KIND_LABELS: Record<RequirementKind, string> = {
  goal: '목표',
  deliverable: '최종 결과물',
  success: '성공 조건',
  current: '현재 상태',
  constraint: '반드시 지킬 조건',
  exclusion: '제외 범위',
};

export const SOURCE_LABELS: Record<RequirementSource, string> = {
  explicit: '사용자 명시',
  rule: '규칙 기반 제안',
  user: '사용자 추가',
  assumption: '가정',
};

export const STATE_LABELS: Record<ProposalState, string> = {
  proposed: '제안',
  accepted: '확정',
  excluded: '제외',
};

/** 자료 제한 */
export const MATERIAL_LIMITS = { fileBytes: 1024 * 1024, perOrder: 5, extensions: ['.txt', '.md'] };
