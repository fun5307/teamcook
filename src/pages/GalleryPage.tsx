// 첫 화면: 레시피 갤러리 + '내 플랜으로 되는 레시피만 보기' 필터.

import { useRef, useState } from 'react';
import { FilePlus2, FolderOpen, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { FitLabel, PlanBadges, engineName } from '@/components/RouteInfo';
import { providerData } from '@/data/providers';
import { builtinRecipes } from '@/data/recipes';
import { newId } from '@/lib/id';
import { importFile } from '@/lib/importFiles';
import { fitsMyPlans, requiredPlans } from '@/lib/requiredPlans';
import { navigate } from '@/lib/router';
import { useStore } from '@/store/useStore';
import type { AgentCard, EngineId, ProviderId, Recipe, UserPlans } from '@/types';

type Filter = 'all' | 'fits' | 'full';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'fits', label: '내 플랜으로 되는 것만' },
  { id: 'full', label: '바꾸지 않고 그대로 되는 것만' },
];

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
  const engines: EngineId[] = [];
  for (const card of recipe.cards) {
    if (!engines.includes(card.preferredEngine)) engines.push(card.preferredEngine);
  }
  return (
    <a
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary">{recipe.title}</h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {recipe.summary || '설명이 아직 없어요.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recipe.cards.map((card) => (
          <span key={card.id} className="rounded-md border bg-background px-2 py-0.5 text-xs">
            {card.displayName}
          </span>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t pt-3">
        <PlanBadges required={required} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FitLabel fit={fit} />
          <span className="text-xs text-muted-foreground">
            {engines.map(engineName).join(' + ') || '카드 없음'}
          </span>
        </div>
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
  const [messages, setMessages] = useState<{ tone: 'success' | 'error'; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const matches = (recipe: Recipe) => {
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
      <section className="flex flex-col gap-4 rounded-3xl border bg-gradient-to-br from-orange-50 via-background to-amber-50 p-6 sm:p-10">
        <p className="text-sm font-medium text-primary">실행은 어디서든, 팀 설계와 레시피는 여기서.</p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          여러 AI가 역할을 나눠 일하는 팀을 설계하고, 링크 하나로 나누세요
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          작성자·검토자·조사원 같은 역할 카드로 팀을 짜면, 내 요금제로 쓸 수 있는 실행 경로를 알려 주고 Codex와
          Claude Code 설정 파일로 내보내 줍니다. 내보낸 파일은 터미널, T3 Code, 1Code 어디서든 그대로 쓸 수 있어요.
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
          불러올 수 있는 파일: Codex 에이전트(.toml), Claude 서브에이전트(.md), 레시피(recipe.json). 파일은 내
          브라우저 안에서만 읽고, 어디로도 전송하지 않아요.
        </p>
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

      <section className="flex flex-col gap-3 rounded-2xl border p-4">
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
                  : 'bg-background hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {hiddenCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            내 플랜에 맞지 않는 레시피 {hiddenCount}개를 숨겼어요.
          </p>
        ) : null}
      </section>

      {myRecipes.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">내 레시피</h2>
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
        <h2 className="text-xl font-semibold">기본 레시피</h2>
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
            이 필터에 맞는 기본 레시피가 없어요. <a className="underline" href="#/plans">내 AI 현황</a>을
            확인하거나 필터를 '전체'로 바꿔 보세요.
          </Notice>
        )}
      </section>
    </div>
  );
}
