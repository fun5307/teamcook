// GraphRAG 예제: 같은 과제를 단일 AI·서브에이전트·에이전트 팀으로 기록한 '합성 데모'.
// 실제로 수행한 실습이 아니다. 화면과 보고서 어디서나 '합성 데모'로 표시되고, 성능 비교의 근거로 쓰지 않는다.
// 사용자가 "예제 불러오기"를 눌렀을 때만 저장소에 들어간다.

import { builtinRecipes } from '../../data/recipes';
import type { Recipe } from '../../types';
import { defaultRubric } from './rubric';
import {
  PRACTICE_DATA_VERSION,
  type CollabEvent,
  type Comparison,
  type Measure,
  type PracticeData,
  type PracticeRun,
  type PracticeTask,
  type Score,
} from './types';

export const DEMO_PREFIX = 'demo-graphrag';
const RECIPE_ID = 'builtin-graphrag-feasibility';
const AT = (time: string) => `2026-11-17T${time}:00+09:00`;

function graphragRecipe(): Recipe {
  const recipe = builtinRecipes.find((item) => item.id === RECIPE_ID);
  if (!recipe) throw new Error('GraphRAG 기본 레시피를 찾을 수 없어요.');
  return structuredClone(recipe);
}

function scores(values: [number | 'na' | 'unknown', string][]): Score[] {
  const ids = ['accuracy', 'coverage', 'completion', 'collaboration'];
  return values.map(([value, rationale], index) => ({
    criterionId: ids[index],
    value: value as Score['value'],
    rationale,
    evaluator: '예제 작성자',
    evaluatedAt: AT('16:00'),
  }));
}

function measure(id: string, metric: Measure['metric'], value: number | null, unit: string, scope: string, source: string): Measure {
  return { id, metric, value, unit, scope, source, origin: 'user' };
}

