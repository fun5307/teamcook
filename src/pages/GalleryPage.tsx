// 레시피 책(#/recipes): 상황별 묶음으로 레시피를 본다. 하고 싶은 일로 권받는 것은 첫 화면(HomePage.tsx)이 한다.
// 검색과 조건(내 플랜, 조리법)은 접어 두고, 쓰면 상황 묶음 대신 결과 목록이 나온다.

import { useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, FilePlus2, FolderOpen, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/common';
import { Reveal } from '@/components/Reveal';
import { FitLabel, STYLE_COLORS, engineName } from '@/components/RouteInfo';
import { COLLABORATIONS, COLLABORATION_IDS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { SHELVES } from '@/data/moreRecipes';
import { builtinRecipes } from '@/data/recipes';
import { newId } from '@/lib/id';
import { importFile } from '@/lib/importFiles';
import { fitsMyPlans, requiredPlans } from '@/lib/requiredPlans';
import { navigate } from '@/lib/router';
import { plansSummary } from '@/lib/plansSummary';
import { useStore } from '@/store/useStore';
import type { AgentCard, Collaboration, EngineId, Recipe, UserPlans } from '@/types';

type Filter = 'all' | 'fits' | 'full';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'fits', label: '내 플랜으로 되는 것만' },
  { id: 'full', label: '바꾸지 않고 그대로 되는 것만' },
];

/** 조리법 필터에 맞는지 ('all'이면 모두) */
export function matchesStyle(recipe: Recipe, style: Collaboration | 'all'): boolean {
  return style === 'all' || collaborationOf(recipe) === style;
}

