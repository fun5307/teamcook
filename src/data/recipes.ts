// 기본 레시피 5종 (PROJECT_BRIEF.md 9장 3종 + BRIEF_collaboration-styles.md 조리법 2종).
// 배지와 실행 경로는 여기 적지 않는다. lib/requiredPlans.ts, lib/resolvePath.ts가 계산한다.
// 모델 이름은 일부러 비워 둔다(각 도구의 기본 모델을 따름). 모델 이름은 자주 바뀌기 때문이다.

import type { Recipe } from '../types';

/** 기본 레시피가 실제로 돌아가는지 마지막으로 확인한 날 */
const VERIFIED = '2026-11-16';

const crossReview: Recipe = {
  schemaVersion: 1,
  id: 'builtin-cross-review',
  title: 'Claude 작성 + Codex 교차 검토',
  summary:
    'Claude Code가 기능을 구현하고, 다른 회사 모델인 Codex가 읽기 전용으로 검토합니다. 같은 모델이 자기 결과를 검토할 때 놓치는 문제를 잡아냅니다.',
  useCase: '기능 구현 후 검토',
  author: 'teamcook',
  lastVerified: VERIFIED,
  cards: [
    {
      id: 'cr-writer',
      name: 'writer',
      displayName: '작성자',
      role: '요청받은 기능을 구현하거나 버그를 고칠 때 사용. 코드를 직접 수정하고 테스트까지 돌린다.',
      instructions: [
        '너는 이 프로젝트의 구현 담당이다.',
        '',
        '- 요청받은 범위만 바꾼다. 관련 없는 파일은 건드리지 않는다.',
        '- 바꾸기 전에 관련 코드를 읽고, 기존 코드의 방식(이름, 구조, 테스트 스타일)을 따른다.',
        '- 바꾼 뒤에는 테스트나 빌드를 실행해 직접 확인한다.',
        '- 끝나면 "무엇을 왜 바꿨는지, 어떻게 확인했는지, 남은 걱정은 무엇인지"를 짧게 보고한다.',
        '- 검토 결과를 받으면 그대로 믿지 말고 먼저 사실인지 확인한 뒤, 맞는 지적만 반영한다.',
      ].join('\n'),
      preferredEngine: 'claude-code',
      permission: 'edit',
      tags: ['writer'],
    },
    {
      id: 'cr-reviewer',
      name: 'reviewer',
      displayName: '교차 검토자',
      role: '방금 변경된 파일의 버그·보안 문제·빠진 테스트를 검토할 때 사용. 파일은 수정하지 않는다.',
      instructions: [
        '너는 독립적인 코드 검토자다. 작성자와 다른 회사의 모델로서, 작성자가 놓쳤을 문제를 찾는다.',
        '',
        '- git diff로 변경된 부분을 확인하고, 필요하면 주변 코드도 읽는다.',
        '- 우선순위: 잘못된 동작 > 보안 문제 > 기존 기능이 깨지는 것 > 빠진 테스트. 취향 문제는 적지 않는다.',
        '- 문제마다 파일 경로와 줄 번호, 왜 문제인지, 어떻게 재현하는지를 적는다.',
        '- 확신이 없으면 "추정"이라고 표시한다. 문제가 없으면 없다고 분명히 말한다.',
      ].join('\n'),
      preferredEngine: 'codex-cli',
      permission: 'read-only',
      tags: ['reviewer'],
    },
  ],
  handoffs: [
    { id: 'cr-h1', from: 'cr-writer', to: 'cr-reviewer', label: '변경 내용 전달' },
    { id: 'cr-h2', from: 'cr-reviewer', to: 'cr-writer', label: '검토 결과' },
  ],
  settings: { maxThreads: 2, maxDepth: 1 },
  howToRun:
    '1) Claude Code에서 writer에게 구현을 맡깁니다. 2) 끝나면 같은 폴더에서 Codex를 열어 "reviewer 에이전트로 방금 변경을 검토해 줘"라고 합니다. 3) 검토 결과를 Claude Code의 writer에게 붙여 주고 "사실인지 확인한 뒤 맞는 것만 반영해 줘"라고 합니다.',
};

