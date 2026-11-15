// '필요한 플랜' 배지.
// 레시피를 그대로(각 카드의 preferredEngine대로) 돌리는 데 필요한 최소 플랜 조합을 계산한다.

import type { EngineId, ProviderData, Recipe, UserPlans } from '../types';
import { effectiveRoute, resolveRecipe } from './resolvePath';

export interface PlanBadge {
  engine: EngineId;
  /** 예: 'Claude Pro 필요', 'ChatGPT 무료' */
  text: string;
  free: boolean;
  /** 이 조건의 주의 문장 (예: 한도가 작아요) */
  notes: string[];
}

export interface RequiredPlans {
  /** 예: ['ChatGPT 무료로 가능'] 또는 ['Claude Pro 필요', 'ChatGPT 무료'] */
  badges: string[];
  /** 모든 카드가 무료 경로로 돌 수 있으면 true */
  allFree: boolean;
  /** 화면에서 색을 나눠 칠할 때 쓰는 자세한 정보 (badges와 같은 순서) */
  details: PlanBadge[];
}

export function requiredPlans(recipe: Recipe, providers: ProviderData): RequiredPlans {
  const engines: EngineId[] = [];
  for (const card of recipe.cards) {
    if (!engines.includes(card.preferredEngine)) engines.push(card.preferredEngine);
  }

  const details: PlanBadge[] = [];
  for (const engineId of engines) {
    const engine = providers.engines[engineId];
    if (!engine || engineId === 'manual') continue;
    if (engineId === 'api') {
      details.push({ engine: engineId, text: 'API 키 필요', free: false, notes: [] });
      continue;
    }
    // 가장 싼 조건 = 플랜으로 열리는 조건 중 사다리 맨 아래 (무료 경로가 있으면 그것)
    const cheapest = engine.access
      .filter((rule) => rule.plans && rule.badge)
      .sort((a, b) => b.path - a.path)[0];
    if (!cheapest || !cheapest.badge) continue;
    details.push({
      engine: engineId,
      text: cheapest.badge,
      free: cheapest.free === true,
      notes: cheapest.notes,
    });
  }

  // 유료 조건을 앞에, 무료 조건을 뒤에
  details.sort((a, b) => Number(a.free) - Number(b.free));
  const allFree = details.every((badge) => badge.free);
  const finished = details.map((badge) =>
    allFree ? { ...badge, text: `${badge.text}로 가능` } : badge,
  );

  return { badges: finished.map((badge) => badge.text), allFree, details: finished };
}

/**
 * 내 플랜으로 이 레시피를 돌릴 수 있는지.
 * - full: 그대로 가능
 * - with-alternatives: 일부 카드를 대안 엔진으로 바꾸면 가능
 * - no: 수동(복사·붙여넣기)으로만 할 수 있는 카드가 있음
 */
export function fitsMyPlans(
  recipe: Recipe,
  plans: UserPlans,
  providers: ProviderData,
): 'full' | 'with-alternatives' | 'no' {
  const { perCard } = resolveRecipe(recipe, plans, providers);
  let needsAlternative = false;
  for (const card of recipe.cards) {
    if (card.preferredEngine === 'manual') continue;
    const resolution = perCard[card.id];
    if (effectiveRoute(resolution).path === 4) return 'no';
    if (resolution.locked) needsAlternative = true;
  }
  return needsAlternative ? 'with-alternatives' : 'full';
}
