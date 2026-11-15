// 실행 경로 해석기.
// 카드마다 "내 플랜으로 쓸 수 있는 가장 좋은 경로"를 사다리 위에서부터 찾는다.
//   ① 구독 로그인  ② API 키(종량제)  ③ 무료·제한 경로  ④ 수동(복사·붙여넣기, 마지막 대안)
// 요금제 사실은 전부 providers.json에서 읽는다. 여기에는 판단 규칙만 둔다.

import type {
  AccessRule,
  AgentCard,
  EngineId,
  PathLevel,
  ProviderData,
  ProviderId,
  Recipe,
  UserPlans,
} from '../types';
import { isHeavy, isReviewer, isWriter } from './roles';

export interface PathAlternative {
  engine: EngineId;
  path: PathLevel;
  /** 경로 설명. 예: 'ChatGPT 데스크톱 앱의 Codex (Free·Go 한도)' */
  label: string;
  /** 사용자에게 그대로 보여 줄 판단 근거 문장 */
  reason: string;
  /** fallback: 원래 엔진이 막혀서 필요한 대안 / suggestion: 막히진 않았지만 더 나은 선택 */
  kind: 'fallback' | 'suggestion';
}

export interface PathResolution {
  /** 카드가 원한 엔진을 그대로 쓸 때의 경로. 막혔으면 4(수동). */
  path: PathLevel;
  /** 그 경로에서 쓰는 엔진. 막혔으면 'manual'. */
  engine: EngineId;
  /** 경로 설명 한 줄 */
  label: string;
  /** 카드가 원한 엔진을 내 플랜으로 쓸 수 없으면 true (🔒) */
  locked: boolean;
  lockReason?: string;
  alternative?: PathAlternative;
  /** 사용자에게 그대로 보여 줄 주의 문장들 */
  notes: string[];
}

export interface ResolveContext {
  /** 이 레시피에서 작성자 역할이 실제로 쓰게 되는 제공사들 (교차 검토 판단용) */
  writerProviders?: ProviderId[];
}

export interface RecipeResolution {
  perCard: Record<string, PathResolution>;
  /** 예: '3개 중 2개는 구독으로, 1개는 무료 한도로 실행돼요' */
  summary: string;
  /** 실제로 쓰게 되는 경로별 카드 수 (대안 포함) */
  counts: Record<PathLevel, number>;
  /** 대안 엔진으로 바꿔야 하는 카드 수 */
  fallbackCount: number;
  /** ok: 작성자와 검토자가 다른 제공사 / same-provider: 같은 제공사 / n/a: 해당 없음 */
  crossReview: 'ok' | 'same-provider' | 'n/a';
}

export const PATH_NAMES: Record<PathLevel, string> = {
  1: '구독 로그인',
  2: 'API 키 (종량제)',
  3: '무료·제한 경로',
  4: '수동 (복사·붙여넣기)',
};

export const PATH_SYMBOLS: Record<PathLevel, string> = { 1: '①', 2: '②', 3: '③', 4: '④' };

const MANUAL_LABEL = '무료 웹 채팅에 프롬프트를 복사·붙여넣기';

/** 이 엔진을 내 플랜으로 쓸 수 있는 가장 좋은 조건. 없으면 null. */
export function bestAccess(
  engineId: EngineId,
  plans: UserPlans,
  providers: ProviderData,
): AccessRule | null {
  const engine = providers.engines[engineId];
  if (!engine) return null;

  // 'api' 엔진은 제공사가 정해져 있지 않다. 어느 회사든 API 키가 하나라도 있으면 된다.
  if (engineId === 'api') {
    const hasKey = Object.values(plans.apiKeys).some(Boolean);
    return hasKey ? { path: 2, apiKey: true, label: 'API 키 (종량제)', notes: [] } : null;
  }
  if (!engine.provider) return null;

  const myPlan = plans[engine.provider];
  const hasKey = plans.apiKeys[engine.provider] === true;
  const usable = engine.access
    .filter((rule) => (rule.apiKey ? hasKey : (rule.plans ?? []).includes(myPlan)))
    .sort((a, b) => a.path - b.path);
  return usable[0] ?? null;
}

/** 실제로 쓰게 되는 엔진과 경로 (막혔고 대안이 있으면 대안 쪽) */
export function effectiveRoute(resolution: PathResolution): { engine: EngineId; path: PathLevel } {
  if (resolution.locked && resolution.alternative) {
    return { engine: resolution.alternative.engine, path: resolution.alternative.path };
  }
  return { engine: resolution.engine, path: resolution.path };
}