const planBuildReview: Recipe = {
  schemaVersion: 1,
  id: 'builtin-plan-build-review',
  title: '기획 → 구현 → 검토 (Codex만)',
  summary:
    'Codex 하나로 돌리는 3인 팀입니다. 기획자가 계획을 세우고, 구현 담당이 만들고, 검토자가 읽기 전용으로 확인합니다. ChatGPT 계정만 있으면 됩니다.',
  useCase: '작은 기능을 계획부터 검토까지',
  author: 'teamcook',
  lastVerified: VERIFIED,
  cards: [
    {
      id: 'pbr-planner',
      name: 'planner',
      displayName: '기획자',
      role: '구현을 시작하기 전에 관련 코드를 읽고 단계별 작업 계획을 세울 때 사용. 파일은 수정하지 않는다.',
      instructions: [
        '너는 작업 계획을 세우는 기획자다.',
        '',
        '- 요청과 관련된 코드를 먼저 읽고, 바꿔야 할 파일과 순서를 정한다.',
        '- 계획은 5단계 이내의 번호 목록으로 쓴다. 단계마다 "바꿀 파일, 할 일, 확인 방법"을 적는다.',
        '- 요청이 애매하면 가정한 내용을 맨 위에 적는다.',
        '- 코드는 작성하지 않는다. 계획만 보고한다.',
      ].join('\n'),
      preferredEngine: 'codex-cli',
      permission: 'read-only',
      tags: ['planner'],
    },
    {
      id: 'pbr-implementer',
      name: 'implementer',
      displayName: '구현 담당',
      role: '기획자의 계획을 받아 실제로 코드를 수정하고 테스트할 때 사용.',
      instructions: [
        '너는 구현 담당이다. 받은 계획을 순서대로 실행한다.',
        '',
        '- 계획에 없는 파일은 건드리지 않는다. 계획이 틀렸다고 판단하면 멈추고 이유를 보고한다.',
        '- 가장 작은 변경으로 끝낸다.',
        '- 바꾼 뒤 테스트나 빌드로 확인하고, 결과를 그대로 보고한다.',
        '- 검토 결과를 받으면 사실인지 확인한 뒤 맞는 지적만 반영한다.',
      ].join('\n'),
      preferredEngine: 'codex-cli',
      permission: 'edit',
      tags: ['implementer'],
    },
    {
      id: 'pbr-reviewer',
      name: 'reviewer',
      displayName: '검토자',
      role: '구현이 끝난 뒤 변경된 파일의 버그와 계획에서 빠진 부분을 검토할 때 사용. 파일은 수정하지 않는다.',
      instructions: [
        '너는 코드 검토자다.',
        '',
        '- 변경된 부분(git diff)이 처음 계획과 요청을 실제로 만족하는지 확인한다.',
        '- 잘못된 동작, 빠뜨린 경우, 빠진 테스트를 찾는다. 취향 문제는 적지 않는다.',
        '- 문제마다 파일 경로와 줄 번호, 이유를 적는다. 문제가 없으면 없다고 말한다.',
      ].join('\n'),
      preferredEngine: 'codex-cli',
      permission: 'read-only',
      tags: ['reviewer'],
    },
  ],
  handoffs: [
    { id: 'pbr-h1', from: 'pbr-planner', to: 'pbr-implementer', label: '작업 계획' },
    { id: 'pbr-h2', from: 'pbr-implementer', to: 'pbr-reviewer', label: '변경 내용' },
    { id: 'pbr-h3', from: 'pbr-reviewer', to: 'pbr-implementer', label: '검토 결과' },
  ],
  settings: { maxThreads: 3, maxDepth: 1 },
  howToRun:
    'Codex에서 이렇게 시작합니다: "planner에게 계획을 세우게 하고, 그 계획을 implementer에게 넘겨 구현하게 한 뒤, reviewer가 검토하게 해 줘. 할 일: (여기에 요청)"',
};

