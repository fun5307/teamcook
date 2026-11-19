// 첫 화면의 '주문서': 하고 싶은 작업을 적으면 레시피를 권한다. 쓰는 AI와 사용량 여유도 여기서 함께 본다. 결과는 차림표처럼 보여 준다.
// AI가 고르는 게 아니라 낱말·내 플랜·사용량 여유로 고른다. 그래서 고른 이유를 항상 함께 보여 준다.

import { useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EngineLogo } from '@/components/BrandLogo';
import { FitLabel, engineName } from '@/components/RouteInfo';
import { COLLABORATIONS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { builtinRecipes } from '@/data/recipes';
import { BUDGETS, BUDGET_HINTS, BUDGET_LABELS, USAGE_LABELS, budgetNote, costOutlook, type Budget, type UsageLevel } from '@/lib/cost';
import { PATH_NAMES, effectiveRoute, resolveRecipe } from '@/lib/resolvePath';
import { suggestRecipes, type Suggestion } from '@/lib/suggest';
import { plansSummary } from '@/lib/plansSummary';
import { useStore } from '@/store/useStore';
import type { EngineId, PathLevel, Recipe, UserPlans } from '@/types';

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
  // 차림표를 접어도 머리줄은 남겨, 다시 펼칠 수 있게 한다
  const [open, setOpen] = useState(true);
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
          className="ticket flex flex-col gap-5 px-6 pt-8 pb-9"
          onSubmit={(event) => {
            event.preventDefault();
            setAsked(text.trim());
            setOpen(true);
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
                  setOpen(true);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      </div>

      {asked ? (
        <SuggestResults asked={asked} results={results} plans={plans} budget={budget} open={open} onToggle={() => setOpen(!open)} hrefOf={hrefOf} />
      ) : null}
    </div>
  );
}

/** 레시피의 재료(에이전트)가 내 플랜에서 어느 회사 AI로, 어떤 경로로 도는지 */
function TeamStrip({ recipe, plans }: { recipe: Recipe; plans: UserPlans }) {
  const resolution = resolveRecipe(recipe, plans, providerData);
  const style = collaborationOf(recipe);
  const members = recipe.cards.map((card) => {
    const resolved = resolution.perCard[card.id];
    const route = resolved ? effectiveRoute(resolved) : { engine: 'manual' as EngineId, path: 4 as PathLevel };
    return { card, ...route };
  });
  // 회사별로 몇 명인지
  const tally = new Map<string, { engine: EngineId; count: number; label: string }>();
  for (const member of members) {
    const provider = providerData.engines[member.engine]?.provider;
    const key = provider ?? member.engine;
    const label = provider ? providerData.providers[provider].productName : engineName(member.engine);
    const entry = tally.get(key) ?? { engine: member.engine, count: 0, label };
    entry.count += 1;
    tally.set(key, entry);
  }
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-heading text-base font-extrabold">에이전트 {recipe.cards.length}명</span>
        {[...tally.values()].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <EngineLogo engine={item.engine} className="text-foreground" />
            {item.label} {item.count}
          </span>
        ))}
        {style === 'debate' ? <span className="text-xs text-muted-foreground">(한 AI가 역할을 번갈아 맡아요)</span> : null}
      </p>
      <ol className="flex flex-wrap items-stretch gap-1.5" aria-label="재료 구성">
        {members.map((member, index) => (
          <li key={member.card.id} className="flex items-center gap-1.5">
            <span
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-lg border-2 bg-card px-2.5 py-1.5',
                member.path === 4 ? 'border-dashed border-input' : 'border-foreground',
              )}
              title={engineName(member.engine) + ' · ' + PATH_NAMES[member.path]}
            >
              <EngineLogo engine={member.engine} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium">{member.card.displayName || member.card.name}</span>
                <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                  {engineName(member.engine)} · {PATH_SHORT[member.path]}
                </span>
              </span>
            </span>
            {index < members.length - 1 && style !== 'agent-team' ? <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        내 플랜으로 돌리면 → <span className="font-medium text-foreground">{resolution.summary}</span>
      </p>
    </div>
  );
}

const PATH_SHORT: Record<PathLevel, string> = { 1: '구독', 2: 'API 키', 3: '무료 한도', 4: '복사·붙여넣기' };

function SuggestResults({
  asked,
  results,
  plans,
  budget,
  open,
  onToggle,
  hrefOf,
}: {
  asked: string;
  results: Suggestion[];
  plans: UserPlans;
  budget: Budget;
  open: boolean;
  onToggle: () => void;
  hrefOf: (recipe: Recipe) => string;
}) {
  return (
    <section className="flex flex-col gap-4" aria-label="추천 결과">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-foreground pb-2">
        <h2 className="text-2xl font-extrabold">
          "{asked}"에 권하는 차림 <span className="font-sans text-base font-normal text-muted-foreground">{results.length}가지</span>
        </h2>
        <button
          type="button"
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
          onClick={onToggle}
        >
          {open ? '접기' : '펼치기'}
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </div>
      {!open ? null : results.length === 0 ? (
        <p className="py-2 text-base" role="status">
          맞는 레시피를 찾지 못했어요. 낱말을 바꿔 적거나,{' '}
          <a className="underline underline-offset-4 hover:text-primary" href="#/recipes">
            레시피 책
          </a>
          에서 상황별로 골라 보세요.
        </p>
      ) : (
        <>
          <ol className="grid gap-4" role="status">
            {results.map((item, index) => (
              <li key={item.recipe.id}>
                <article className="flex flex-col gap-4 rounded-2xl border-2 border-foreground bg-card p-5 sm:flex-row sm:gap-5">
                  <span className="font-heading text-4xl leading-none font-extrabold text-primary tabular-nums">{index + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="flex min-w-0 flex-col gap-1">
                        <a href={hrefOf(item.recipe)} className="font-heading text-xl font-extrabold hover:text-primary">
                          {item.recipe.title}
                        </a>
                        <span className="text-sm text-muted-foreground">{COLLABORATIONS[collaborationOf(item.recipe)].label}</span>
                      </div>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <UsageMeter level={item.cost.usage.level} />
                        <FitLabel fit={item.fit} />
                      </span>
                    </div>
                    <TeamStrip recipe={item.recipe} plans={plans} />
                    {(() => {
                      const note = budgetNote(budget, item.cost.usage.level, item.cost.metered);
                      return (
                        <p
                          className={cn(
                            'text-xs',
                            note.good === true ? 'font-medium text-emerald-700' : note.good === false ? 'font-medium text-primary' : 'text-muted-foreground',
                          )}
                        >
                          사용량 여유 · {note.text}
                        </p>
                      );
                    })()}
                    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-input pt-3">
                      <p className="max-w-xl text-sm text-pretty">
                        <span className="text-xs font-bold text-primary">고른 이유 </span>
                        {item.reasons.join(', ')}.
                      </p>
                      <a
                        href={hrefOf(item.recipe)}
                        className="inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap underline underline-offset-4 hover:text-primary"
                      >
                        레시피 보기 <ArrowRight className="size-3.5" aria-hidden />
                      </a>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            AI가 고른 게 아니라, 적은 낱말과 내 AI 현황, 사용량 여유({BUDGET_LABELS[budget]})로 고른 결과예요. 사용량 여유는 순서를 조금 바꾸는 정도로만 쓰여요. 사용량은 어림이에요.
          </p>
        </>
      )}
    </section>
  );
}
