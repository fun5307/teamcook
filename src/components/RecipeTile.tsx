// 레시피 카드 한 장: 고르는 데 필요한 것만 (제목, 설명, 필요한 플랜, 내 플랜으로 되는지).
// 레시피 책은 누르면 상세 화면으로 가는 링크(href)로, 팀원 들이기는 누르면 고르는 버튼(onSelect)으로 같은 카드를 쓴다.

import { cn } from '@/lib/utils';
import { FitLabel, STYLE_COLORS, engineName } from '@/components/RouteInfo';
import { COLLABORATIONS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { fitsMyPlans, requiredPlans } from '@/lib/requiredPlans';
import type { EngineId, Recipe, UserPlans } from '@/types';

type Props = {
  recipe: Recipe;
  plans: UserPlans;
} & ({ href: string; onSelect?: undefined; selected?: undefined } | { href?: undefined; onSelect: () => void; selected: boolean });

const CARD_CLASS =
  'recipe-card group flex w-full flex-col gap-4 rounded-xl border bg-card p-5 text-left focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none';

export function RecipeTile({ recipe, plans, href, onSelect, selected }: Props) {
  const required = requiredPlans(recipe, providerData);
  const fit = fitsMyPlans(recipe, plans, providerData);
  const style = collaborationOf(recipe);
  const info = COLLABORATIONS[style];
  const engines: EngineId[] = [];
  for (const card of recipe.cards) {
    const engine = style === 'agent-team' ? 'claude-code' : card.preferredEngine;
    if (!engines.includes(engine)) engines.push(engine);
  }
  const where = style === 'debate' ? '프롬프트만' : engines.map(engineName).join(' + ') || '카드 없음';
  const servings = style === 'debate' ? `${recipe.cards.length}역할` : `${recipe.cards.length}인분`;

  const body = (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
        <span aria-hidden className="size-2 rounded-full" style={{ background: STYLE_COLORS[style] }} />
        <span>{info.label}</span>
        {recipe.cards.length > 0 ? <span>{servings}</span> : null}
        {info.experimental ? <span className="text-primary">실험 기능</span> : null}
      </p>
      <div className="flex flex-col gap-2">
        <h3 className="text-[1.4rem] leading-snug font-extrabold text-balance transition-colors duration-200 group-hover:text-primary">
          {recipe.title}
        </h3>
        <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">
          {recipe.summary || recipe.learningObjective || '설명이 아직 없어요.'}
        </p>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-bold text-primary">재료</h4>
        {required.details.length > 0 ? (
          <ul className="text-sm">
            {required.details.map((badge) => (
              <li key={badge.engine} className="flex justify-between gap-3 border-b border-dashed py-1.5">
                <span>{badge.text}</span>
                <span className="shrink-0 text-muted-foreground">
                  {badge.engine === 'manual' ? '프롬프트만' : engineName(badge.engine)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">카드를 추가하면 계산돼요.</p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <FitLabel fit={fit} />
        <span className="text-xs text-muted-foreground">{where}</span>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(CARD_CLASS, 'cursor-pointer', selected && 'border-foreground ring-2 ring-primary/50')}
      >
        {body}
      </button>
    );
  }
  return (
    <a href={href} className={CARD_CLASS}>
      {body}
    </a>
  );
}
