// 평가 기준과 화면에 쓰는 이름표.
// 점수는 사람이 매긴다. 사이트가 자동으로 점수를 주거나 승자를 정하지 않는다.

import type {
  CheckState,
  Criterion,
  EventType,
  EvidenceKind,
  MetricKind,
  Origin,
  PracticeRun,
  Rubric,
  RunStatus,
  Score,
  ScoreValue,
} from './types';

export const DEFAULT_RUBRIC_ID = 'teamcook-default';
export const DEFAULT_RUBRIC_VERSION = 1;

/** 기본 평가 기준 네 가지 (0~3점과 '확인 불가') */
export const DEFAULT_CRITERIA: Criterion[] = [
  {
    id: 'accuracy',
    name: '근거 정확성',
    description: '주요 주장이 출처와 맞는가. 출처가 붙어 있다는 것만으로 높은 점수를 주지 않습니다.',
    levels: [
      '명확한 오류가 확인됨',
      '주요 주장 가운데 일부만 뒷받침됨',
      '주요 주장은 확인되지만 일부 근거가 빠짐',
      '주요 주장이 출처와 일치하고, 불확실한 부분을 구분해 적음',
    ],
  },
  {
    id: 'coverage',
    name: '조사 범위',
    description: '과제가 요구한 범위를 얼마나 다뤘는가.',
    levels: [
      '요구한 범위를 거의 다루지 않음',
      '일부만 다루고 큰 부분이 빠짐',
      '대부분 다뤘지만 빠진 곳이 있음',
      '요구한 범위를 모두 다루고, 다루지 못한 곳을 밝힘',
    ],
  },
  {
    id: 'completion',
    name: '완료 기준 충족',
    description: '레시피의 성공 조건과 역할별 완료 기준을 채웠는가.',
    levels: [
      '채운 조건이 거의 없음',
      '일부 조건만 채움',
      '대부분 채웠지만 빠진 조건이 있음',
      '모든 조건을 채웠고 근거가 있음',
    ],
  },
  {
    id: 'collaboration',
    name: '협업 기여',
    description: '역할 사이의 전달·이견·재조사가 결과를 실제로 바꿨는가. 메시지가 오갔다는 것만으로 점수를 주지 않습니다.',
    levels: [
      '역할이 나뉘었지만 결과에 영향을 준 흔적이 없음',
      '전달은 있었지만 결과가 달라진 근거가 약함',
      '협업으로 결과 일부가 달라진 근거가 있음',
      '이견이나 재조사로 결론이 바뀌었고 그 근거가 남아 있음',
    ],
    collaborative: true,
  },
];

export function defaultRubric(): Rubric {
  return { id: DEFAULT_RUBRIC_ID, version: DEFAULT_RUBRIC_VERSION, criteria: structuredClone(DEFAULT_CRITERIA) };
}

/** 두 평가 기준이 같은 것인지 볼 때 쓰는 문자열. 이름·설명·단계가 모두 같아야 같다. */
export function rubricSignature(rubric: Rubric): string {
  return JSON.stringify(
    rubric.criteria.map((item) => [item.id, item.name, item.levels, Boolean(item.collaborative)]),
  );
}

/** 이 기록에서 이 기준이 '해당 없음'인지 (단일 AI의 협업 기준) */
export function isNotApplicable(run: Pick<PracticeRun, 'kind'>, criterion: Criterion): boolean {
  return run.kind === 'single' && Boolean(criterion.collaborative);
}

/** 화면에 보일 점수. 단일 AI의 협업 기준은 적힌 값과 상관없이 '해당 없음'이다. */
export function effectiveScore(run: PracticeRun, criterion: Criterion): Score | { value: 'na' } | null {
  if (isNotApplicable(run, criterion)) return { value: 'na' };
  return run.scores.find((score) => score.criterionId === criterion.id) ?? null;
}

export function scoreLabel(value: ScoreValue | null | undefined): string {
  if (value === null || value === undefined) return '평가 안 함';
  if (value === 'unknown') return '확인 불가';
  if (value === 'na') return '해당 없음';
  return `${value}점`;
}

export const STATUS_LABELS: Record<RunStatus, string> = {
  ready: '준비',
  recording: '기록 중',
  done: '완료',
  stopped: '중단',
};

export const ORIGIN_LABELS: Record<Origin, string> = {
  user: '사용자 기록',
  imported: '가져온 자료',
  observed: '자동 관측',
  unknown: '출처 확인 불가',
};

export const CHECK_LABELS: Record<CheckState, string> = {
  met: '충족',
  partial: '일부 충족',
  unmet: '미충족',
  unknown: '확인 불가',
};

export const EVENT_LABELS: Record<EventType, string> = {
  message: '메시지·질문',
  disagreement: '이견',
  reinvestigation: '재조사',
  'decision-change': '판단 변경',
  'user-intervention': '사용자 개입',
};

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  excerpt: '발췌',
  url: '출처 URL',
  note: '메모',
};

export const METRIC_LABELS: Record<MetricKind, string> = {
  elapsed: '전체 경과 시간',
  'worker-time': '작업자 시간 합계',
  tokens: '토큰',
  cost: '금액',
  other: '기타',
};

/** 지표마다 쓸 수 있는 단위. 'other'는 자유롭게 적는다. */
export const METRIC_UNITS: Record<MetricKind, string[]> = {
  elapsed: ['분', '초', '시간'],
  'worker-time': ['분', '초', '시간'],
  tokens: ['토큰'],
  cost: ['KRW', 'USD', 'EUR', 'JPY'],
  other: [],
};

export const METRIC_HINTS: Record<MetricKind, string> = {
  elapsed: '시작부터 끝까지 실제로 흐른 시간입니다. 여러 역할이 동시에 일한 시간을 더한 값이 아닙니다.',
  'worker-time': '역할마다 일한 시간을 모두 더한 값입니다. 동시에 일했다면 전체 경과 시간보다 깁니다.',
  tokens: '도구마다 세는 방식이 다릅니다. 무엇을 센 값인지(입력·출력·캐시 등) 범위에 적어 주세요.',
  cost: '실제로 청구되거나 화면에 표시된 금액만 적습니다. 구독 사용량을 API 가격으로 바꿔 적지 않습니다.',
  other: '',
};
