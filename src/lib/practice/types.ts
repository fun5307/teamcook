// 실습 기록의 데이터 모델.
// 레시피(설계)와 따로 저장한다. 실습 결과를 원본 레시피에 붙이지 않는다.
// 이 사이트는 AI를 실행하지 않으므로, 여기 적히는 것은 "사용자가 밖에서 실습하고 적은 기록"이다.

import type { Recipe } from '../../types';

/** 저장 형식 버전. 구조를 바꾸면 올리고, 옛 버전을 읽는 코드는 schema.ts에 남긴다. */
export const PRACTICE_DATA_VERSION = 1 as const;

/**
 * 기록의 출처.
 * - user: 사용자가 직접 적음 / imported: 파일로 가져온 자료
 * - observed: 도구가 자동으로 관측함 (2차에서는 만들 방법이 없다. 3차 연결용 자리)
 * - unknown: 확인 불가
 */
export type Origin = 'user' | 'imported' | 'observed' | 'unknown';

/**
 * 기록 상태. 사용자가 손으로 바꾼다. AI 프로세스의 상태가 아니다
 * ('기록 중'은 "적는 중"이라는 뜻이지 "AI가 도는 중"이 아니다).
 */
export type RunStatus = 'ready' | 'recording' | 'done' | 'stopped';

/** 실행 유형. recipe: 레시피(팀)로 실습 / single: AI 하나에게 그냥 시킴 (비교 기준용) */
export type RunKind = 'recipe' | 'single';

/** 평가 기준 하나. 척도는 0~3이고 단계마다 설명이 있다. */
export interface Criterion {
  id: string;
  name: string;
  description: string;
  /** 0점, 1점, 2점, 3점의 설명 */
  levels: [string, string, string, string];
  /** 팀 협업에 대한 기준인지. 단일 AI 기록에서는 '해당 없음'이 된다 (0점이 아니다). */
  collaborative?: boolean;
}

/** 평가 기준 묶음. 기록을 만들 때 복사해 두므로 나중에 기본 기준이 바뀌어도 과거 기록은 그대로다. */
export interface Rubric {
  id: string;
  version: number;
  criteria: Criterion[];
}

/** 점수. 숫자 0~3, 'unknown'(확인 불가), 'na'(해당 없음). 평가하지 않은 기준은 점수 자체가 없다. */
export type ScoreValue = 0 | 1 | 2 | 3 | 'unknown' | 'na';

export interface Score {
  criterionId: string;
  value: ScoreValue;
  /** 그렇게 판단한 근거 */
  rationale: string;
  evaluator: string;
  /** 평가한 시각 (시간대 포함) */
  evaluatedAt: string;
}

/** 성공 조건의 확인 상태 */
export type CheckState = 'met' | 'partial' | 'unmet' | 'unknown';

export interface SuccessCheck {
  id: string;
  /** 기록을 만들 때의 성공 조건 문장 */
  text: string;
  state: CheckState;
  evidence: string;
}

/** 근거 출처 */
export interface SourceRef {
  id: string;
  label: string;
  url?: string;
}

export type EventType = 'message' | 'disagreement' | 'reinvestigation' | 'decision-change' | 'user-intervention';

export type EvidenceKind = 'excerpt' | 'url' | 'note';

/** 증거 참조: 짧은 발췌, 출처 URL, 사용자 메모 */
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  text: string;
}

/**
 * 협업 사건. "무슨 일이 있었는지"만 적는다. 협업이 효과적이었는지는 평가에서 따로 판단한다.
 * from·to는 스냅샷 카드의 id, 'main'(메인 AI), 'user'(사용자) 가운데 하나이거나 자유롭게 적은 이름이다.
 */
export interface CollabEvent {
  id: string;
  type: EventType;
  from?: string;
  to?: string;
  /** 무엇을 전달했는지, 무슨 일이 있었는지 */
  description: string;
  /** 어떤 근거가 더해졌는지 */
  addedEvidence?: string;
  /** 결과가 어떻게 달라졌는지 */
  outcome?: string;
  evidence: Evidence[];
  origin: Origin;
  /** 일어난 시각 (선택, 시간대 포함) */
  at?: string;
}

export type MetricKind = 'elapsed' | 'worker-time' | 'tokens' | 'cost' | 'other';

/** 측정값. value가 null이면 '미확인'이다 (0과 다르다). */
export interface Measure {
  id: string;
  metric: MetricKind;
  /** 'other'일 때의 지표 이름 */
  label?: string;
  value: number | null;
  unit: string;
  /** 무엇을 어디까지 센 값인지. 예: 'Claude Code · 입력+출력' */
  scope: string;
  /** 어디서 본 값인지. 예: '/cost 화면' */
  source: string;
  origin: Origin;
}

/** 정정 기록: 완료한 기록을 고칠 때의 시각과 이유, 또는 입력·조건에 대한 정정 메모 */
export interface Correction {
  id: string;
  at: string;
  reason: string;
  area: 'result' | 'note';
}

/**
 * 기록을 만들 때의 주문 복사본 (주문에서 시작한 기록만). 주문을 나중에 고치거나 지워도 이 복사본은 그대로다.
 * 원문(사용자가 쓴 요청)과 실제 입력(외부 도구에 넣은 글, RunInput.text)은 다른 것이다.
 */
