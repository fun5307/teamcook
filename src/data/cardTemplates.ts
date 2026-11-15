// '카드 추가'를 누를 때 고르는 역할별 시작 틀.

import type { AgentCard, Permission, RoleTag } from '../types';

interface CardTemplate {
  tag: RoleTag;
  name: string;
  displayName: string;
  role: string;
  instructions: string;
  permission: Permission;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    tag: 'writer',
    name: 'writer',
    displayName: '작성자',
    role: '요청받은 기능을 구현하거나 글을 작성할 때 사용. 파일을 직접 수정한다.',
    instructions:
      '너는 작성 담당이다.\n\n- 요청받은 범위만 바꾼다.\n- 끝나면 무엇을 왜 바꿨는지, 어떻게 확인했는지 짧게 보고한다.\n- 검토 결과를 받으면 사실인지 확인한 뒤 맞는 지적만 반영한다.',
    permission: 'edit',
  },
  {
    tag: 'reviewer',
    name: 'reviewer',
    displayName: '검토자',
    role: '변경된 파일의 버그·보안 문제·빠진 테스트를 검토할 때 사용. 파일은 수정하지 않는다.',
    instructions:
      '너는 독립적인 검토자다.\n\n- 변경된 부분을 확인하고 필요하면 주변 코드도 읽는다.\n- 문제마다 파일 경로와 줄 번호, 이유를 적는다.\n- 확신이 없으면 "추정"이라고 표시한다. 문제가 없으면 없다고 말한다.',
    permission: 'read-only',
  },
  {
    tag: 'researcher',
    name: 'researcher',
    displayName: '조사원',
    role: '주제에 대한 사실과 자료를 출처와 함께 조사할 때 사용. 파일은 수정하지 않는다.',
    instructions:
      '너는 조사원이다.\n\n- 공식 문서와 1차 자료를 먼저 찾는다.\n- 사실마다 출처를 적고, 확인한 것·추론한 것·확인하지 못한 것을 구분한다.\n- 출처나 수치를 지어내지 않는다.',
    permission: 'read-only',
  },
  {
    tag: 'planner',
    name: 'planner',
    displayName: '기획자',
    role: '작업을 시작하기 전에 관련 자료를 읽고 단계별 계획을 세울 때 사용. 파일은 수정하지 않는다.',
    instructions:
      '너는 기획자다.\n\n- 계획은 5단계 이내의 번호 목록으로 쓴다.\n- 단계마다 할 일과 확인 방법을 적는다.\n- 직접 구현하지 않는다. 계획만 보고한다.',
    permission: 'read-only',
  },
  {
    tag: 'implementer',
    name: 'implementer',
    displayName: '구현 담당',
    role: '받은 계획대로 코드를 수정하고 테스트할 때 사용.',
    instructions:
      '너는 구현 담당이다. 받은 계획을 순서대로 실행한다.\n\n- 계획에 없는 파일은 건드리지 않는다.\n- 가장 작은 변경으로 끝내고, 테스트나 빌드로 확인한다.',
    permission: 'edit',
  },
  {
    tag: 'synthesizer',
    name: 'synthesizer',
    displayName: '정리원',
    role: '여러 에이전트의 결과를 받아 하나의 보고서로 정리할 때 사용.',
    instructions:
      '너는 정리원이다.\n\n- 결과들이 서로 어긋나는 부분을 먼저 표시한다.\n- 결론을 맨 위에 3줄 이내로 쓴다.\n- 새로운 사실을 지어 보태지 않는다.',
    permission: 'edit',
  },
];

/** 틀로 새 카드를 만든다. 이름이 겹치면 뒤에 번호를 붙인다. */
export function cardFromTemplate(
  tag: RoleTag,
  id: string,
  existing: AgentCard[],
  engine: AgentCard['preferredEngine'],
): AgentCard {
  const template = CARD_TEMPLATES.find((item) => item.tag === tag) ?? CARD_TEMPLATES[0];
  const names = new Set(existing.map((card) => card.name));
  let name = template.name;
  for (let n = 2; names.has(name); n += 1) name = `${template.name}_${n}`;
  const suffix = name === template.name ? '' : ` ${name.split('_').pop()}`;
  return {
    id,
    name,
    displayName: `${template.displayName}${suffix}`,
    role: template.role,
    instructions: template.instructions,
    preferredEngine: engine,
    permission: template.permission,
    tags: [template.tag],
  };
}
