// '내 AI 현황' 화면: 제공사별 플랜 선택 + API 키 보유 여부.
// API 키 "값"은 입력받지 않는다. 가지고 있는지만 체크한다.

import { ExternalLink, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Notice, PageHeader } from '@/components/common';
import { LockBadge, PathBadge } from '@/components/RouteInfo';
import { providerData } from '@/data/providers';
import { BUDGETS, BUDGET_HINTS, BUDGET_LABELS } from '@/lib/cost';
import { bestAccess } from '@/lib/resolvePath';
import { useStore } from '@/store/useStore';
import type { EngineId, ProviderId, UserPlans } from '@/types';

const PROVIDER_IDS = Object.keys(providerData.providers) as ProviderId[];

function enginesOf(provider: ProviderId): EngineId[] {
  return (Object.keys(providerData.engines) as EngineId[]).filter(
    (id) => providerData.engines[id].provider === provider,
  );
}

export function MyPlansPage() {
  const plans = useStore((state) => state.plans);
  const setPlan = useStore((state) => state.setPlan);
  const setApiKey = useStore((state) => state.setApiKey);
  const budget = useStore((state) => state.budget);
  const setBudget = useStore((state) => state.setBudget);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="내 AI 현황"
        description="지금 쓰고 있는 요금제를 골라 주세요. 레시피마다 내가 쓸 수 있는 실행 경로를 계산하는 데 씁니다."
      />

      <Notice tone="success" className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong>API 키 값은 입력받지 않아요.</strong> 가지고 있는지만 체크하면 됩니다. 이 정보는 내 브라우저에만
          저장되고 어디로도 전송되지 않아요.
        </span>
      </Notice>

      <div className="grid gap-4 lg:grid-cols-2">
        {PROVIDER_IDS.map((id) => {
          const provider = providerData.providers[id];
          const hasKey = plans.apiKeys[id] === true;
          return (
            <section key={id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">
                  {provider.productName}{' '}
                  <span className="text-sm font-normal text-muted-foreground">({provider.name})</span>
                </h2>
                <a
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  href={provider.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {provider.lastVerified} 확인 <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>

              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${provider.productName} 요금제`}>
                {provider.plans.map((plan) => {
                  const selected = plans[id] === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPlan(id, plan.id as UserPlans[typeof id])}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        selected
                          ? 'border-foreground bg-foreground text-background'
                          : 'bg-card hover:bg-muted',
                      )}
                    >
                      {plan.label}
                      {plan.price ? <span className="ml-1 text-xs opacity-80">{plan.price}</span> : null}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-start gap-3 text-sm">
                <Switch
                  checked={hasKey}
                  onCheckedChange={(checked) => setApiKey(id, checked)}
                  aria-label={`${provider.name} API 키 보유`}
                />
                <span>
                  <span className="font-medium">{provider.name} API 키가 있어요</span>
                  <span className="block text-xs text-muted-foreground">{provider.apiNote}</span>
                </span>
              </label>

              <div className="flex flex-col gap-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">이 설정으로 쓸 수 있는 것</p>
                {enginesOf(id).map((engineId) => {
                  const engine = providerData.engines[engineId];
                  const rule = bestAccess(engineId, plans, providerData);
                  return (
                    <div key={engineId} className="flex flex-col gap-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{engine.name}</span>
                        {rule ? <PathBadge path={rule.path} /> : <LockBadge />}
                        {engine.status === 'preparing' ? (
                          <span className="text-xs text-muted-foreground">설정 파일 내보내기 준비 중</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{rule ? rule.label : engine.lockReason}</p>
                      {rule && rule.notes.length > 0 ? (
                        <ul className="list-disc pl-5 text-xs text-muted-foreground">
                          {rule.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      ) : null}
                      {engine.confidence === 'third-party' ? (
                        <p className="text-xs text-amber-700">
                          ⚠️ 공식 문서가 아닌 자료로만 확인한 정보예요. 실제와 다를 수 있어요.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold">사용량 여유</h2>
        <p className="text-sm text-muted-foreground">
          역할을 나눌수록 토큰(재료비)이 더 들어요. 첫 화면에서 레시피를 권할 때 이 설정을 함께 따집니다.{' '}
          <a className="underline underline-offset-2 hover:text-primary" href="#/learn">
            재료비가 뭔가요?
          </a>
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="사용량 여유">
          {BUDGETS.map((item) => (
            <label
              key={item}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                budget === item ? 'border-foreground' : 'hover:bg-muted',
              )}
            >
              <input type="radio" name="budget" className="mt-1" checked={budget === item} onChange={() => setBudget(item)} />
              <span>
                <span className="font-medium">{BUDGET_LABELS[item]}</span>
                <span className="block text-sm text-muted-foreground">{BUDGET_HINTS[item]}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 text-sm">
        <h2 className="text-base font-semibold">실행 경로 사다리란?</h2>
        <p className="text-muted-foreground">
          카드마다 아래 순서로, 위에서부터 내가 쓸 수 있는 경로를 찾아요.
        </p>
        <ul className="flex flex-col gap-1.5">
          <li className="flex flex-wrap items-center gap-2">
            <PathBadge path={1} /> 구독 계정으로 로그인한 Codex·Claude Code. 유료 사용자의 기본 경로.
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <PathBadge path={2} /> API 키로 쓴 만큼 결제.
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <PathBadge path={3} /> 무료 계정의 작은 한도.
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <PathBadge path={4} /> 무료 웹 채팅에 직접 복사·붙여넣기. 다른 경로가 전혀 없을 때만.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          요금제와 무료 범위는 자주 바뀌어요. 여기 정보는 {providerData.lastVerified}에 확인한 것이니, 결제 전에는
          각 회사의 공식 페이지를 꼭 확인하세요.
        </p>
      </section>
    </div>
  );
}
