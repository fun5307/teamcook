// 구독 최적화: 내 플랜 조합에서 역할을 어떻게 나누면 한도를 가장 오래 쓰는지 제안한다.
// (PROJECT_BRIEF.md 6단계 '구독 최적화 고도화')
//
// 규칙 (위에서부터 우선)
//  1. 쓸 수 있는 도구만 쓴다. 수동(④)뿐인 카드는 건드리지 않는다.
//  2. 무거운 역할(작성자·구현 담당)은 유료 구독(①)에 둔다. 유료가 여럿이면 번갈아 나눈다.
//  3. 검토자는 작성자와 다른 회사 도구에 둔다 (교차 검토). 가능하면 유료, 없으면 무료 한도.
//  4. 가벼운 역할(조사원)은 무료 한도(③)가 있으면 거기에 둬서 유료 한도를 아낀다.
//  5. 나머지(기획자·정리원 등)는 유료 구독 중 일이 가장 적게 몰린 곳에 둔다.
//  6. 이미 좋은 자리에 있는 카드는 옮기지 않는다 (바꿀 이유가 없으면 그대로).

import type { AccessRule, AgentCard, EngineId, ProviderData, ProviderId, Recipe, UserPlans } from '../types';
import { bestAccess } from './resolvePath';
import { isHeavy, isReviewer, isWriter } from './roles';

export interface OptimizeChange {
  cardId: string;
  from: EngineId;
  to: EngineId;
  /** 사용자에게 그대로 보여 줄 이유 */
  reason: string;
}

export interface OptimizeResult {
  changes: OptimizeChange[];
  /** 예: '카드 2장을 옮기면 교차 검토가 되고, 유료 한도를 아낄 수 있어요.' */
  summary: string;
}

interface Seat {
  engine: EngineId;
  provider: ProviderId;
  rule: AccessRule;
  /** 요금제 정보를 공식 문서로 확인한 도구인지 */
  official: boolean;
  /** 지금까지 이 도구에 배치한 무거운 일의 수 */
  load: number;
}

function availableSeats(plans: UserPlans, providers: ProviderData): Seat[] {
  const seats: Seat[] = [];
  for (const [id, engine] of Object.entries(providers.engines)) {
    if (engine.status !== 'ready' || !engine.provider) continue;
    const rule = bestAccess(id as EngineId, plans, providers);
    if (!rule) continue;
    seats.push({
      engine: id as EngineId,
      provider: engine.provider,
      rule,
      official: engine.confidence === 'official',
      load: 0,
    });
  }
  return seats;
}

/** 조건에 맞는 자리 중 가장 좋은 것: 공식 확인 > 일이 적게 몰린 곳 > 원래 순서 */
function pick(seats: Seat[], filter: (seat: Seat) => boolean): Seat | undefined {
  return seats
    .filter(filter)
    .sort((a, b) => Number(b.official) - Number(a.official) || a.load - b.load)[0];
}

