// 첫 화면: 레시피 갤러리 + '내 플랜으로 되는 레시피만 보기' 필터.

import { useRef, useState } from 'react';
import { FilePlus2, FolderOpen, Search, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FactTable, Notice } from '@/components/common';
import { FitLabel, STYLE_COLORS, engineName } from '@/components/RouteInfo';
import { COLLABORATIONS, COLLABORATION_IDS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { builtinRecipes } from '@/data/recipes';
import { newId } from '@/lib/id';
import { importFile } from '@/lib/importFiles';
import { fitsMyPlans, requiredPlans } from '@/lib/requiredPlans';
import { navigate } from '@/lib/router';
import { useStore } from '@/store/useStore';
import type { AgentCard, Collaboration, EngineId, ProviderId, Recipe, UserPlans } from '@/types';

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
    schemaVersion: 1,
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

function RecipeTile({ recipe, plans, href }: { recipe: Recipe; plans: UserPlans; href: string }) {
  const required = requiredPlans(recipe, providerData);
  const fit = fitsMyPlans(recipe, plans, providerData);
  const style = collaborationOf(recipe);
  const engines: EngineId[] = [];
  for (const card of recipe.cards) {
    const engine = style === 'agent-team' ? 'claude-code' : card.preferredEngine;
    if (!engines.includes(engine)) engines.push(engine);
  }
  const where = style === 'debate' ? '프롬프트만' : engines.map(engineName).join(' + ') || '카드 없음';
  const info = COLLABORATIONS[style];
  const names = recipe.cards.map((card) => card.displayName || card.name).join(', ');
  const count = style === 'debate' ? `${recipe.cards.length}개` : `${recipe.cards.length}명`;
  return (
    <a
      href={href}
      className="group flex flex-col border-2 bg-card transition-[box-shadow] duration-150 hover:shadow-[4px_4px_0_0_var(--foreground)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div
        className="flex items-center justify-between gap-2 px-3.5 py-1 text-sm font-bold text-white"
        style={{ background: STYLE_COLORS[style] }}
      >
        <span>{info.label}</span>
        {info.experimental ? <span>실험 기능</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl leading-snug font-bold text-balance group-hover:underline">{recipe.title}</h3>
          <p className="line-clamp-3 text-sm text-pretty">{recipe.summary || '설명이 아직 없어요.'}</p>
        </div>
        <div className="mt-auto">
          <h4 className="label-rule-sm text-sm font-bold">레시피 정보</h4>
          <FactTable
            rows={[
              [style === 'debate' ? '역할' : '팀원', recipe.cards.length > 0 ? `${count} (${names})` : '카드 없음'],
              ['필요한 플랜', required.badges.join(', ') || '카드를 추가하면 계산돼요'],
              ['돌리는 곳', where],
              ...(recipe.lastVerified ? ([['확인한 날', recipe.lastVerified]] as [string, string][]) : []),
            ]}
          />
        </div>
        <FitLabel fit={fit} />
      </div>
    </a>
  );
}

export function GalleryPage() {
  const plans = useStore((state) => state.plans);
  const plansConfirmed = useStore((state) => state.plansConfirmed);
  const myRecipes = useStore((state) => state.recipes);
  const saveRecipe = useStore((state) => state.saveRecipe);

  const [filter, setFilter] = useState<Filter>('all');
  const [styleFilter, setStyleFilter] = useState<Collaboration | 'all'>('all');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ tone: 'success' | 'error'; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const matches = (recipe: Recipe) => {
    if (!matchesQuery(recipe, query) || !matchesStyle(recipe, styleFilter)) return false;
    if (filter === 'all') return true;
    const fit = fitsMyPlans(recipe, plans, providerData);
    return filter === 'fits' ? fit !== 'no' : fit === 'full';
  };
  const visibleBuiltin = builtinRecipes.filter(matches);
  const visibleMine = myRecipes.filter(matches);
  const hiddenCount =
    builtinRecipes.length + myRecipes.length - visibleBuiltin.length - visibleMine.length;

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
      next.push({ tone: 'success', text: `에이전트 ${cards.length}개로 새 레시피를 만들었어요.` });
    }
    setMessages(next);
    if (fileInput.current) fileInput.current.value = '';
    if (lastRecipeId && next.every((message) => message.tone === 'success')) {
      navigate(`/edit/${lastRecipeId}`);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section
        className="grid border-[3px] bg-card md:grid-cols-[1.2fr_1fr]"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-col gap-4 p-6 sm:p-9">
          <h1 className="text-4xl leading-[1.1] font-bold tracking-[-0.045em] sm:text-6xl sm:leading-[1.1]">
            AI 팀을 레시피로 요리하세요
          </h1>
          <p className="max-w-xl text-base">
            역할을 나눈 AI 팀을 레시피 한 장으로 짜고 링크 하나로 나눕니다. 내 요금제로 쓸 수 있는 실행 경로를
            알려 주고, Codex와 Claude Code 설정 파일로 내보내 줍니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={onCreate}>
              <FilePlus2 aria-hidden />새 레시피 만들기
            </Button>
            <Button size="lg" variant="outline" onClick={() => fileInput.current?.click()}>
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
          <p className="text-xs text-muted-foreground">
            불러올 수 있는 파일: Codex 에이전트(.toml), Claude 서브에이전트(.md), 레시피(recipe.json). 이 상자에
            파일을 끌어다 놓아도 돼요. 파일은 내 브라우저 안에서만 읽고, 어디로도 전송하지 않아요.
          </p>
        </div>
        <div className="border-t-[3px] p-6 md:border-t-0 md:border-l-[3px]">
          <h2 className="label-rule text-xl font-bold">내용물</h2>
          <FactTable
            rows={[
              ['역할 카드', '작성자, 검토자, 조사원 등으로 팀을 짭니다'],
              ['실행 경로', '내 요금제로 쓸 수 있는 길을 알려 줍니다'],
              ['내보내기', 'Codex, Claude Code 설정 파일 (터미널, T3 Code, 1Code에서 그대로)'],
              ['공유', '가입 없이 링크 하나'],
            ]}
          />
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

      <section className="flex flex-col gap-3 border-2 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="text-muted-foreground">내 AI 현황: </span>
            <strong className="font-medium">{plansSummary(plans)}</strong>
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="#/plans">
              <Settings2 aria-hidden />내 AI 현황 바꾸기
            </a>
          </Button>
        </div>
        {!plansConfirmed ? (
          <Notice tone="info">
            아직 내 AI 현황을 알려 주지 않아서, 지금은 <strong>ChatGPT·Claude 무료 계정</strong>이라고 가정하고
            보여 드려요. 결제 중인 플랜을 알려 주시면 실행 경로가 정확해져요.
          </Notice>
        ) : null}
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="레시피 검색 (예: 검토, 조사, Codex)"
            aria-label="레시피 검색"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="레시피 필터">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                filter === item.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="조리법 필터">
          <span className="text-sm text-muted-foreground">조리법</span>
          {(['all', ...COLLABORATION_IDS] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={styleFilter === id}
              title={id === 'all' ? undefined : COLLABORATIONS[id].description}
              onClick={() => setStyleFilter(id)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                styleFilter === id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted',
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
        {hiddenCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            검색어나 필터에 맞지 않는 레시피 {hiddenCount}개를 숨겼어요.
          </p>
        ) : null}
      </section>

      {myRecipes.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="label-rule text-xl font-bold">내 레시피</h2>
          {visibleMine.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleMine.map((recipe) => (
                <RecipeTile
                  key={recipe.id}
                  recipe={recipe}
                  plans={plans}
                  href={`#/edit/${encodeURIComponent(recipe.id)}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">이 필터에 맞는 내 레시피가 없어요.</p>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="label-rule text-xl font-bold">기본 레시피</h2>
        {visibleBuiltin.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleBuiltin.map((recipe) => (
              <RecipeTile
                key={recipe.id}
                recipe={recipe}
                plans={plans}
                href={`#/recipe/${encodeURIComponent(recipe.id)}`}
              />
            ))}
          </div>
        ) : (
          <Notice tone="info">
            이 조건에 맞는 기본 레시피가 없어요. <a className="underline" href="#/plans">내 AI 현황</a>을
            확인하거나 필터를 '전체'로 바꿔 보세요.
          </Notice>
        )}
      </section>
    </div>
  );
}