interface Candidate {
  engineId: EngineId;
  rule: AccessRule;
  provider: ProviderId;
}

/** 내보내기를 지원하는(ready) 다른 엔진 중 내 플랜으로 쓸 수 있는 것들 */
function otherEngines(
  except: EngineId,
  plans: UserPlans,
  providers: ProviderData,
): Candidate[] {
  const result: Candidate[] = [];
  for (const [id, engine] of Object.entries(providers.engines)) {
    const engineId = id as EngineId;
    if (engineId === except || engine.status !== 'ready' || !engine.provider) continue;
    const rule = bestAccess(engineId, plans, providers);
    if (rule) result.push({ engineId, rule, provider: engine.provider });
  }
  return result;
}

/** 무료 계정만 만들면 쓸 수 있는 엔진이 있으면 안내 문장을 만든다. */
function signupHints(plans: UserPlans, providers: ProviderData): string[] {
  const hints: string[] = [];
  for (const engine of Object.values(providers.engines)) {
    if (engine.status !== 'ready' || !engine.provider) continue;
    const freeRule = engine.access.find((rule) => rule.free && (rule.plans ?? []).includes('free'));
    if (freeRule && plans[engine.provider] === 'none') {
      const product = providers.providers[engine.provider].productName;
      hints.push(`${product} 무료 계정을 만들면 ${engine.name}를 무료 한도로 쓸 수 있어요.`);
    }
  }
  return hints;
}

/**
 * 카드 하나의 실행 경로를 정한다.
 * context.writerProviders를 주면 검토자 카드에 교차 검토 규칙을 적용한다.
 */
export function resolvePath(
  card: AgentCard,
  plans: UserPlans,
  providers: ProviderData,
  context: ResolveContext = {},
): PathResolution {
  const engine = providers.engines[card.preferredEngine];
  const writerProviders = context.writerProviders ?? [];
  const reviewer = isReviewer(card);

  // 수동을 고른 카드는 그대로 ④
  if (card.preferredEngine === 'manual' || !engine) {
    return { path: 4, engine: 'manual', label: MANUAL_LABEL, locked: false, notes: [] };
  }

  const own = bestAccess(card.preferredEngine, plans, providers);
  const others = otherEngines(card.preferredEngine, plans, providers);

  if (own) {
    const notes = [...own.notes];
    if (engine.status === 'preparing') {
      notes.push(
        `${engine.name} 설정 파일 내보내기는 준비 중이에요. 지금은 Codex·Claude 형식으로만 내보내져요.`,
      );
    }
    const resolution: PathResolution = {
      path: own.path,
      engine: card.preferredEngine,
      label: own.label,
      locked: false,
      notes,
    };

    // 규칙: 검토자는 작성자와 다른 제공사를 우선한다 (교차 검토)
    if (reviewer && engine.provider && writerProviders.includes(engine.provider)) {
      const cross = others
        .filter((candidate) => !writerProviders.includes(candidate.provider))
        .sort((a, b) => a.rule.path - b.rule.path)[0];
      if (cross) {
        resolution.alternative = {
          engine: cross.engineId,
          path: cross.rule.path,
          label: cross.rule.label,
          kind: 'suggestion',
          reason: `작성자와 같은 회사 모델이에요. ${providers.engines[cross.engineId].name}(${cross.rule.label})로 교차 검토하면 놓치는 게 줄어요.`,
        };
      }
      return resolution;
    }

    // 규칙: 무거운 역할은 무료 한도보다 유료 구독에 맡긴다 (구독 최적화)
    if (isHeavy(card) && own.path === 3) {
      const paid = others.find((candidate) => candidate.rule.path === 1);
      if (paid) {
        resolution.alternative = {
          engine: paid.engineId,
          path: 1,
          label: paid.rule.label,
          kind: 'suggestion',
          reason: `무거운 역할이라 무료 한도보다 구독(${providers.engines[paid.engineId].name})에 맡기는 편이 좋아요.`,
        };
      }
    }
    return resolution;
  }

  // 여기부터는 카드가 원한 엔진을 쓸 수 없는 경우 (🔒)
  const heavy = isHeavy(card);
  const ranked = [...others].sort((a, b) => {
    // 1) 검토자는 작성자와 다른 제공사가 먼저
    if (reviewer) {
      const diff =
        Number(writerProviders.includes(a.provider)) - Number(writerProviders.includes(b.provider));
      if (diff !== 0) return diff;
    }
    // 2) 사다리에서 더 높은 경로(숫자가 작은 쪽)가 먼저
    if (a.rule.path !== b.rule.path) return a.rule.path - b.rule.path;
    // 3) 같은 경로라면 무거운 역할은 유료 쪽, 가벼운 역할은 무료 쪽이 먼저
    const freeDiff = Number(a.rule.free === true) - Number(b.rule.free === true);
    return heavy ? freeDiff : -freeDiff;
  });
  const best = ranked[0];

  const resolution: PathResolution = {
    path: 4,
    engine: 'manual',
    label: MANUAL_LABEL,
    locked: true,
    lockReason: engine.lockReason,
    notes: [],
  };

  if (best) {
    const name = providers.engines[best.engineId].name;
    const crossReview = reviewer && !writerProviders.includes(best.provider) && writerProviders.length > 0;
    resolution.alternative = {
      engine: best.engineId,
      path: best.rule.path,
      label: best.rule.label,
      kind: 'fallback',
      reason: crossReview
        ? `대신 ${name}(${best.rule.label})로 교차 검토할 수 있어요.`
        : `대신 ${name}(${best.rule.label})로 실행할 수 있어요.`,
    };
    resolution.notes.push(...best.rule.notes);
  } else {
    resolution.notes.push(
      '지금 플랜으로는 자동 실행 경로가 없어요. 무료 웹 채팅에 직접 복사·붙여넣기 해야 해요.',
      ...signupHints(plans, providers),
    );
  }
  return resolution;
}