export function buildDemoData(): Pick<PracticeData, 'tasks' | 'runs' | 'comparisons'> {
  const recipe = graphragRecipe();
  const card = (name: string) => recipe.cards.find((item) => item.name === name)!.id;
  const rubric = defaultRubric();
  const task: PracticeTask = {
    id: `${DEMO_PREFIX}-task`,
    title: 'GraphRAG 주제 3개 타당성 검토 (합성 데모)',
    input: recipe.sampleTask ?? '',
    materials: '웹 검색 허용, 첨부 자료 없음',
    rubric,
    successCriteria: [...(recipe.successCriteria ?? [])],
    createdAt: AT('09:00'),
  };
  const checks = (states: ('met' | 'partial' | 'unmet' | 'unknown')[], evidence: string[]) =>
    task.successCriteria.map((text, index) => ({
      id: `${DEMO_PREFIX}-check-${index + 1}`,
      text,
      state: states[index] ?? 'unknown',
      evidence: evidence[index] ?? '',
    }));
  const base = {
    dataVersion: PRACTICE_DATA_VERSION,
    taskId: task.id,
    status: 'done' as const,
    archived: false,
    demo: true,
    rubric: structuredClone(rubric),
    corrections: [],
  };
  const input = (model: string) => ({
    text: task.input,
    materials: task.materials,
    tool: 'Claude Code',
    model,
    toolVersion: '예제용 버전',
    environment: 'Windows 11',
  });

  const single: PracticeRun = {
    ...base,
    id: `${DEMO_PREFIX}-single`,
    title: '단일 AI로 한 번에 (합성 데모)',
    createdAt: AT('10:00'),
    updatedAt: AT('16:00'),
    kind: 'single',
    input: input('예제 모델 A'),
    result: {
      summary: '(합성 데모) 세 주제 모두 "가능"으로 정리했지만, 판례 데이터의 이용 조건을 확인하지 않았다.',
      body: '| 주제 | 데이터 | 수요 | 미해결 |\n| --- | --- | --- | --- |\n| 판례·법령 | 공개 API로 확보 가능 | 높음 | 없음 |\n| 논문 인용 | 공개 데이터 있음 | 중간 | 분야 범위 |\n| 사내 문서 | 사내 데이터 필요 | 높음 | 권한 |',
      sources: [{ id: `${DEMO_PREFIX}-s1`, label: '예제 출처: 공공 판례 서비스 안내 페이지 (데모용 가상 출처)' }],
      checks: checks(['partial', 'unmet', 'unmet', 'unknown'], ['출처가 하나뿐이다', '모두 사실처럼 적혀 있다', '이견을 다룰 역할이 없었다', '']),
      deviations: '',
      unresolved: '판례 데이터의 이용 조건',
    },
    events: [],
    scores: scores([
      [1, '"공개 API로 전부 확보 가능"이라는 주요 주장이 출처로 뒷받침되지 않는다.'],
      [2, '세 주제를 모두 다뤘지만 이용 조건이 빠졌다.'],
      [1, '성공 조건 4개 가운데 충족한 것이 없다.'],
      ['na', '단일 AI 기록이라 해당 없음.'],
    ]),
    startedAt: AT('10:00'),
    endedAt: AT('10:12'),
    measures: [
      measure(`${DEMO_PREFIX}-m1`, 'elapsed', 12, '분', '', '사용자가 시계로 잼'),
      measure(`${DEMO_PREFIX}-m2`, 'tokens', 41000, '토큰', 'Claude Code /cost · 입력+출력', '/cost 화면'),
    ],
  };

  const subagents: PracticeRun = {
    ...base,
    id: `${DEMO_PREFIX}-subagents`,
    title: '서브에이전트 레시피 (합성 데모)',
    createdAt: AT('11:00'),
    updatedAt: AT('16:00'),
    kind: 'recipe',
    snapshot: { sourceId: recipe.id, sourceSchemaVersion: recipe.schemaVersion, recipe: structuredClone(recipe) },
    input: input('예제 모델 A'),
    result: {
      summary: '(합성 데모) 데이터·수요를 나눠 조사했고, 비판적 검토가 근거 부족 2곳을 짚었다.',
      body: '판례·법령: 대법원 판례는 공개, 하급심은 일부만 공개(확인 필요)\n논문 인용: 공개 인용 데이터로 확보 가능\n사내 문서: 실제 사내 데이터가 없어 판단 불가',
      sources: [
        { id: `${DEMO_PREFIX}-s2`, label: '예제 출처: 판례 공개 범위 안내 (데모용 가상 출처)' },
        { id: `${DEMO_PREFIX}-s3`, label: '예제 출처: 공개 인용 데이터셋 설명 (데모용 가상 출처)' },
      ],
      checks: checks(['met', 'met', 'partial', 'met'], ['주제마다 출처가 있다', '판단 불가를 따로 적었다', '미해결 사항은 있지만 이견 기록이 짧다', '"찾지 못했다"로 적었다']),
      participants: [card('data_scout'), card('demand_scout'), card('critic')],
      deviations: '수요 조사가 끝나기 전에 비판적 검토가 시작됐다.',
      unresolved: '하급심 판결문 공개 범위',
    },
    events: [
      {
        id: `${DEMO_PREFIX}-e1`,
        type: 'message',
        from: card('data_scout'),
        to: 'main',
        description: '데이터 조사 결과를 메인 AI에게 돌려줌',
        evidence: [],
        origin: 'user',
      },
      {
        id: `${DEMO_PREFIX}-e2`,
        type: 'user-intervention',
        from: 'user',
        to: 'main',
        description: '사용자가 "사내 문서 주제는 판단 불가로 둬도 된다"고 지시함',
        evidence: [{ id: `${DEMO_PREFIX}-ev1`, kind: 'note', text: '대화 기록 14번째 메시지 (데모)' }],
        origin: 'user',
      },
    ],
    scores: scores([
      [2, '주요 주장은 출처가 있으나 하급심 공개 범위는 확인되지 않았다.'],
      [3, '세 주제 모두 데이터와 수요를 나눠 다뤘다.'],
      [2, '성공 조건 4개 가운데 3개 충족, 1개 일부 충족.'],
      [2, '비판적 검토가 근거 부족을 짚어 결과 일부가 바뀌었다. 역할끼리 직접 대화하지는 않았다.'],
    ]),
    startedAt: AT('11:00'),
    endedAt: AT('11:25'),
    measures: [
      measure(`${DEMO_PREFIX}-m3`, 'elapsed', 25, '분', '', '사용자가 시계로 잼'),
      // 토큰은 확인하지 못했다: 0이 아니라 '미확인'
      measure(`${DEMO_PREFIX}-m4`, 'tokens', null, '토큰', '', '확인하지 못함'),
    ],
  };

  const teamRecipe: Recipe = { ...structuredClone(recipe), collaboration: 'agent-team' };
  const teamEvents: CollabEvent[] = [
    {
      id: `${DEMO_PREFIX}-e3`,
      type: 'disagreement',
      from: card('critic'),
      to: card('data_scout'),
      description: '비판적 검토가 "판례 데이터를 공개 API로 전부 받을 수 있다"는 주장에 이의를 제기',
      addedEvidence: '하급심 판결문은 공개 범위가 제한적이라는 안내문',
      evidence: [
        { id: `${DEMO_PREFIX}-ev2`, kind: 'excerpt', text: '"하급심 판결문은 일부만 공개됩니다" (데모용 가상 발췌)' },
      ],
      origin: 'user',
      at: AT('13:14'),
    },
    {
      id: `${DEMO_PREFIX}-e4`,
      type: 'reinvestigation',
      from: card('data_scout'),
      to: card('critic'),
      description: '데이터 조사가 판결문 공개 범위를 다시 조사',
      addedEvidence: '공개 범위 안내 페이지와 이용 조건',
      evidence: [{ id: `${DEMO_PREFIX}-ev3`, kind: 'url', text: 'https://example.com/demo-court-data' }],
      origin: 'user',
      at: AT('13:20'),
    },
    {
      id: `${DEMO_PREFIX}-e5`,
      type: 'decision-change',
      from: card('data_scout'),
      to: 'main',
      description: '판례·법령 주제의 데이터 확보 가능성을 "가능"에서 "부분 가능(하급심 제한)"으로 바꿈',
      outcome: '최종 표의 판례 주제 평가가 한 단계 낮아지고 미해결 사항에 추가됨',
      evidence: [{ id: `${DEMO_PREFIX}-ev4`, kind: 'excerpt', text: '"확보 가능성: 부분 가능 — 하급심 판결문 제한" (데모용 가상 발췌)' }],
      origin: 'user',
      at: AT('13:31'),
    },
    {
      id: `${DEMO_PREFIX}-e6`,
      type: 'message',
      from: card('demand_scout'),
      to: card('critic'),
      description: '수요 조사가 기존 서비스 목록을 비판적 검토에게 직접 보냄',
      evidence: [],
      origin: 'user',
    },
  ];
  const team: PracticeRun = {
    ...base,
    id: `${DEMO_PREFIX}-team`,
    title: '에이전트 팀 레시피 (합성 데모)',
    createdAt: AT('13:00'),
    updatedAt: AT('16:00'),
    kind: 'recipe',
    snapshot: { sourceId: recipe.id, sourceSchemaVersion: recipe.schemaVersion, recipe: teamRecipe },
    // 조건 차이 사례: 이 기록만 다른 모델로 돌렸다 (실험 변수로 고르지 않아 비교 화면에서 경고된다)
    input: input('예제 모델 B'),
    result: {
      summary: '(합성 데모) 이견 → 재조사 → 판단 변경을 거쳐 판례 주제의 데이터 확보 가능성을 낮춰 잡았다.',
      body: '판례·법령: 부분 가능 (하급심 판결문 제한)\n논문 인용: 가능\n사내 문서: 판단 불가 (사내 데이터 없음)\n\n미해결: 하급심 판결문 대체 데이터',
      sources: [
        { id: `${DEMO_PREFIX}-s4`, label: '예제 출처: 판례 공개 범위 안내 (데모용 가상 출처)', url: 'https://example.com/demo-court-data' },
      ],
      checks: checks(['met', 'met', 'met', 'met'], ['주제마다 출처가 있다', '부분 가능·판단 불가를 구분했다', '이견과 판단 변경이 기록돼 있다', '"찾지 못했다"로 적었다']),
      participants: [card('data_scout'), card('demand_scout'), card('critic')],
      deviations: '',
      unresolved: '하급심 판결문 대체 데이터',
    },
    events: teamEvents,
    scores: scores([
      [3, '주요 주장이 출처와 일치하고, 부분 가능·판단 불가를 구분했다.'],
      [3, '세 주제 모두 다뤘다.'],
      [3, '성공 조건 4개 모두 충족.'],
      [3, '이견과 재조사로 판례 주제의 결론이 바뀌었고 근거가 남아 있다.'],
    ]),
    startedAt: AT('13:00'),
    endedAt: AT('13:31'),
    measures: [
      measure(`${DEMO_PREFIX}-m5`, 'elapsed', 31, '분', '', '사용자가 시계로 잼'),
      measure(`${DEMO_PREFIX}-m6`, 'worker-time', 74, '분', '팀원 3명의 작업 시간 합', '팀원별 작업 표시'),
      measure(`${DEMO_PREFIX}-m7`, 'tokens', 152000, '토큰', 'Claude Code /cost · 팀 전체 입력+출력', '/cost 화면'),
    ],
  };

  const runs = [single, subagents, team];
  const comparison: Comparison = {
    dataVersion: PRACTICE_DATA_VERSION,
    id: `${DEMO_PREFIX}-compare`,
    title: 'GraphRAG 타당성 검토: 단일 AI · 서브에이전트 · 에이전트 팀 (합성 데모)',
    runIds: runs.map((run) => run.id),
    variables: ['style', 'recipe'],
    conclusion:
      '(합성 데모의 예시 결론) 이 한 번의 기록에서는 에이전트 팀 기록만 판례 데이터의 공개 범위 문제를 바로잡았다. 이견 → 재조사 → 판단 변경 사건이 그 근거다.',
    limits:
      '실제로 수행하지 않은 합성 데모다. 에이전트 팀 기록은 다른 모델로 돌린 것으로 되어 있어 방식의 차이와 모델의 차이를 나눌 수 없다. 서브에이전트 기록은 토큰을 확인하지 못했다. 방식마다 한 번씩만 기록했다.',
    createdAt: AT('16:30'),
    updatedAt: AT('16:30'),
    snapshotAt: AT('16:30'),
    runs: structuredClone(runs),
    demo: true,
  };
  return { tasks: [task], runs, comparisons: [comparison] };
}

/** 이미 불러온 예제는 다시 넣지 않는다 (두 번 눌러도 겹치지 않음) */
export function mergeDemo(data: PracticeData): PracticeData {
  const demo = buildDemoData();
  const has = <T extends { id: string }>(items: T[], id: string) => items.some((item) => item.id === id);
  return {
    ...data,
    tasks: [...data.tasks, ...demo.tasks.filter((item) => !has(data.tasks, item.id))],
    runs: [...demo.runs.filter((item) => !has(data.runs, item.id)), ...data.runs],
    comparisons: [...demo.comparisons.filter((item) => !has(data.comparisons, item.id)), ...data.comparisons],
  };
}