export function optimizeRecipe(
  recipe: Recipe,
  plans: UserPlans,
  providers: ProviderData,
): OptimizeResult {
  const seats = availableSeats(plans, providers);
  const seatOf = (engine: EngineId) => seats.find((seat) => seat.engine === engine);
  const name = (engine: EngineId) => providers.engines[engine].name;
  const paid = (seat: Seat) => seat.rule.path === 1;
  const free = (seat: Seat) => seat.rule.path === 3;
  const changes: OptimizeChange[] = [];
  const assigned = new Map<string, EngineId>();

  if (seats.length === 0) {
    return { changes, summary: '지금 플랜으로 쓸 수 있는 도구가 없어서 제안할 배치가 없어요.' };
  }

  const place = (card: AgentCard, target: Seat | undefined, reason: string, heavy: boolean) => {
    const current = seatOf(card.preferredEngine);
    const chosen = target ?? current;
    if (!chosen) return;
    assigned.set(card.id, chosen.engine);
    if (heavy) chosen.load += 1;
    if (chosen.engine !== card.preferredEngine) {
      changes.push({ cardId: card.id, from: card.preferredEngine, to: chosen.engine, reason });
    }
  };

  // 지금 자리가 조건을 만족하면 그대로 두고, 아니면 조건에 맞는 자리를 찾는다
  const keepOr = (card: AgentCard, good: (seat: Seat) => boolean): Seat | undefined => {
    const current = seatOf(card.preferredEngine);
    return current && good(current) ? current : pick(seats, good);
  };

  const writers = recipe.cards.filter(isWriter);
  const reviewers = recipe.cards.filter((card) => isReviewer(card) && !isWriter(card));
  const others = recipe.cards.filter((card) => !writers.includes(card) && !reviewers.includes(card));

  // 2. 무거운 역할 → 유료 구독
  for (const card of writers) {
    const target = keepOr(card, paid) ?? keepOr(card, (seat) => seat.rule.path === 2) ?? keepOr(card, free);
    const where = target ? name(target.engine) : '';
    place(
      card,
      target,
      target && paid(target)
        ? `무거운 역할이라 유료 구독(${where})에 두는 게 좋아요.`
        : `지금 플랜으로 쓸 수 있는 ${where}로 옮겨요.`,
      true,
    );
  }

  // 3. 검토자 → 작성자와 다른 회사
  const writerProviders = new Set(
    writers.map((card) => seatOf(assigned.get(card.id) ?? card.preferredEngine)?.provider),
  );
  for (const card of reviewers) {
    const other = (seat: Seat) => !writerProviders.has(seat.provider);
    const target =
      writerProviders.size > 0
        ? (keepOr(card, other) ?? keepOr(card, () => true))
        : keepOr(card, () => true);
    const cross = target ? other(target) && writerProviders.size > 0 : false;
    place(
      card,
      target,
      cross
        ? `작성자와 다른 회사 모델(${target ? name(target.engine) : ''})로 검토하면 놓치는 게 줄어요.`
        : `지금 플랜으로 쓸 수 있는 ${target ? name(target.engine) : ''}로 옮겨요.`,
      false,
    );
  }

  // 4·5. 나머지
  for (const card of others) {
    const light = !isHeavy(card) && (card.tags ?? []).includes('researcher');
    if (light) {
      const target = keepOr(card, free) ?? keepOr(card, () => true);
      place(
        card,
        target,
        target && free(target)
          ? `가벼운 역할이라 무료 한도(${name(target.engine)})에 두면 유료 한도를 아낄 수 있어요.`
          : `지금 플랜으로 쓸 수 있는 ${target ? name(target.engine) : ''}로 옮겨요.`,
        false,
      );
    } else {
      const target = keepOr(card, paid) ?? keepOr(card, () => true);
      place(
        card,
        target,
        target && paid(target)
          ? `유료 구독(${name(target.engine)})이 있으니 한도가 작은 무료 경로 대신 여기에 두는 게 좋아요.`
          : `지금 플랜으로 쓸 수 있는 ${target ? name(target.engine) : ''}로 옮겨요.`,
        true,
      );
    }
  }

  const summary =
    changes.length === 0
      ? '지금 배치가 내 플랜에 가장 잘 맞아요. 바꿀 것이 없어요.'
      : `카드 ${changes.length}장을 옮기면 내 플랜을 더 알뜰하게 쓸 수 있어요.`;
  return { changes, summary };
}

/** 제안을 레시피에 적용한다. 도구가 바뀐 카드는 모델 이름을 지운다(다른 회사 모델 이름이라). */
export function applyOptimization(recipe: Recipe, result: OptimizeResult): Recipe {
  const target = new Map(result.changes.map((change) => [change.cardId, change.to]));
  return {
    ...recipe,
    cards: recipe.cards.map((card) => {
      const engine = target.get(card.id);
      if (!engine) return card;
      const { model: _model, ...rest } = card;
      return { ...rest, preferredEngine: engine };
    }),
  };
}