const researchTeam: Recipe = {
  schemaVersion: 1,
  id: 'builtin-research-team',
  title: '조사원 여러 명 + 정리원',
  summary:
    '조사원 둘이 서로 다른 관점(사실·근거 / 반대 근거·위험)으로 동시에 조사하고, 정리원이 하나의 보고서로 묶습니다. 한쪽 시각에 치우친 조사를 막아 줍니다.',
  useCase: '자료 조사와 의사결정 준비',
  author: 'teamcook',
  lastVerified: VERIFIED,
  cards: [
    {
      id: 'rt-facts',
      name: 'fact_researcher',
      displayName: '사실 조사원',
      role: '주제에 대한 사실·수치·공식 자료를 출처와 함께 조사할 때 사용. 파일은 수정하지 않는다.',
      instructions: [
        '너는 사실을 확인하는 조사원이다.',
        '',
        '- 공식 문서와 1차 자료를 먼저 찾는다. 블로그·요약 글은 보조로만 쓴다.',
        '- 사실마다 출처 링크와 확인한 날짜를 적는다.',
        '- 직접 확인한 것, 추론한 것, 확인하지 못한 것을 구분해서 보고한다.',
        '- 수치나 출처를 지어내지 않는다. 못 찾았으면 못 찾았다고 쓴다.',
      ].join('\n'),
      preferredEngine: 'claude-code',
      permission: 'read-only',
      tools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
      tags: ['researcher'],
    },
    {
      id: 'rt-risks',
      name: 'risk_researcher',
      displayName: '반대 근거 조사원',
      role: '주제에 대한 반대 근거·실패 사례·위험을 일부러 찾아 조사할 때 사용. 파일은 수정하지 않는다.',
      instructions: [
        '너는 반대 근거를 찾는 조사원이다. 일부러 약점을 찾는 역할이다.',
        '',
        '- "이 생각이 틀렸다면 그 이유는 무엇일까?"에서 출발한다.',
        '- 실패 사례, 한계, 비용, 대안을 출처와 함께 찾는다.',
        '- 직접 확인한 것, 추론한 것, 확인하지 못한 것을 구분해서 보고한다.',
        '- 반대를 위한 반대는 하지 않는다. 근거가 약하면 약하다고 쓴다.',
      ].join('\n'),
      preferredEngine: 'claude-code',
      permission: 'read-only',
      tools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
      tags: ['researcher'],
    },
    {
      id: 'rt-synth',
      name: 'synthesizer',
      displayName: '정리원',
      role: '여러 조사원의 결과를 받아 하나의 보고서로 정리할 때 사용. 보고서 파일을 작성한다.',
      instructions: [
        '너는 조사 결과를 하나로 묶는 정리원이다.',
        '',
        '- 두 조사원의 결과가 서로 어긋나는 부분을 먼저 찾아 표시한다.',
        '- 결론을 맨 위에 3줄 이내로 쓰고, 그 아래에 근거와 반대 근거를 나란히 정리한다.',
        '- 조사원이 "확인하지 못함"이라고 한 내용을 사실처럼 쓰지 않는다.',
        '- 새로운 사실을 지어 보태지 않는다. 모자란 부분은 "추가 조사 필요"로 남긴다.',
      ].join('\n'),
      preferredEngine: 'claude-code',
      permission: 'edit',
      tags: ['synthesizer'],
    },
  ],
  handoffs: [
    { id: 'rt-h1', from: 'rt-facts', to: 'rt-synth', label: '사실·근거' },
    { id: 'rt-h2', from: 'rt-risks', to: 'rt-synth', label: '반대 근거·위험' },
  ],
  settings: { maxThreads: 3, maxDepth: 1 },
  howToRun:
    'Claude Code에서 이렇게 시작합니다: "fact_researcher와 risk_researcher를 동시에 돌려서 (주제)를 조사하고, 두 결과를 synthesizer에게 넘겨 보고서로 정리해 줘."',
};

