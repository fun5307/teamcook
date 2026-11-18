// 첫 화면의 '주문서': 하고 싶은 작업을 적으면 레시피를 권한다. 쓰는 AI와 사용량 여유도 여기서 함께 본다. 결과는 차림표처럼 보여 준다.
// AI가 고르는 게 아니라 낱말·내 플랜·사용량 여유로 고른다. 그래서 고른 이유를 항상 함께 보여 준다.

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FitLabel } from '@/components/RouteInfo';
import { COLLABORATIONS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { builtinRecipes } from '@/data/recipes';
import { BUDGETS, BUDGET_HINTS, BUDGET_LABELS, USAGE_LABELS, costOutlook, type UsageLevel } from '@/lib/cost';
import { suggestRecipes, type Suggestion } from '@/lib/suggest';
import { plansSummary } from '@/lib/plansSummary';
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

const EXAMPLES = ['로그인 버그 원인 찾기', '새 기능 만들고 검토받기', '시장 조사 보고서 쓰기', '두 설계안 중에 고르기'];

/**
 * 첫 화면 머리: 왼쪽에 소개(children), 오른쪽에 주문서. 주문을 넣으면 아래에 차림표가 펼쳐진다.
 */
export function SuggestBox({ myRecipes, children }: { myRecipes: Recipe[]; children: ReactNode }) {
  const plans = useStore((state) => state.plans);
  const plansConfirmed = useStore((state) => state.plansConfirmed);
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
    <div className="flex flex-col gap-10">
      <div className="grid items-start gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex flex-col gap-5">{children}</div>

        <form
          aria-label="레시피 제안"
          className="ticket flex flex-col gap-5 px-6 pt-8 pb-9 lg:rotate-[1.2deg]"
          onSubmit={(event) => {
            event.preventDefault();
            setAsked(text.trim());
          }}
        >
          <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2">
            <span className="font-heading text-2xl font-extrabold">주문서</span>
            <span className="text-xs text-muted-foreground">레시피 {builtinRecipes.length + myRecipes.length}가지 중에서</span>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="suggest-input" className="text-sm text-muted-foreground">
              오늘 하고 싶은 작업
            </label>
            <input
              id="suggest-input"
              className="ticket-line"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={EXAMPLES[0]}
              autoComplete="off"
            />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm text-muted-foreground">사용량 여유</legend>
            <div className="grid grid-cols-3 border-2 border-foreground" role="radiogroup" aria-label="사용량 여유">
              {BUDGETS.map((item) => (
                <label
                  key={item}
                  className={cn(
                    'cursor-pointer border-foreground px-1 py-2 text-center text-sm transition-colors not-first:border-l-2 has-focus-visible:ring-3 has-focus-visible:ring-ring/40',
                    budget === item ? 'bg-foreground font-medium text-background' : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="suggest-budget"
                    className="sr-only"
                    checked={budget === item}
                    onChange={() => setBudget(item)}
                  />
                  {BUDGET_LABELS[item]}
                </label>
              ))}
            </div>
            <p className="text-xs text-pretty text-muted-foreground">{BUDGET_HINTS[budget]}</p>
          </fieldset>

          <p className="-mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
            <span className="text-muted-foreground">쓰는 AI</span>
            <a className="underline underline-offset-4 hover:text-primary" href="#/plans" title="바꾸면 추천이 달라져요">
              {plansSummary(plans)}
              {plansConfirmed ? '' : ' (가정)'}
            </a>
          </p>

          <Button type="submit" size="lg" className="h-11 text-base" disabled={!text.trim()}>
            레시피 추천받기
          </Button>

          <div className="flex flex-col gap-1 border-t border-dashed border-input pt-3 text-sm">
            <span className="text-xs text-muted-foreground">자주 들어오는 주문</span>
            {EXAMPLES.slice(1).map((example) => (
              <button
                key={example}
                type="button"
                className="w-fit text-left underline decoration-input underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                onClick={() => {
                  setText(example);
                  setAsked(example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      </div>

      {asked ? (
        <section className="flex flex-col gap-3" role="status" aria-label="추천 결과">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-foreground pb-2">
            <h2 className="text-2xl font-extrabold">"{asked}"에 권하는 차림</h2>
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary" onClick={() => setAsked('')}>
              접기
            </button>
          </div>
          {results.length === 0 ? (
            <p className="py-2 text-base">
              맞는 레시피를 찾지 못했어요. 낱말을 바꿔 적거나,{' '}
              <a className="underline underline-offset-4 hover:text-primary" href="#/recipes">
                레시피 책
              </a>
              에서 상황별로 골라 보세요.
            </p>
          ) : (
            <>
              <ol className="flex flex-col">
                {results.map((item, index) => (
                  <li key={item.recipe.id} className="border-b border-dashed border-input">
                    <a href={hrefOf(item.recipe)} className="group flex gap-4 py-4 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                      <span className="w-7 shrink-0 font-heading text-3xl leading-none font-extrabold text-primary tabular-nums">{index + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-heading text-xl font-extrabold transition-colors group-hover:text-primary">
                            {item.recipe.title}
                          </span>
                          <span className="leader hidden sm:block" aria-hidden />
                          <span className="text-sm whitespace-nowrap text-muted-foreground">
                            {COLLABORATIONS[collaborationOf(item.recipe)].label}, 재료 {item.recipe.cards.length}가지
                          </span>
                        </span>
                        <span className="text-sm text-pretty text-muted-foreground">{item.reasons.join(', ')}.</span>
                        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <UsageMeter level={item.cost.usage.level} />
                          <FitLabel fit={item.fit} />
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                AI가 고른 게 아니라, 적은 낱말과 내 AI 현황, 사용량 여유로 고른 결과예요. 사용량은 어림이에요.
              </p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
