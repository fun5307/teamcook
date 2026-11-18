// 내 AI 현황을 한 줄로 (예: "Claude Pro · ChatGPT Plus"). 첫 화면 추천과 레시피 책이 함께 쓴다.
import { providerData } from '../data/providers';
import type { ProviderId, UserPlans } from '../types';

export function plansSummary(plans: UserPlans): string {
  const parts: string[] = [];
  for (const id of Object.keys(providerData.providers) as ProviderId[]) {
    const provider = providerData.providers[id];
    const plan = provider.plans.find((item) => item.id === plans[id]);
    if (plan && plan.id !== 'none') parts.push(`${provider.productName} ${plan.label}`);
    if (plans.apiKeys[id]) parts.push(`${provider.name} API 키`);
  }
  return parts.length > 0 ? parts.join(' · ') : '쓰는 AI가 없어요';
}