// 조리법: 에이전트 팀 (Claude Code 전용, 실험 기능). 리더는 처음 연 Claude Code 대화창이라 카드로 두지 않는다.
const featureTeam: Recipe = {
  schemaVersion: 1,
  id: 'builtin-feature-team',
  title: '기능 구현 팀 (리더 + 구현 2 + 검토 1)',
  summary:
    'Claude Code 에이전트 팀으로 돌리는 구현 팀입니다. 처음 연 대화창이 리더가 되어 일을 나누고, 구현 담당 두 명이 서로 겹치지 않는 부분을 맡고, 검토자가 읽기 전용으로 확인합니다. 팀원끼리 직접 대화하며 맞춰 갑니다.',
  useCase: '화면과 서버처럼 나눌 수 있는 기능 구현',
  author: 'teamcook',
  lastVerified: VERIFIED,
  collaboration: 'agent-team',
  cards: [
    {
      id: 'ft-impl-a',
      name: 'implementer_a',
      displayName: '구현 담당 A',
      role: '기능의 한쪽(예: 화면)을 맡아 구현할 때 사용. 리더가 정해 준 파일만 수정한다.',
      instructions: [
        '너는 구현 팀의 팀원 A다. 리더가 맡긴 부분만 구현한다.',
        '',
        '- 시작하기 전에 내가 고칠 파일 목록을 리더와 팀원 B에게 알린다. 같은 파일을 둘이 동시에 고치지 않는다.',
        '- 다른 팀원이 맡은 부분과 맞물리는 곳(함수 이름, 데이터 모양)은 직접 물어보고 맞춘다.',
        '- 바꾼 뒤 테스트나 빌드로 확인하고, 결과를 그대로 보고한다.',
        '- 일이 끝나면 할 일 목록에서 내 일을 "완료"로 바꾼다.',
        '- 검토 결과를 받으면 사실인지 확인한 뒤 맞는 지적만 반영한다.',
      ].join('\n'),
      preferredEngine: 'claude-code',
      permission: 'edit',
      tags: ['implementer'],
    },
    {
      id: 'ft-impl-b',
      name: 'implementer_b',
      displayName: '구현 담당 B',
      role: '기능의 다른 한쪽(예: 서버·데이터)을 맡아 구현할 때 사용. 리더가 정해 준 파일만 수정한다.',
      instructions: [
        '너는 구현 팀의 팀원 B다. 리더가 맡긴 부분만 구현한다.',
        '',
        '- 시작하기 전에 내가 고칠 파일 목록을 리더와 팀원 A에게 알린다. 같은 파일을 둘이 동시에 고치지 않는다.',
        '- 다른 팀원이 맡은 부분과 맞물리는 곳(함수 이름, 데이터 모양)은 직접 물어보고 맞춘다.',
        '- 바꾼 뒤 테스트나 빌드로 확인하고, 결과를 그대로 보고한다.',
        '- 일이 끝나면 할 일 목록에서 내 일을 "완료"로 바꾼다.',
        '- 검토 결과를 받으면 사실인지 확인한 뒤 맞는 지적만 반영한다.',
      ].join('\n'),
      preferredEngine: 'claude-code',
      permission: 'edit',
      tags: ['implementer'],
    },
    {
      id: 'ft-reviewer',
      name: 'team_reviewer',
      displayName: '검토자',
      role: '구현 담당 두 명의 변경을 읽기 전용으로 검토할 때 사용. 파일은 수정하지 않는다.',
      instructions: [
        '너는 구현 팀의 검토자다. 파일을 수정하지 않는다.',
        '',
        '- 두 구현 담당의 변경이 서로 맞물리는 곳부터 본다 (이름, 데이터 모양, 빠진 연결).',
        '- 우선순위: 잘못된 동작 > 보안 문제 > 기존 기능이 깨지는 것 > 빠진 테스트. 취향 문제는 적지 않는다.',
        '- 문제마다 파일 경로와 줄 번호, 왜 문제인지를 적어 해당 구현 담당에게 직접 알린다.',
        '- 확신이 없으면 "추정"이라고 표시한다. 문제가 없으면 없다고 분명히 말한다.',
      ].join('\n'),
      preferredEngine: 'claude-code',
      permission: 'read-only',
      tags: ['reviewer'],
    },
  ],
  handoffs: [
    { id: 'ft-h1', from: 'ft-impl-a', to: 'ft-reviewer', label: '변경 내용' },
    { id: 'ft-h2', from: 'ft-impl-b', to: 'ft-reviewer', label: '변경 내용' },
  ],
  settings: { maxThreads: 3, maxDepth: 1 },
  howToRun:
    '리더는 처음 연 Claude Code 대화창입니다. 첫 프롬프트의 "할 일"에 만들 기능과, A·B가 각각 맡을 부분을 적어 주세요. 팀원 수만큼 사용량이 늘어나니 작은 기능으로 먼저 시험해 보세요.',
};

