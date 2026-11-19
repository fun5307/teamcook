// 2026-11-18에 공식 안내로 다시 확인한 Gemini·Grok 요금제와, 옛 저장값 옮기기
import { describe, expect, it } from 'vitest';
import { providerData } from '../data/providers';
import { migratePlans } from '../store/useStore';
import type { UserPlans } from '../types';
import { builtinRecipes as RECIPES } from '../data/recipes';
import { budgetNote, costOutlook, usageEstimate } from './cost';
import { suggestRecipes } from './suggest';
import { bestAccess } from './resolvePath';

const plans = (overrides: Partial<UserPlans> = {}): UserPlans => ({ openai: 'none', anthropic: 'none', google: 'none', xai: 'none', apiKeys: {}, ...overrides });

describe('Gemini (Google AI) 요금제와 Antigravity', () => {
  it('Plus·Pro·Ultra를 나눠 고를 수 있다', () => {
    expect(providerData.providers.google.plans.map((plan) => plan.id)).toEqual(['none', 'free', 'plus', 'pro', 'ultra', 'ultra20']);
  });
  it('Pro·Ultra는 구독 경로(5시간마다 충전), 무료·Plus는 기본 한도(일주일마다 충전)', () => {
    expect(bestAccess('antigravity-cli', plans({ google: 'pro' }), providerData)?.path).toBe(1);
    expect(bestAccess('antigravity-cli', plans({ google: 'ultra' }), providerData)?.path).toBe(1);
    expect(bestAccess('antigravity-cli', plans({ google: 'ultra20' }), providerData)?.path).toBe(1);
    expect(bestAccess('antigravity-cli', plans({ google: 'plus' }), providerData)?.path).toBe(3);
    expect(bestAccess('antigravity-cli', plans({ google: 'free' }), providerData)?.path).toBe(3);
    expect(bestAccess('antigravity-cli', plans(), providerData)).toBeNull();
  });
  it('Gemini API 키가 있으면 구독이 없어도 쓸 수 있고(경로 2), 구독이 있으면 구독이 먼저다', () => {
    expect(bestAccess('antigravity-cli', plans({ apiKeys: { google: true } }), providerData)?.path).toBe(2);
    expect(bestAccess('antigravity-cli', plans({ google: 'free', apiKeys: { google: true } }), providerData)?.path).toBe(2);
    expect(bestAccess('antigravity-cli', plans({ google: 'pro', apiKeys: { google: true } }), providerData)?.path).toBe(1);
  });
});

describe('구독에 들어 있는 API 크레딧', () => {
  const creditOf = (provider: 'openai' | 'anthropic' | 'google' | 'xai', id: string) =>
    providerData.providers[provider].plans.find((plan) => plan.id === id)?.apiCredit;
  it('ChatGPT Pro와 Google AI Pro·Ultra만 크레딧을 준다', () => {
    expect(creditOf('openai', 'pro')).toContain('$100');
    expect(creditOf('google', 'pro')).toContain('$10');
    expect(creditOf('google', 'ultra')).toContain('$40');
    expect(creditOf('google', 'ultra20')).toContain('$100');
  });
  it('나머지 요금제는 API 사용량이 없다', () => {
    for (const [provider, ids] of [
      ['openai', ['free', 'go', 'plus']],
      ['anthropic', ['free', 'pro', 'max', 'ultra']],
      ['google', ['free', 'plus']],
      ['xai', ['free', 'plus', 'premium', 'super', 'ultra', 'supergrok']],
    ] as const) {
      for (const id of ids) expect(creditOf(provider, id)).toBeUndefined();
    }
  });
});

describe('레시피 책: Gemini API 키로 도는 역할의 사용량 안내', () => {
  it('Antigravity를 Gemini API 키로 돌리면 무료 한도·월 크레딧 안내가 붙는다', () => {
    const base = RECIPES[0];
    const recipe = { ...base, cards: base.cards.map((card) => ({ ...card, preferredEngine: 'antigravity-cli' as const })) };
    const lines = costOutlook(recipe, plans({ apiKeys: { google: true } }), providerData).lines.join(' ');
    expect(lines).toContain('Gemini API 키');
    expect(costOutlook(recipe, plans({ google: 'pro' }), providerData).lines.join(' ')).not.toContain('Gemini API 키');
  });
});

describe('사용량 여유가 추천에 쓰이는 방식', () => {
  it('아껴 쓰기는 무거운 레시피의 점수를 깎고, 넉넉하게는 깎지 않는다', () => {
    const all = [...RECIPES];
    const score = (budget: 'save' | 'normal' | 'plenty', id: string) =>
      suggestRecipes('개발 코드 검토 조사 설계', all, plans({ openai: 'plus', anthropic: 'pro' }), providerData, budget, 50).find((s) => s.recipe.id === id)?.score;
    const heavy = all.find((recipe) => usageEstimate(recipe).level === 'heavy')!;
    expect(score('save', heavy.id)! < score('normal', heavy.id)!).toBe(true);
    expect(score('plenty', heavy.id)).toBe(score('normal', heavy.id));
  });
  it('추천 카드에 보일 한 줄이 여유마다 다르다', () => {
    expect(budgetNote('save', 'heavy', 0).good).toBe(false);
    expect(budgetNote('save', 'light', 0).good).toBe(true);
    expect(budgetNote('plenty', 'heavy', 0).text).toContain('따지지 않았어요');
    expect(budgetNote('normal', 'heavy', 0).text).toContain('보통 기준');
  });
});

describe('Grok (X 구독) 요금제와 Grok Build', () => {
  it('X 구독의 Plus·Premium·Super·Ultra와 예전 SuperGrok을 고를 수 있다', () => {
    expect(providerData.providers.xai.plans.map((plan) => plan.id)).toEqual(['none', 'free', 'plus', 'premium', 'super', 'ultra', 'supergrok']);
  });
  it('Grok Build는 무료부터 쓸 수 있고(무료 한도), 유료 요금제와 예전 SuperGrok은 구독 경로다', () => {
    for (const tier of ['plus', 'premium', 'super', 'ultra', 'supergrok'] as const) {
      expect(bestAccess('grok-build', plans({ xai: tier }), providerData)?.path).toBe(1);
    }
    expect(bestAccess('grok-build', plans({ xai: 'free' }), providerData)?.path).toBe(3);
    expect(bestAccess('grok-build', plans(), providerData)).toBeNull();
    expect(bestAccess('grok-build', plans({ apiKeys: { xai: true } }), providerData)?.path).toBe(2);
  });
});

describe('저장된 옛 요금제 옮기기', () => {
  it("Gemini '유료'는 Pro로, 모르는 값은 '안 써요'로", () => {
    const old = { ...plans(), google: 'paid', xai: 'heavy' } as unknown as UserPlans;
    expect(migratePlans(old)).toMatchObject({ google: 'pro', xai: 'none' });
    expect(migratePlans(plans({ xai: 'supergrok' })).xai).toBe('supergrok');
  });
});
