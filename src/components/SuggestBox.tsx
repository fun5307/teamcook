// 첫 화면의 "하고 싶은 작업을 말하면 레시피를 권하는" 상자와, 사용량 어림 표시.
// AI가 고르는 게 아니라 낱말·내 플랜·사용량 여유로 고른다. 그래서 고른 이유를 항상 함께 보여 준다.

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FitLabel } from '@/components/RouteInfo';
import { COLLABORATIONS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { builtinRecipes } from '@/data/recipes';
import { BUDGETS, BUDGET_HINTS, BUDGET_LABELS, USAGE_LABELS, costOutlook, type UsageLevel } from '@/lib/cost';
import { suggestRecipes, type Suggestion } from '@/lib/suggest';
import { useStore } from '@/store/useStore';
import type { Recipe, UserPlans } from '@/types';

const USAGE_DOTS: Record<UsageLevel, number> = { light: 1, medium: 2, heavy: 3 };

/** 사용량 어림 표시: 점 세 개 가운데 몇 개가 찼는지 + 글자 */
export function UsageMeter({ level }: { level: UsageLevel }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((dot) => (
          <span key={dot} className={cn('size-1.5 rounded-full', dot <= USAGE_DOTS[level] ? 'bg-foreground' : 'bg-border')} />
        ))}
      </span>
      사용량 {USAGE_LABELS[level]}
    </span>
  );
}

/** 레시피 상세 화면용: 사용량 어림과, 내 플랜에서 어디서 나가는지 */
export function UsageNote({ recipe, plans }: { recipe: Recipe; plans: UserPlans }) {
  const outlook = costOutlook(recipe, plans, providerData);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UsageMeter level={outlook.usage.level} />
        <span>{outlook.usage.reason}</span>
      </p>
      {outlook.lines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        조리법과 역할 수로 가늠한 어림이에요. 실제 토큰과 비용은 과제 크기에 따라 달라요.{' '}
        <a className="underline underline-offset-2 hover:text-primary" href="#/learn">
          왜 이렇게 다른가요?
        </a>
      </p>
    </div>
  );
}

const EXAMPLES = ['로그인 버그 원인을 찾고 싶어', '새 기능을 만들고 검토받고 싶어', '시장 조사 보고서를 쓰고 싶어', '두 설계안 중에 고르고 싶어'];

export function SuggestBox({ myRecipes }: { myRecipes: Recipe[] }) {
  const plans = useStore((state) => state.plans);
  const budget = useStore((state) => state.budget);
  const setBudget = useStore((state) => state.setBudget);
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const results: Suggestion[] = asked
    ? suggestRecipes(asked, [...myRecipes, ...builtinRecipes], plans, providerData, budget)
    : [];
  const hrefOf = (recipe: Recipe) =>
    myRecipes.includes(recipe) ? `#/edit/${encodeURIComponent(recipe.id)}` : `#/recipe/${encodeURIComponent(recipe.id)}`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6" aria-label="레시피 제안">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setAsked(text.trim());
        }}
      >
        <label htmlFor="suggest-input" className="font-heading text-xl font-extrabold sm:text-2xl">
          어떤 작업을 하고 싶으세요?
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="suggest-input"
            className="h-11 min-w-0 flex-1 basis-64 bg-background text-base"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`예: ${EXAMPLES[0]}`}
          />
          <Button type="submit" size="lg" disabled={!text.trim()}>
            <Sparkles aria-hidden />
            레시피 추천받기
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" role="group" aria-label="사용량 여유">
          <span className="text-sm text-muted-foreground">사용량 여유</span>
          {BUDGETS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={budget === item}
              onClick={() => setBudget(item)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                budget === item ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted',
              )}
            >
              {BUDGET_LABELS[item]}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">{BUDGET_HINTS[budget]}</span>
        </div>
      </form>

      {!asked ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          이렇게 적어 보세요:
          {EXAMPLES.slice(1).map((example) => (
            <button
              key={example}
              type="button"
              className="underline underline-offset-2 hover:text-primary"
              onClick={() => {
                setText(example);
                setAsked(example);
              }}
            >
              {example}
            </button>
          ))}
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm" role="status">
          맞는 레시피를 찾지 못했어요. 낱말을 바꿔 보거나, 아래 "무엇을 하려고 하나요?"에서 상황을 골라 보세요.
        </p>
      ) : (
        <div className="flex flex-col gap-2" role="status">
          <ol className="flex flex-col gap-2">
            {results.map((item, index) => (
              <li key={item.recipe.id}>
                <a
                  href={hrefOf(item.recipe)}
                  className="group flex flex-col gap-1.5 rounded-xl border bg-background px-4 py-3 transition-colors hover:border-foreground/40"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-heading text-lg font-extrabold group-hover:text-primary">
                      {index === 0 ? <span className="mr-2 text-xs font-bold text-primary">첫 번째 추천</span> : null}
                      {item.recipe.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-muted-foreground">
                        {COLLABORATIONS[collaborationOf(item.recipe)].label} · 재료 {item.recipe.cards.length}
                      </span>
                      <UsageMeter level={item.cost.usage.level} />
                      <FitLabel fit={item.fit} />
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{item.reasons.join(' · ')}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                    레시피 보기 <ArrowRight className="size-3" aria-hidden />
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            AI가 고른 게 아니라, 적은 낱말·내 AI 현황·사용량 여유로 고른 결과예요. 사용량은 어림이에요.
          </p>
        </div>
      )}
    </section>
  );
}