export interface OrderSnapshot {
  orderId: string;
  revision: number;
  title: string;
  /** 사용자가 쓴 요청 원문 */
  requestText: string;
  /** 자료 이름·종류·읽기 상태 (본문은 넣지 않는다) */
  materials: { name: string; kind: string; status: string }[];
  /** 확정한 목표·결과물·조건·제외·성공 조건 */
  requirements: { kind: string; text: string }[];
  /** 확정한 작업 (작업별 결과를 적을 때 쓴다) */
  work: { id: string; title: string; outputs: string[]; criteria: string[] }[];
  /** 그때 정하지 않은 질문 */
  open: string[];
}

/** 작업 하나의 결과 */
export interface WorkResult {
  workId: string;
  state: CheckState;
  note: string;
}

/** 기록을 만들 때의 레시피 복사본 */
export interface RecipeSnapshot {
  /** 원본 레시피 id. 원본이 지워져도 스냅샷은 남는다. */
  sourceId: string;
  /** 원본의 형식 버전 (레시피에는 개정 번호가 따로 없다) */
  sourceSchemaVersion: number;
  /** 당시의 전체 정의 (조리법, 역할, 산출물, 넘겨주기 포함) */
  recipe: Recipe;
}

/** 실행 입력과 조건. 빈 문자열은 '미확인'이다. */
export interface RunInput {
  /** AI에게 넣은 입력 원문 (단일 AI는 실제 프롬프트) */
  text: string;
  /** 자료 조건. 예: '웹 검색 허용, 첨부 없음' */
  materials: string;
  tool: string;
  model: string;
  toolVersion: string;
  environment: string;
}

export interface RunResult {
  summary: string;
  body: string;
  sources: SourceRef[];
  checks: SuccessCheck[];
  /** 실제로 참여한 역할 (스냅샷 카드 id). 적지 않았으면 undefined. */
  participants?: string[];
  /** 예정과 달랐던 수행 내용 */
  deviations: string;
  /** 주문의 작업별 결과 (주문에서 시작한 기록만) */
  workResults?: WorkResult[];
  /** 미해결 사항 */
  unresolved: string;
}

/** 실습 기록 한 건 */
export interface PracticeRun {
  dataVersion: typeof PRACTICE_DATA_VERSION;
  id: string;
  title: string;
  /** 시간대가 있는 ISO 형식. 예: 2026-11-17T14:03:00+09:00 */
  createdAt: string;
  updatedAt: string;
  taskId?: string;
  status: RunStatus;
  /** 보관 여부. 상태와 따로다 (완료한 기록도, 준비 중인 기록도 보관할 수 있다). */
  archived: boolean;
  /** 합성 데모: 실제로 수행하지 않은 예시 기록 */
  demo?: boolean;
  /** 파일에서 가져온 기록이면 가져온 시각 */
  importedAt?: string;
  /** 다른 기록의 입력·조건을 바꿔 만든 기록이면 그 기록의 id */
  derivedFrom?: string;
  kind: RunKind;
  /** kind가 'recipe'일 때만 있다 */
  snapshot?: RecipeSnapshot;
  /** 주문에서 시작했으면 그때의 주문 복사본 */
  order?: OrderSnapshot;
  input: RunInput;
  rubric: Rubric;
  result: RunResult;
  events: CollabEvent[];
  scores: Score[];
  /** 사용자가 적은 시작·끝 시각 (선택) */
  startedAt?: string;
  endedAt?: string;
  measures: Measure[];
  corrections: Correction[];
}

/** 비교 과제: 여러 기록이 같이 쓰는 입력과 평가 기준 */
export interface PracticeTask {
  id: string;
  title: string;
  /** 공통 입력 원문 */
  input: string;
  /** 첨부 자료 설명·출처 */
  materials: string;
  rubric: Rubric;
  /** 성공 조건 문장 (레시피에서 가져온 것). 같은 과제의 다른 기록이 같은 조건으로 확인받게 한다. */
  successCriteria: string[];
  /** 주문에서 시작한 과제면 그 주문 복사본 (같은 과제로 다시 기록할 때 물려준다) */
  order?: OrderSnapshot;
  createdAt: string;
}

/** 비교 묶음. 저장할 때 고른 기록을 통째로 복사해 두어, 원본을 고쳐도 저장한 보고서가 조용히 바뀌지 않는다. */
export interface Comparison {
  dataVersion: typeof PRACTICE_DATA_VERSION;
  id: string;
  title: string;
  /** 원본 기록 id (2~4개) */
  runIds: string[];
  /** 사용자가 '의도한 차이'라고 표시한 조건 */
  variables: string[];
  /** 사용자가 쓰는 비교 결론과 한계 */
  conclusion: string;
  limits: string;
  createdAt: string;
  updatedAt: string;
  /** 스냅샷을 뜬 시각과 당시의 기록 복사본 */
  snapshotAt: string;
  runs: PracticeRun[];
  demo?: boolean;
  importedAt?: string;
}

/** 저장 단위 전체 */
export interface PracticeData {
  version: typeof PRACTICE_DATA_VERSION;
  tasks: PracticeTask[];
  runs: PracticeRun[];
  comparisons: Comparison[];
  /** 이 버전이 읽지 못한 항목. 버리지 않고 그대로 둔다. */
  unreadable: unknown[];
}

export const EMPTY_PRACTICE_DATA: PracticeData = {
  version: PRACTICE_DATA_VERSION,
  tasks: [],
  runs: [],
  comparisons: [],
  unreadable: [],
};