/** 제목·설명·쓰임새·조리법·카드 이름에 검색어가 들어 있는지 (띄어 쓴 단어는 모두 들어 있어야 함) */
export function matchesQuery(recipe: Recipe, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [
    recipe.title,
    recipe.summary,
    recipe.useCase,
    recipe.author ?? '',
    COLLABORATIONS[collaborationOf(recipe)].label,
    ...recipe.cards.flatMap((card) => [card.name, card.displayName, card.role]),
  ]
    .join(' ')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function blankRecipe(cards: AgentCard[] = [], title = '새 레시피'): Recipe {
  return {
    schemaVersion: 2,
    id: newId('recipe'),
    title,
    summary: '',
    useCase: '',
    cards,
    handoffs: [],
    settings: { maxThreads: 3, maxDepth: 1 },
  };
}

/** 내 AI 현황을 한 줄로 요약 */
export { plansSummary };

/** 레시피 카드 한 장: 고르는 데 필요한 것만 (제목, 설명, 필요한 플랜, 내 플랜으로 되는지). 나머지는 상세 화면에서 본다. */
function RecipeTile({ recipe, plans, href }: { recipe: Recipe; plans: UserPlans; href: string }) {
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


  return (
    <a
      href={href}
      className="recipe-card group flex w-full flex-col gap-4 rounded-xl border bg-card p-5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
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
    </a>
  );
}

export function GalleryPage() {
  const plans = useStore((state) => state.plans);
  const plansConfirmed = useStore((state) => state.plansConfirmed);
  const myRecipes = useStore((state) => state.recipes);
  const saveRecipe = useStore((state) => state.saveRecipe);
  const unreadable = useStore((state) => state.unreadable);

  const [filter, setFilter] = useState<Filter>('all');
  const [styleFilter, setStyleFilter] = useState<Collaboration | 'all'>('all');
  const [query, setQuery] = useState('');
  const [shelfId, setShelfId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [messages, setMessages] = useState<{ tone: 'success' | 'error'; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const matches = (recipe: Recipe) => {
    if (!matchesQuery(recipe, query) || !matchesStyle(recipe, styleFilter)) return false;
    if (filter === 'all') return true;
    const fit = fitsMyPlans(recipe, plans, providerData);
    return filter === 'fits' ? fit !== 'no' : fit === 'full';
  };
  // 검색어나 조건을 쓰는 중이면 상황 묶음 대신 결과 목록을 보여 준다
  const searching = query.trim() !== '' || filter !== 'all' || styleFilter !== 'all';
  const found = searching ? [...myRecipes, ...builtinRecipes].filter(matches) : [];
  const isMine = (recipe: Recipe) => myRecipes.includes(recipe);
  const hrefOf = (recipe: Recipe) =>
    isMine(recipe) ? `#/edit/${encodeURIComponent(recipe.id)}` : `#/recipe/${encodeURIComponent(recipe.id)}`;
  const byId = new Map(builtinRecipes.map((recipe) => [recipe.id, recipe]));
  const shelfRecipes = (ids: string[]) => ids.map((id) => byId.get(id)).filter((item): item is Recipe => !!item);
  const openShelf = SHELVES.find((shelf) => shelf.id === shelfId) ?? null;
  const clearSearch = () => {
    setQuery('');
    setFilter('all');
    setStyleFilter('all');
  };

  const onCreate = () => {
    const recipe = blankRecipe();
    saveRecipe(recipe);
    navigate(`/edit/${recipe.id}`);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: { tone: 'success' | 'error'; text: string }[] = [];
    const cards: AgentCard[] = [];
    let lastRecipeId: string | null = null;

    for (const file of Array.from(files)) {
      const result = importFile(file.name, await file.text());
      if (result.kind === 'error') {
        next.push({ tone: 'error', text: `${file.name}: ${result.message}` });
      } else if (result.kind === 'recipe') {
        const recipe = { ...result.recipe, id: newId('recipe') };
        saveRecipe(recipe);
        lastRecipeId = recipe.id;
        next.push({ tone: 'success', text: `${file.name}: 레시피 "${recipe.title}"을(를) 가져왔어요.` });
      } else {
        cards.push(result.card);
      }
    }
    if (cards.length > 0) {
      const recipe = blankRecipe(cards, '불러온 팀');
      saveRecipe(recipe);
      lastRecipeId = recipe.id;
      next.push({
        tone: 'success',
        text: `에이전트 ${cards.length}개로 새 레시피를 만들었어요. 지시문은 그대로 가져왔고, 파일에 없는 학습 목표·산출물·완료 기준은 비어 있으니 편집 화면에서 채워 주세요.`,
      });
    }
    setMessages(next);
    if (fileInput.current) fileInput.current.value = '';
    if (lastRecipeId && next.every((message) => message.tone === 'success')) {
      navigate(`/edit/${lastRecipeId}`);
    }
  };

  const grid = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="flex flex-col gap-10">
      <section
        className="pt-2 sm:pt-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-4xl font-extrabold sm:text-5xl">레시피 책</h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-pretty">
              검증된 팀 구성을 골라 내 프로젝트에 들이세요. 하고 싶은 일로 찾고 싶으면{' '}
              <a className="underline underline-offset-2 hover:text-primary" href="#/">
                첫 화면
              </a>
              에 적어 보세요.
            </p>
            <p className="mt-2 text-base text-muted-foreground">
              바로 쓸 수 있는 팀 {builtinRecipes.length}가지와 내가 만든 레시피. 내 AI 현황은{' '}
              <a className="underline underline-offset-2 hover:text-primary" href="#/plans">
                {plansSummary(plans)}
              </a>
              {!plansConfirmed ? ' (무료 계정으로 가정)' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onCreate}>
              <FilePlus2 aria-hidden />새 레시피 만들기
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <FolderOpen aria-hidden />
              파일에서 불러오기
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".toml,.md,.json"
              className="hidden"
              onChange={(event) => void onFiles(event.target.files)}
            />
          </div>
        </div>
        </div>
      </section>

      {messages.length > 0 ? (
        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <Notice key={message.text} tone={message.tone}>
              {message.text}
            </Notice>
          ))}
        </div>
      ) : null}

      {unreadable.length > 0 ? (
        <Notice tone="warn">
          이 버전의 사이트가 읽지 못한 저장 레시피가 {unreadable.length}개 있어요. 더 새로운 형식일 수 있어서 지우지
          않고 그대로 보관하고 있습니다. 페이지를 새로고침해 최신 버전으로 열면 다시 보일 수 있어요.
        </Notice>
      ) : null}

      {myRecipes.length > 0 && !searching ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-extrabold">내 레시피</h2>
          <div className={grid}>
            {myRecipes.map((recipe) => (
              <RecipeTile key={recipe.id} recipe={recipe} plans={plans} href={hrefOf(recipe)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h2 className="text-2xl font-extrabold">무엇을 하려고 하나요?</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="h-9 w-56 bg-card pl-8"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름으로 찾기"
                aria-label="레시피 검색"
              />
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'ghost'}
              size="sm"
              aria-expanded={showFilters}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal aria-hidden />
              조건
            </Button>
          </div>
        </div>

        {showFilters ? (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="레시피 필터">
              <span className="w-16 text-sm text-muted-foreground">내 플랜</span>
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    filter === item.id ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="조리법 필터">
              <span className="w-16 text-sm text-muted-foreground">조리법</span>
              {(['all', ...COLLABORATION_IDS] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={styleFilter === id}
                  title={id === 'all' ? undefined : COLLABORATIONS[id].description}
                  onClick={() => setStyleFilter(id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    styleFilter === id ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted',
                  )}
                >
                  {id === 'all' ? '모든 조리법' : COLLABORATIONS[id].label}
                </button>
              ))}
            </div>
            {styleFilter !== 'all' ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{COLLABORATIONS[styleFilter].label}:</span>{' '}
                {COLLABORATIONS[styleFilter].description}
              </p>
            ) : null}
          </div>
        ) : null}

        {!searching ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {SHELVES.map((shelf) => {
              const selected = shelf.id === shelfId;
              return (
                <button
                  key={shelf.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setShelfId(selected ? null : shelf.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors duration-200 sm:p-5',
                    selected ? 'border-foreground bg-foreground text-background' : 'bg-card hover:border-input hover:bg-muted',
                  )}
                >
                  <span className="font-heading text-xl font-extrabold sm:text-2xl">{shelf.label}</span>
                  <span className={cn('text-sm', selected ? 'text-background/75' : 'text-muted-foreground')}>
                    {shelf.hint}
                  </span>
                  <span className={cn('mt-2 text-xs', selected ? 'text-background/75' : 'text-muted-foreground')}>
                    레시피 {shelf.recipeIds.length}가지
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {searching ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-extrabold">찾은 레시피 {found.length}가지</h2>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              <ArrowLeft aria-hidden />
              검색과 조건 지우기
            </Button>
          </div>
          {found.length > 0 ? (
            <div className={grid}>
              {found.map((recipe) => (
                <RecipeTile key={recipe.id} recipe={recipe} plans={plans} href={hrefOf(recipe)} />
              ))}
            </div>
          ) : (
            <Notice tone="info">
              조건에 맞는 레시피가 없어요. 검색어를 줄이거나 <a className="underline" href="#/plans">내 AI 현황</a>을
              확인해 보세요.
            </Notice>
          )}
        </section>
      ) : openShelf ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-extrabold">
              {openShelf.label} <span className="text-base font-normal text-muted-foreground">{openShelf.hint}</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShelfId(null)}>
              <ArrowLeft aria-hidden />
              전체 보기
            </Button>
          </div>
          <div className={grid}>
            {shelfRecipes(openShelf.recipeIds).map((recipe) => (
              <RecipeTile key={recipe.id} recipe={recipe} plans={plans} href={hrefOf(recipe)} />
            ))}
          </div>
        </section>
      ) : (
        SHELVES.map((shelf) => {
          const recipes = shelfRecipes(shelf.recipeIds);
          const more = recipes.length - 3;
          return (
            <Reveal key={shelf.id} className="flex flex-col gap-4" role="region" aria-label={shelf.label}>
              <div className="rule h-px bg-foreground/70" aria-hidden />
              <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
                <h2 className="text-2xl font-extrabold">
                  {shelf.label} <span className="text-base font-normal text-muted-foreground">{shelf.hint}</span>
                </h2>
                {more > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setShelfId(shelf.id)}>
                    {recipes.length}가지 모두 보기
                  </Button>
                ) : null}
              </div>
              <div className={grid}>
                {recipes.slice(0, 3).map((recipe, index) => (
                  <div key={recipe.id} className="rise flex" style={{ '--i': index } as CSSProperties}>
                    <RecipeTile recipe={recipe} plans={plans} href={hrefOf(recipe)} />
                  </div>
                ))}
              </div>
            </Reveal>
          );
        })
      )}
    </div>
  );
}
