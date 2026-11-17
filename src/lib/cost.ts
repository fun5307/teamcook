// 레시피의 '사용량 어림'과 '내 여건에서 어떻게 나가는지'.
// 토큰 수나 금액을 숫자로 짐작하지 않는다. 실제 사용량은 과제 크기에 따라 크게 달라서,
// 조리법과 역할 수로 "가벼움·보통·무거움"만 가늠하고 그 이유를 함께 보여 준다.
//
// 근거 (2026-11-17 확인, Claude Code 공식 문서):
// - 서브에이전트: 역할마다 자기 문맥 창을 쓰고 결과만 요약해 돌려준다. 토큰 비용 "Lower".
// - 에이전트 팀: 팀원마다 별도의 Claude가 돈다. "use significantly more tokens than a single session",
//   팀원이 계획 모드로 돌면 표준 세션의 약 7배. 비용은 팀원 수에 비례해 늘어난다.
//   https://code.claude.com/docs/en/agent-teams , https://code.claude.com/docs/en/costs
// 다른 도구(Codex 등)의 서브에이전트도 역할마다 따로 문맥을 쓴다는 같은 가정을 적용했다 (어림).

import { collaborationOf } from '../data/collaboration';
import type { ProviderData, Recipe, UserPlans } from '../types';
import { effectiveRoute, resolveRecipe } from './resolvePath';

export type UsageLevel = 'light' | 'medium' | 'heavy';

/** 사용자가 고르는 '사용량 여유' */
export type Budget = 'save' | 'normal' | 'plenty';

export const BUDGETS: Budget[] = ['save', 'normal', 'plenty'];

export const BUDGET_LABELS: Record<Budget, string> = {
  save: '아껴 쓰기',
  normal: '보통',
  plenty: '넉넉하게',
};

export const BUDGET_HINTS: Record<Budget, string> = {
  save: '한도가 작거나 쓴 만큼 돈이 나가요. 가벼운 레시피를 먼저 권해요.',
  normal: '과제에 맞는 것을 먼저 권하고, 사용량은 알려만 드려요.',
  plenty: '한도가 넉넉해요. 무거운 레시피도 가리지 않아요.',
};

export const USAGE_LABELS: Record<UsageLevel, string> = {
  light: '가벼움',
  medium: '보통',
  heavy: '무거움',
};

export interface UsageEstimate {
  level: UsageLevel;
  /** 동시에 또는 차례로 쓰이는 대화 창(문맥) 수의 어림. 토큰 수가 아니다. */
  contexts: number;
  /** 왜 그렇게 봤는지 한 줄 */
  reason: string;
}

/** 조리법과 역할 수로 가늠한 사용량. 과제 크기는 모르므로 서로 견주는 용도로만 쓴다. */
export function usageEstimate(recipe: Recipe): UsageEstimate {
  const style = collaborationOf(recipe);
  const count = recipe.cards.length;
  if (style === 'debate') {
    return { level: 'light', contexts: 1, reason: '대화 창 하나에서 여러 역할을 번갈아 맡아요.' };
  }
  if (style === 'agent-team') {
    return {
      level: 'heavy',
      contexts: count + 1,
      reason: `팀원 ${count}명이 각자 따로 돌고 서로 대화해요. 혼자 할 때보다 토큰을 훨씬 많이 써요.`,
    };
  }
  if (count === 0) return { level: 'light', contexts: 1, reason: '역할이 아직 없어요.' };
  return {
    level: count >= 4 ? 'heavy' : 'medium',
    contexts: count + 1,
    reason: `메인 AI와 서브에이전트 ${count}개가 각자 대화 창을 써요. 결과만 요약해 돌려받아요.`,
  };
}

export interface CostOutlook {
  usage: UsageEstimate;
  /** 구독 한도에서 나가는 역할 수 / API 키로 결제되는 역할 수 / 무료 한도로 도는 역할 수 / 직접 붙여 넣는 역할 수 */
  subscription: number;
  metered: number;
  freeTier: number;
  manual: number;
  /** 사용자에게 보여 줄 문장들 */
  lines: string[];
}

/** 내 플랜으로 돌렸을 때 사용량이 어디서 나가는지 (구독 한도, 쓴 만큼 결제, 무료 한도) */
export function costOutlook(recipe: Recipe, plans: UserPlans, providers: ProviderData): CostOutlook {
  const usage = usageEstimate(recipe);
  const outlook: CostOutlook = { usage, subscription: 0, metered: 0, freeTier: 0, manual: 0, lines: [] };
  if (collaborationOf(recipe) === 'debate') {
    outlook.lines.push('쓰는 AI 채팅의 한도 안에서 대화 한 번으로 끝나요. 무료 채팅으로도 돼요.');
    return outlook;
  }
  const { perCard } = resolveRecipe(recipe, plans, providers);
  for (const card of recipe.cards) {
    const resolution = perCard[card.id];
    if (!resolution) continue;
    const { path } = effectiveRoute(resolution);
    if (path === 1) outlook.subscription += 1;
    else if (path === 2) outlook.metered += 1;
    else if (path === 3) outlook.freeTier += 1;
    else outlook.manual += 1;
  }
  if (outlook.subscription > 0) {
    outlook.lines.push(
      `역할 ${outlook.subscription}개는 구독 한도에서 나가요. 돈이 더 들지는 않지만${
        usage.level === 'heavy' ? ' 무거운 레시피라 한도가 빨리 줄어요.' : ' 한도를 써요.'
      }`,
    );
  }
  if (outlook.metered > 0) {
    outlook.lines.push(`역할 ${outlook.metered}개는 API 키로 돌아요. 쓴 만큼 돈이 나가요.`);
  }
  if (outlook.freeTier > 0) {
    outlook.lines.push(
      `역할 ${outlook.freeTier}개는 무료 한도로 돌아요.${usage.level === 'light' ? '' : ' 한도가 작아 중간에 멈출 수 있어요.'}`,
    );
  }
  if (outlook.manual > 0) {
    outlook.lines.push(`역할 ${outlook.manual}개는 직접 복사·붙여넣기로 해야 해요.`);
  }
  return outlook;
}
