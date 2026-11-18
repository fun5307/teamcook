// 레시피 제안과 사용량 어림 검사

import { describe, expect, it } from 'vitest';
import { collaborationOf } from '../data/collaboration';
import { providerData } from '../data/providers';
import { builtinRecipes } from '../data/recipes';
import type { UserPlans } from '../types';
import { costOutlook, usageEstimate } from './cost';
import { parseRoute } from './router';
import { suggestRecipes } from './suggest';

const FREE: UserPlans = { openai: 'free', anthropic: 'free', google: 'none', xai: 'none', apiKeys: {} };
const PAID: UserPlans = { openai: 'plus', anthropic: 'pro', google: 'none', xai: 'none', apiKeys: {} };
const API_ONLY: UserPlans = { openai: 'none', anthropic: 'none', google: 'none', xai: 'none', apiKeys: { anthropic: true, openai: true } };
const byId = (id: string) => builtinRecipes.find((recipe) => recipe.id === id)!;
const ids = (query: string, plans = PAID, budget: 'save' | 'normal' | 'plenty' = 'normal') =>
  suggestRecipes(query, builtinRecipes, plans, providerData, budget).map((item) => item.recipe.id);

describe('사용량 어림', () => {
  it('토론형은 가벼움, 에이전트 팀은 무거움, 서브에이전트는 역할 수에 따라 보통·무거움', () => {
    for (const recipe of builtinRecipes) {
      const { level } = usageEstimate(recipe);
      const style = collaborationOf(recipe);
      if (style === 'debate') expect(level).toBe('light');
      else if (style === 'agent-team') expect(level).toBe('heavy');
      else expect(level).toBe(recipe.cards.length >= 4 ? 'heavy' : 'medium');
    }
  });

  it('토큰 수나 금액을 숫자로 지어내지 않는다', () => {
    for (const recipe of builtinRecipes) {
      const outlook = costOutlook(recipe, PAID, providerData);
      const text = [outlook.usage.reason, ...outlook.lines].join(' ');
      expect(text).not.toMatch(/\d+\s*(토큰|원|달러|\$)/);
    }
  });

  it('내 여건에 따라 어디서 나가는지가 달라진다: 구독 한도, 쓴 만큼 결제, 무료 한도', () => {
    const recipe = byId('builtin-cross-review');
    const paid = costOutlook(recipe, PAID, providerData);
    expect(paid.subscription).toBe(recipe.cards.length);
    expect(paid.lines.join(' ')).toContain('구독 한도');
    const api = costOutlook(recipe, API_ONLY, providerData);
    expect(api.metered).toBe(recipe.cards.length);
    expect(api.lines.join(' ')).toContain('쓴 만큼 돈이 나가요');
    const debate = costOutlook(byId('builtin-decision-debate'), FREE, providerData);
    expect(debate.lines.join(' ')).toContain('무료 채팅으로도');
  });
});

describe('레시피 제안', () => {
  it('하고 싶은 작업의 낱말로 맞는 상황의 레시피를 고른다', () => {
    expect(ids('로그인 버그 원인을 찾고 싶어')[0]).toMatch(/bug-hunt|hypothesis-team/);
    expect(ids('코드 리뷰를 받고 싶어')).toContain('builtin-review-trio');
    expect(ids('GraphRAG 주제 타당성을 조사하고 싶어')[0]).toBe('builtin-graphrag-feasibility');
    expect(ids('블로그 글을 쓰고 싶어')).toContain('builtin-writing-desk');
  });

  it('고른 이유를 함께 돌려주고, 최대 3개만 권한다', () => {
    const results = suggestRecipes('버그를 고치고 싶어', builtinRecipes, PAID, providerData);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    for (const item of results) expect(item.reasons.length).toBeGreaterThan(0);
    expect(results[0].reasons.join(' ')).toContain('고치고 지키기');
  });

  it('맞는 낱말이 없거나 빈 말이면 아무것도 권하지 않는다 (억지로 채우지 않음)', () => {
    expect(ids('')).toEqual([]);
    expect(ids('하고 싶어')).toEqual([]);
    expect(ids('qwzx 뷁뷁')).toEqual([]);
  });

  it('아껴 쓰기에서는 같은 과제에서 무거운 에이전트 팀보다 가벼운 쪽을 먼저 권한다', () => {
    const normal = suggestRecipes('버그 원인을 찾고 싶어', builtinRecipes, PAID, providerData, 'normal', 10);
    const save = suggestRecipes('버그 원인을 찾고 싶어', builtinRecipes, PAID, providerData, 'save', 10);
    const rank = (list: typeof normal, id: string) => list.findIndex((item) => item.recipe.id === id);
    // 가설 경쟁 팀(에이전트 팀, 무거움)은 아껴 쓰기에서 순위가 내려간다
    expect(rank(save, 'builtin-hypothesis-team')).toBeGreaterThan(rank(normal, 'builtin-hypothesis-team'));
    expect(save.find((item) => item.recipe.id === 'builtin-hypothesis-team')!.reasons.join(' ')).toContain('무거워');
    expect(usageEstimate(save[0].recipe).level).not.toBe('heavy');
  });

  it('결정하기: 아껴 쓰기에서 토론형이 "사용량이 가벼워요"로 권해진다', () => {
    const [first] = suggestRecipes('두 설계안 중에 고르고 싶어', builtinRecipes, FREE, providerData, 'save');
    expect(collaborationOf(first.recipe)).toBe('debate');
    expect(first.reasons).toContain('사용량이 가벼워요');
    expect(first.fit).toBe('full');
  });

  it('API 키로만 쓰는 사람이 아껴 쓰기를 고르면 "쓴 만큼 돈이 나가요"를 알려 준다', () => {
    const results = suggestRecipes('새 기능을 만들고 검토받고 싶어', builtinRecipes, API_ONLY, providerData, 'save');
    expect(results.some((item) => item.reasons.includes('API 키로 쓴 만큼 돈이 나가요'))).toBe(true);
  });

  it('재료 사전 주소', () => {
    expect(parseRoute('#/learn')).toEqual({ page: 'learn' });
    // 첫 화면은 주문서, 전체 목록은 레시피 책
    expect(parseRoute('')).toEqual({ page: 'home' });
    expect(parseRoute('#/')).toEqual({ page: 'home' });
    expect(parseRoute('#/recipes')).toEqual({ page: 'gallery' });
  });
});
