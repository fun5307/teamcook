import { describe, expect, it } from 'vitest';
import { providerData } from '../data/providers';
import { builtinRecipes } from '../data/recipes';
import type { AgentCard, Recipe, UserPlans } from '../types';
import { fitsMyPlans, requiredPlans } from './requiredPlans';
import { bestAccess, effectiveRoute, resolvePath, resolveRecipe } from './resolvePath';

const [crossReview, planBuildReview, researchTeam] = builtinRecipes;

function plans(overrides: Partial<UserPlans> = {}): UserPlans {
  return { openai: 'none', anthropic: 'none', google: 'none', xai: 'none', apiKeys: {}, ...overrides };
}

// DoD의 4개 사용자 유형
const ALL_FREE = plans({ openai: 'free', anthropic: 'free', google: 'free', xai: 'free' });
const PLUS_ONLY = plans({ openai: 'plus', anthropic: 'free' });
const CLAUDE_PRO_ONLY = plans({ openai: 'free', anthropic: 'pro' });
const BOTH_PAID = plans({ openai: 'pro', anthropic: 'max' });

function card(overrides: Partial<AgentCard>): AgentCard {
  return {
    id: 'c',
    name: 'agent',
    displayName: '에이전트',
    role: '역할',
    instructions: '지시문',
    preferredEngine: 'codex-cli',
    permission: 'full',
    ...overrides,
  };
}

const claudeWriter = crossReview.cards[0];
const codexReviewer = crossReview.cards[1];

describe('사용자 유형 1: 전부 무료', () => {
  it('Claude Code 카드는 🔒이고 Codex 무료 한도가 대안으로 제시된다', () => {
    const result = resolvePath(claudeWriter, ALL_FREE, providerData);
    expect(result.locked).toBe(true);
    expect(result.lockReason).toContain('Pro 이상');
    expect(result.path).toBe(4);
    expect(result.alternative).toMatchObject({ engine: 'codex-cli', path: 3, kind: 'fallback' });
    expect(result.alternative?.reason).toContain('Codex');
  });

  it('Codex 카드는 ③ 무료 한도로 돌고, 한도·데스크톱 앱 주의가 붙는다', () => {
    const result = resolvePath(codexReviewer, ALL_FREE, providerData);
    expect(result).toMatchObject({ locked: false, path: 3, engine: 'codex-cli' });
    expect(result.notes.join(' ')).toContain('데스크톱 앱');
    expect(result.notes.join(' ')).toContain('한도');
  });

  it('레시피 요약이 무료 한도와 대안 사용을 알려 준다', () => {
    const result = resolveRecipe(crossReview, ALL_FREE, providerData);
    expect(result.counts).toEqual({ 1: 0, 2: 0, 3: 2, 4: 0 });
    expect(result.fallbackCount).toBe(1);
    expect(result.summary).toBe('2개 모두 무료 한도로 실행돼요 (1개는 대안 도구로 바꿔서)');
    // 작성자도 검토자도 결국 Codex → 교차 검토가 안 된다
    expect(result.crossReview).toBe('same-provider');
  });
});

describe('사용자 유형 2: ChatGPT Plus만', () => {
  it('Codex 카드는 ①', () => {
    expect(resolvePath(codexReviewer, PLUS_ONLY, providerData)).toMatchObject({
      locked: false,
      path: 1,
      engine: 'codex-cli',
    });
  });

  it('Claude 카드는 🔒이고 Codex 구독이 대안으로 제시된다', () => {
    const result = resolvePath(claudeWriter, PLUS_ONLY, providerData);
    expect(result.locked).toBe(true);
    expect(result.alternative).toMatchObject({ engine: 'codex-cli', path: 1, kind: 'fallback' });
  });

  it('레시피 전체가 구독으로 실행된다', () => {
    const result = resolveRecipe(crossReview, PLUS_ONLY, providerData);
    expect(result.summary).toBe('2개 모두 구독으로 실행돼요 (1개는 대안 도구로 바꿔서)');
  });
});

describe('사용자 유형 3: Claude Pro만 (ChatGPT는 무료 계정)', () => {
  it('Claude 카드는 ①', () => {
    expect(resolvePath(claudeWriter, CLAUDE_PRO_ONLY, providerData)).toMatchObject({
      locked: false,
      path: 1,
      engine: 'claude-code',
    });
  });

  it('Codex 검토자는 무료 한도(③)로 교차 검토한다', () => {
    const result = resolveRecipe(crossReview, CLAUDE_PRO_ONLY, providerData);
    expect(result.perCard[codexReviewer.id]).toMatchObject({ locked: false, path: 3 });
    expect(result.crossReview).toBe('ok');
    expect(result.summary).toBe('2개 중 1개는 구독으로, 1개는 무료 한도로 실행돼요');
  });

  it('검토자까지 Claude로 짠 팀이면 교차 검토용으로 Codex 무료 한도를 권한다', () => {
    const recipe: Recipe = {
      ...crossReview,
      cards: [claudeWriter, { ...codexReviewer, preferredEngine: 'claude-code' }],
    };
    const result = resolveRecipe(recipe, CLAUDE_PRO_ONLY, providerData);
    const reviewer = result.perCard[codexReviewer.id];
    expect(reviewer).toMatchObject({ locked: false, path: 1, engine: 'claude-code' });
    expect(reviewer.alternative).toMatchObject({ engine: 'codex-cli', path: 3, kind: 'suggestion' });
    expect(reviewer.alternative?.reason).toContain('교차 검토');
    expect(result.crossReview).toBe('same-provider');
  });
});