function providerOf(engineId: EngineId, providers: ProviderData): ProviderId | null {
  return providers.engines[engineId]?.provider ?? null;
}

/** 레시피 전체의 실행 경로를 정하고 한 줄 요약을 만든다. */
export function resolveRecipe(
  recipe: Recipe,
  plans: UserPlans,
  providers: ProviderData,
): RecipeResolution {
  const perCard: Record<string, PathResolution> = {};

  // 1차: 작성자 등 검토자가 아닌 카드부터 정한다
  for (const card of recipe.cards) {
    perCard[card.id] = resolvePath(card, plans, providers);
  }

  // 작성자 역할이 실제로 쓰게 되는 제공사
  const writerProviders: ProviderId[] = [];
  for (const card of recipe.cards.filter(isWriter)) {
    const provider = providerOf(effectiveRoute(perCard[card.id]).engine, providers);
    if (provider && !writerProviders.includes(provider)) writerProviders.push(provider);
  }

  // 2차: 검토자는 작성자가 쓰는 제공사를 알고 나서 다시 정한다
  const reviewers = recipe.cards.filter((card) => isReviewer(card) && !isWriter(card));
  for (const card of reviewers) {
    perCard[card.id] = resolvePath(card, plans, providers, { writerProviders });
  }

  let crossReview: RecipeResolution['crossReview'] = 'n/a';
  if (reviewers.length > 0 && writerProviders.length > 0) {
    const allDifferent = reviewers.every((card) => {
      const provider = providerOf(effectiveRoute(perCard[card.id]).engine, providers);
      return provider !== null && !writerProviders.includes(provider);
    });
    crossReview = allDifferent ? 'ok' : 'same-provider';
  }

  const counts: Record<PathLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let fallbackCount = 0;
  for (const card of recipe.cards) {
    const resolution = perCard[card.id];
    counts[effectiveRoute(resolution).path] += 1;
    if (resolution.locked && resolution.alternative) fallbackCount += 1;
  }

  return {
    perCard,
    summary: summarize(recipe.cards.length, counts, fallbackCount),
    counts,
    fallbackCount,
    crossReview,
  };
}

function summarize(total: number, counts: Record<PathLevel, number>, fallbackCount: number): string {
  if (total === 0) return '아직 카드가 없어요.';
  const words: Record<PathLevel, string> = {
    1: '구독으로',
    2: 'API 키로',
    3: '무료 한도로',
    4: '수동(복사·붙여넣기)으로만',
  };
  const used = ([1, 2, 3, 4] as PathLevel[]).filter((path) => counts[path] > 0);
  const tail = fallbackCount > 0 ? ` (${fallbackCount}개는 대안 엔진으로 바꿔서)` : '';
  if (used.length === 1) {
    const only = used[0];
    const verb = only === 4 ? '할 수 있어요' : '실행돼요';
    return `${total}개 모두 ${words[only]} ${verb}${tail}`;
  }
  const parts = used.map((path) => `${counts[path]}개는 ${words[path]}`);
  return `${total}개 중 ${parts.join(', ')} 실행돼요${tail}`;
}
