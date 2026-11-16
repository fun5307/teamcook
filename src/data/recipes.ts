// 기본 레시피 3종 (PROJECT_BRIEF.md 9장).
// 배지와 실행 경로는 여기 적지 않는다. lib/requiredPlans.ts, lib/resolvePath.ts가 계산한다.
// 모델 이름은 일부러 비워 둔다(각 도구의 기본 모델을 따름). 모델 이름은 자주 바뀌기 때문이다.

import type { Recipe } from '../types';

const crossReview: Recipe = {
  schemaVersion: 1,
  id: 'builtin-cross-review',
  title: 'Claude 작성 + Codex 교차 검토',
  summary:
    'Claude Code가 기능을 구현하고, 다른 회사 모델인 Codex가 읽기 전용으로 검토합니다. 같은 모델이 자기 결과를 검토할 때 놓치는 문제를 잡아냅니다.',
  useCase: '기능 구현 후 검토',
  author: 'teamcook',
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

export const builtinRecipes: Recipe[] = [crossReview, planBuildReview, researchTeam];