describe('사용자 유형 4: 둘 다 유료', () => {
  it('모든 카드가 ①이고 작성자와 검토자가 다른 제공사다', () => {
    const result = resolveRecipe(crossReview, BOTH_PAID, providerData);
    for (const resolution of Object.values(result.perCard)) {
      expect(resolution).toMatchObject({ locked: false, path: 1 });
      expect(resolution.alternative).toBeUndefined();
    }
    const writerProvider = providerData.engines[result.perCard[claudeWriter.id].engine].provider;
    const reviewerProvider = providerData.engines[result.perCard[codexReviewer.id].engine].provider;
    expect(writerProvider).toBe('anthropic');
    expect(reviewerProvider).toBe('openai');
    expect(result.crossReview).toBe('ok');
    expect(result.summary).toBe('2개 모두 구독으로 실행돼요');
  });

  it('Codex만 쓰는 레시피는 검토자를 Claude로 바꾸라고 권한다', () => {
    const result = resolveRecipe(planBuildReview, BOTH_PAID, providerData);
    const reviewer = result.perCard['pbr-reviewer'];
    expect(reviewer.locked).toBe(false);
    expect(reviewer.alternative).toMatchObject({ engine: 'claude-code', path: 1, kind: 'suggestion' });
    expect(result.crossReview).toBe('same-provider');
  });
});

describe('경로 사다리의 세부 규칙', () => {
  it('구독이 없어도 API 키가 있으면 ②', () => {
    const result = resolvePath(
      claudeWriter,
      plans({ anthropic: 'free', apiKeys: { anthropic: true } }),
      providerData,
    );
    expect(result).toMatchObject({ locked: false, path: 2, engine: 'claude-code' });
  });

  it('구독과 API 키가 둘 다 있으면 구독(①)이 먼저', () => {
    const rule = bestAccess('codex-cli', plans({ openai: 'plus', apiKeys: { openai: true } }), providerData);
    expect(rule?.path).toBe(1);
  });

  it('ChatGPT Go는 터미널이 아닌 데스크톱 앱 경로(③)다', () => {
    expect(bestAccess('codex-cli', plans({ openai: 'go' }), providerData)?.path).toBe(3);
  });

  it('아무것도 없으면 ④ 수동이고, 무료 가입 안내를 준다', () => {
    const result = resolvePath(codexReviewer, plans(), providerData);
    expect(result).toMatchObject({ locked: true, path: 4, engine: 'manual' });
    expect(result.alternative).toBeUndefined();
    expect(result.notes.join(' ')).toContain('무료 계정을 만들면');
  });

  it('무거운 역할이 무료 한도에 걸리면 유료 구독 쪽을 권한다 (구독 최적화)', () => {
    const writerOnCodex = card({ tags: ['implementer'], preferredEngine: 'codex-cli' });
    const result = resolvePath(writerOnCodex, CLAUDE_PRO_ONLY, providerData);
    expect(result).toMatchObject({ locked: false, path: 3 });
    expect(result.alternative).toMatchObject({ engine: 'claude-code', path: 1, kind: 'suggestion' });
    expect(result.alternative?.reason).toContain('무거운 역할');
  });

  it('가벼운 역할이 무료 한도에 있으면 그대로 둔다', () => {
    const researcher = card({ tags: ['researcher'], preferredEngine: 'codex-cli' });
    expect(resolvePath(researcher, CLAUDE_PRO_ONLY, providerData).alternative).toBeUndefined();
  });

  it('막힌 검토자의 대안은 작성자와 다른 제공사를 먼저 고른다', () => {
    // 작성자는 Codex(구독), 검토자는 Grok Build(막힘) → 대안은 Codex가 아니라 Claude
    const reviewer = card({ tags: ['reviewer'], preferredEngine: 'grok-build' });
    const result = resolvePath(reviewer, BOTH_PAID, providerData, { writerProviders: ['openai'] });
    expect(result.locked).toBe(true);
    expect(result.alternative).toMatchObject({ engine: 'claude-code', kind: 'fallback' });
    expect(result.alternative?.reason).toContain('교차 검토');
  });

  it('요금제를 공식 문서로 확인하지 못한 도구는 쓸 수 있되, 안내를 붙이고 뒤로 미룬다', () => {
    const grokOnly = plans({ xai: 'supergrok' });
    const fallback = resolvePath(claudeWriter, grokOnly, providerData);
    expect(fallback.alternative).toMatchObject({ engine: 'grok-build', path: 1, kind: 'fallback' });
    expect(fallback.notes.join(' ')).toContain('공식 문서로 확인하지 못했어요');

    const grokCard = card({ preferredEngine: 'grok-build' });
    const result = resolvePath(grokCard, grokOnly, providerData);
    expect(result).toMatchObject({ locked: false, path: 1 });
    expect(result.notes.join(' ')).toContain('공식 문서로 확인하지 못했어요');

    // 같은 경로라면 공식 확인된 도구(Codex)가 Grok보다 먼저
    const both = plans({ openai: 'plus', xai: 'supergrok' });
    expect(resolvePath(claudeWriter, both, providerData).alternative?.engine).toBe('codex-cli');
  });

  it('수동을 고른 카드는 잠기지 않은 ④', () => {
    const result = resolvePath(card({ preferredEngine: 'manual' }), BOTH_PAID, providerData);
    expect(result).toMatchObject({ locked: false, path: 4, engine: 'manual' });
  });

  it('effectiveRoute는 막힌 카드에 대안의 엔진과 경로를 돌려준다', () => {
    const result = resolvePath(claudeWriter, ALL_FREE, providerData);
    expect(effectiveRoute(result)).toEqual({ engine: 'codex-cli', path: 3 });
  });

  it('카드가 없는 레시피도 처리한다', () => {
    const empty: Recipe = { ...crossReview, cards: [], handoffs: [] };
    expect(resolveRecipe(empty, BOTH_PAID, providerData).summary).toBe('아직 카드가 없어요.');
  });
});

