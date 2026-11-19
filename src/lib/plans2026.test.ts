// 2026-11-18에 공식 안내로 다시 확인한 Gemini·Grok 요금제와, 옛 저장값 옮기기
import { describe, expect, it } from 'vitest';
import { providerData } from '../data/providers';
import { migratePlans } from '../store/useStore';
import type { UserPlans } from '../types';
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