// 조리법: 토론형 (설정 파일 없이 프롬프트 하나. 무료 웹 채팅에서도 된다)
const decisionDebate: Recipe = {
  schemaVersion: 1,
  id: 'builtin-decision-debate',
  title: '결정 토론 (사회자·조사·검증·반대자)',
  summary:
    '무엇을 고를지 망설여질 때 쓰는 토론입니다. AI 하나가 네 역할을 번갈아 맡아 근거를 모으고, 따져 보고, 일부러 반대한 뒤 결론을 냅니다. 설치할 것 없이 프롬프트만 붙여 넣으면 됩니다.',
  useCase: '기술 선택, 우선순위, 할지 말지 결정',
  author: 'teamcook',
  lastVerified: VERIFIED,
  collaboration: 'debate',
  cards: [
    {
      id: 'dd-moderator',
      name: 'moderator',
      displayName: '사회자',
      role: '주제와 판단 기준을 정하고, 마지막에 결론을 정리한다.',
      instructions: [
        '어느 편도 들지 않는다.',
        '처음에 "무엇을 결정하는지"와 판단 기준 3가지를 정한다.',
        '토론이 주제에서 벗어나면 되돌린다.',
      ].join('\n'),
      preferredEngine: 'manual',
      permission: 'read-only',
      tags: ['planner'],
    },
    {
      id: 'dd-researcher',
      name: 'researcher',
      displayName: '조사',
      role: '선택지마다 사실과 근거를 모은다.',
      instructions: [
        '선택지마다 장점·비용·전제 조건을 정리한다.',
        '아는 사실과 추측을 구분한다. 모르는 것은 "확인 필요"라고 쓴다.',
      ].join('\n'),
      preferredEngine: 'manual',
      permission: 'read-only',
      tags: ['researcher'],
    },
    {
      id: 'dd-verifier',
      name: 'verifier',
      displayName: '검증',
      role: '조사가 내놓은 근거가 맞는지 따져 본다.',
      instructions: [
        '근거마다 "확실함 / 그럴듯함 / 근거 부족"으로 등급을 매긴다.',
        '숫자나 출처가 빠진 주장은 그대로 넘기지 않는다.',
      ].join('\n'),
      preferredEngine: 'manual',
      permission: 'read-only',
      tags: ['reviewer'],
    },
    {
      id: 'dd-opponent',
      name: 'opponent',
      displayName: '반대자',
      role: '지금 가장 유력한 선택지에 일부러 반대한다.',
      instructions: [
        '"이 선택이 실패한다면 이유는 무엇일까?"에서 출발한다.',
        '가장 큰 위험 2가지와, 그 위험을 줄이는 방법을 함께 말한다.',
        '반대를 위한 반대는 하지 않는다. 반론이 약하면 약하다고 인정한다.',
      ].join('\n'),
      preferredEngine: 'manual',
      permission: 'read-only',
      tags: ['reviewer'],
    },
  ],
  handoffs: [
    { id: 'dd-h1', from: 'dd-moderator', to: 'dd-researcher', label: '주제와 판단 기준' },
    { id: 'dd-h2', from: 'dd-researcher', to: 'dd-verifier', label: '근거' },
    { id: 'dd-h3', from: 'dd-verifier', to: 'dd-opponent', label: '검증된 근거' },
    { id: 'dd-h4', from: 'dd-opponent', to: 'dd-moderator', label: '반론' },
  ],
  settings: { maxThreads: 1, maxDepth: 1 },
  howToRun:
    '프롬프트의 "주제:" 줄에 선택지를 함께 적으면 좋아요. 예: "새 프로젝트의 상태 관리를 zustand로 할지 Redux로 할지". 중요한 결정이면 다른 AI에도 같은 프롬프트를 넣어 결론을 비교해 보세요.',
};

/** 순서를 바꾸지 말 것: 테스트가 앞의 3개를 순서대로 꺼내 쓴다. 새 레시피는 뒤에 붙인다. */
export const builtinRecipes: Recipe[] = [crossReview, planBuildReview, researchTeam, featureTeam, decisionDebate];