describe('필요한 플랜 배지 (기본 레시피 3종)', () => {
  it("'Claude 작성 + Codex 교차 검토' → 'Claude Pro 필요', 'ChatGPT 무료'", () => {
    const result = requiredPlans(crossReview, providerData);
    expect(result.badges).toEqual(['Claude Pro 필요', 'ChatGPT 무료']);
    expect(result.allFree).toBe(false);
  });

  it("'기획 → 구현 → 검토 (Codex만)' → 'ChatGPT 무료로 가능' + 한도 주의", () => {
    const result = requiredPlans(planBuildReview, providerData);
    expect(result.badges).toEqual(['ChatGPT 무료로 가능']);
    expect(result.allFree).toBe(true);
    expect(result.details[0].notes.join(' ')).toContain('한도');
  });

  it("'조사원 여러 명 + 정리원' (Claude 구성) → 'Claude Pro 필요'", () => {
    const result = requiredPlans(researchTeam, providerData);
    expect(result.badges).toEqual(['Claude Pro 필요']);
    expect(result.allFree).toBe(false);
  });
});

describe('fitsMyPlans (갤러리 필터)', () => {
  it('전부 무료 사용자', () => {
    expect(fitsMyPlans(planBuildReview, ALL_FREE, providerData)).toBe('full');
    expect(fitsMyPlans(crossReview, ALL_FREE, providerData)).toBe('with-alternatives');
    expect(fitsMyPlans(researchTeam, ALL_FREE, providerData)).toBe('with-alternatives');
  });

  it('둘 다 유료 사용자는 전부 그대로 가능', () => {
    for (const recipe of builtinRecipes) {
      expect(fitsMyPlans(recipe, BOTH_PAID, providerData)).toBe('full');
    }
  });

  it('Claude만 있고 ChatGPT 계정이 없는 사용자', () => {
    const claudeOnly = plans({ anthropic: 'pro' });
    expect(fitsMyPlans(researchTeam, claudeOnly, providerData)).toBe('full');
    expect(fitsMyPlans(crossReview, claudeOnly, providerData)).toBe('with-alternatives');
    expect(fitsMyPlans(planBuildReview, claudeOnly, providerData)).toBe('with-alternatives');
  });

  it('아무 계정도 없으면 토론형(프롬프트만 쓰는 조리법)을 빼고 모두 불가', () => {
    for (const recipe of builtinRecipes) {
      const expected = recipe.collaboration === 'debate' ? 'full' : 'no';
      expect(fitsMyPlans(recipe, plans(), providerData)).toBe(expected);
    }
  });
});

describe('providers.json 데이터 점검', () => {
  it('모든 제공사와 엔진에 확인 날짜가 있고, 쓸 수 있는 엔진에는 출처 URL이 있다', () => {
    for (const provider of Object.values(providerData.providers)) {
      expect(provider.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(provider.sourceUrl).toMatch(/^https:\/\//);
    }
    for (const engine of Object.values(providerData.engines)) {
      expect(engine.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (engine.status !== 'builtin') expect(engine.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it('엔진의 플랜 id는 그 제공사의 플랜 목록에 있는 것만 쓴다', () => {
    for (const engine of Object.values(providerData.engines)) {
      if (!engine.provider) continue;
      const known = providerData.providers[engine.provider].plans.map((plan) => plan.id);
      for (const rule of engine.access) {
        for (const plan of rule.plans ?? []) expect(known).toContain(plan);
      }
    }
  });
});
