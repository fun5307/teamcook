// 꿀팁 콘텐츠 (PROJECT_BRIEF.md 10장)와, 카드·레시피를 보고 내는 경고.

import type { AgentCard, Recipe } from '../types';
import { isReviewer } from '../lib/roles';

export interface Tip {
  id: string;
  title: string;
  body: string;
}

export const TIPS: Tip[] = [
  {
    id: 'cross-review',
    title: '쓰는 모델과 검토하는 모델을 다르게',
    body: '같은 모델이 자기 결과를 검토하면 자기 패턴을 닮아 놓치기 쉬워요. 다른 회사 모델로 교차 검토하세요.',
  },
  {
    id: 'reviewer-read-only',
    title: '검토자는 읽기 전용',
    body: '검토 역할에는 수정 권한을 주지 마세요. 검토자가 몰래 고치면 무엇이 바뀌었는지 알기 어려워져요.',
  },
  {
    id: 'specific-description',
    title: '역할 설명을 구체적으로',
    body: 'AI는 이 설명을 보고 언제 일을 맡길지 정해요. "코드 검토"보다 "변경된 파일의 보안·버그를 검토할 때 사용"이 낫습니다.',
  },
  {
    id: 'explicit-context',
    title: '넘겨줄 정보를 명시',
    body: '서브에이전트는 따로 떨어진 대화창에서 일해요. 부모가 알려 주지 않은 맥락은 모릅니다.',
  },
  {
    id: 'small-threads',
    title: '동시 실행 수는 작게 시작',
    body: '에이전트가 늘수록 사용량도 빨리 줄어요. 2~3개로 시작하세요.',
  },
  {
    id: 'claims-not-facts',
    title: "검토 결과는 '주장'으로",
    body: '다른 모델의 지적도 틀릴 수 있어요. 작성자가 확인한 뒤 맞는 것만 반영하세요.',
  },
  {
    id: 'save-free-quota',
    title: '무료 한도는 아껴서',
    body: '무료 경로(③)에 놓인 카드에는 짧고 분명한 작업만 맡기세요.',
  },
];

export interface Warning {
  level: 'error' | 'warn';
  message: string;
}

/** 파일 이름으로 써도 안전한 에이전트 이름인지 */
export const AGENT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** 카드 하나를 보고 고칠 점을 알려 준다. */
export function cardWarnings(card: AgentCard, recipe?: Recipe): Warning[] {
  const warnings: Warning[] = [];
  if (!AGENT_NAME_PATTERN.test(card.name)) {
    warnings.push({
      level: 'error',
      message: '이름은 영문 소문자·숫자·밑줄(_)·하이픈(-)만 쓸 수 있어요. 파일 이름이 되기 때문이에요.',
    });
  }
  if (recipe && recipe.cards.filter((other) => other.name === card.name).length > 1) {
    warnings.push({ level: 'error', message: '같은 이름의 에이전트가 또 있어요. 이름은 서로 달라야 해요.' });
  }
  if (card.role.trim().length < 12) {
    warnings.push({
      level: 'warn',
      message: '역할 설명이 짧아요. "언제 이 에이전트에게 맡길지"를 구체적으로 적어 주세요.',
    });
  }
  if (card.instructions.trim().length === 0) {
    warnings.push({ level: 'warn', message: '지시문이 비어 있어요.' });
  }
  if (isReviewer(card) && card.permission !== 'read-only') {
    warnings.push({ level: 'warn', message: '검토자는 읽기 전용을 권해요. 검토자가 직접 고치면 추적하기 어려워요.' });
  }
  return warnings;
}

/** 레시피 전체를 보고 고칠 점을 알려 준다. */
export function recipeWarnings(recipe: Recipe): Warning[] {
  const warnings: Warning[] = [];
  if (recipe.cards.length === 0) {
    warnings.push({ level: 'warn', message: '아직 카드가 없어요. 카드를 추가하거나 파일을 불러오세요.' });
  }
  if (recipe.settings.maxThreads > 3) {
    warnings.push({
      level: 'warn',
      message: '동시 실행 수가 많아요. 에이전트가 늘수록 사용량이 빨리 줄어요. 2~3개로 시작해 보세요.',
    });
  }
  return warnings;
}
