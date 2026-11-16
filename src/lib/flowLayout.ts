// 흐름 캔버스의 자동 배치: 넘겨주기 순서를 보고 카드를 왼쪽 → 오른쪽 단계로 늘어놓는다.
// 위치는 저장하지 않는다. 데이터는 Recipe 하나뿐이고, 그림은 그때그때 계산한다.

import type { Recipe } from '../types';

export interface FlowPosition {
  /** 왼쪽에서 몇 번째 단계인지 (0부터) */
  level: number;
  /** 그 단계 안에서 위에서 몇 번째인지 (0부터) */
  row: number;
}

/**
 * 카드별 위치를 정한다.
 * - 넘겨주기를 순서대로 보면서, 처음 등장하는 '받는 쪽'을 '주는 쪽'의 다음 단계에 놓는다.
 * - 이미 자리가 정해진 카드로 되돌아가는 화살표(예: 검토 결과 → 작성자)는 자리를 바꾸지 않는다.
 * - 어떤 흐름에도 없는 카드는 맨 마지막 단계 다음에 따로 모은다.
 */
export function layoutFlow(recipe: Recipe): Record<string, FlowPosition> {
  const known = new Set(recipe.cards.map((card) => card.id));
  const level = new Map<string, number>();

  for (const handoff of recipe.handoffs) {
    if (!known.has(handoff.from) || !known.has(handoff.to)) continue;
    if (!level.has(handoff.from)) level.set(handoff.from, 0);
    if (!level.has(handoff.to)) level.set(handoff.to, level.get(handoff.from)! + 1);
  }

  const maxLevel = Math.max(-1, ...level.values());
  const result: Record<string, FlowPosition> = {};
  const rows = new Map<number, number>();
  for (const card of recipe.cards) {
    const cardLevel = level.get(card.id) ?? maxLevel + 1;
    const row = rows.get(cardLevel) ?? 0;
    rows.set(cardLevel, row + 1);
    result[card.id] = { level: cardLevel, row };
  }
  return result;
}
