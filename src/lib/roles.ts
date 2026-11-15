// 역할 태그를 다루는 작은 도우미들.
import type { AgentCard, RoleTag } from '../types';

export const ROLE_LABELS: Record<RoleTag, string> = {
  writer: '작성자',
  implementer: '구현 담당',
  reviewer: '검토자',
  researcher: '조사원',
  planner: '기획자',
  synthesizer: '정리원',
};

export const ROLE_TAGS = Object.keys(ROLE_LABELS) as RoleTag[];

/** 사용량을 많이 쓰는 무거운 역할 */
const HEAVY: string[] = ['writer', 'implementer'];
/** 짧고 가벼운 역할 */
const LIGHT: string[] = ['reviewer', 'researcher'];

const has = (card: AgentCard, tags: string[]) => (card.tags ?? []).some((tag) => tags.includes(tag));

export const isReviewer = (card: AgentCard) => has(card, ['reviewer']);
/** 교차 검토에서 '작성자'로 보는 역할 */
export const isWriter = (card: AgentCard) => has(card, HEAVY);
export const isHeavy = (card: AgentCard) => has(card, HEAVY);
export const isLight = (card: AgentCard) => !isHeavy(card) && has(card, LIGHT);

const KEYWORDS: [RoleTag, RegExp][] = [
  ['reviewer', /review|검토|검증|심사|평가|valid|audit|critic/i],
  ['researcher', /research|scout|explor|조사|탐색|발굴|수집|리서치/i],
  ['planner', /plan|strateg|기획|계획|설계|전략/i],
  ['implementer', /implement|fix|worker|develop|구현|개발|수정/i],
  ['synthesizer', /synth|summar|정리|요약|종합/i],
  ['writer', /writ|draft|author|작성|초안/i],
];

/** 이름과 설명을 보고 역할 태그를 짐작한다. 불러온 파일에 태그가 없을 때 쓴다. */
export function suggestTags(name: string, description: string): RoleTag[] {
  for (const [tag, pattern] of KEYWORDS) {
    if (pattern.test(name)) return [tag];
  }
  for (const [tag, pattern] of KEYWORDS) {
    if (pattern.test(description)) return [tag];
  }
  return [];
}
