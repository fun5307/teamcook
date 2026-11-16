// 레시피를 읽기 전용으로 보여 주는 부품 (기본 레시피 미리보기, 공유받은 레시피 화면에서 사용).
// 주의: 공유 링크로 들어온 데이터는 남이 만든 것이다. 반드시 텍스트로만 그린다
// (React가 자동으로 글자를 안전하게 처리하므로 dangerouslySetInnerHTML만 쓰지 않으면 된다).

import { useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlowSection } from '@/components/FlowSection';
import {
  CardRoute,
  PlanBadges,
  RecipeRunSummary,
  StyleChip,
  VerifiedBadge,
  engineName,
} from '@/components/RouteInfo';
import { COLLABORATIONS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { copyText } from '@/lib/download';
import { PERMISSION_LABELS, runPrompt } from '@/lib/recipeMd';
import { requiredPlans } from '@/lib/requiredPlans';
import { resolveRecipe } from '@/lib/resolvePath';
import { ROLE_LABELS } from '@/lib/roles';
import type { Recipe, RoleTag, UserPlans } from '@/types';

export function roleLabel(tags: string[] | undefined): string | null {
  const tag = (tags ?? [])[0];
  if (!tag) return null;
  return ROLE_LABELS[tag as RoleTag] ?? tag;
}

/** 넘겨주기 흐름을 "A → B (라벨)" 목록으로 보여 준다. */
export function FlowList({ recipe }: { recipe: Recipe }) {
  const byId = new Map(recipe.cards.map((card) => [card.id, card]));
  if (recipe.handoffs.length === 0) {
    return <p className="text-sm text-muted-foreground">정해진 흐름이 없어요.</p>;
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {recipe.handoffs.map((handoff, index) => {
        const from = byId.get(handoff.from);
        const to = byId.get(handoff.to);
        if (!from || !to) return null;
        return (
          <li key={handoff.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-5 text-right text-xs text-muted-foreground">{index + 1}.</span>
            <span className="rounded-md border bg-background px-2 py-0.5 font-medium">{from.displayName}</span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            <span className="rounded-md border bg-background px-2 py-0.5 font-medium">{to.displayName}</span>
            {handoff.label ? <span className="text-muted-foreground">{handoff.label}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

const PROMPT_TITLES = {
  subagents: '첫 프롬프트 예시 (흐름을 문장으로 옮긴 것)',
  'agent-team': '첫 프롬프트 (팀원 소개) — Claude Code에 붙여 넣고 "할 일"만 바꾸세요',
  debate: '토론 프롬프트 — 쓰는 AI 채팅에 붙여 넣고 "주제"만 바꾸세요',
};

/** 조리법에 맞는 '처음에 붙여 넣을 프롬프트'와 복사 버튼 */
export function RunPromptBox({ recipe }: { recipe: Recipe }) {
  const [copied, setCopied] = useState(false);
  const prompt = runPrompt(recipe);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{PROMPT_TITLES[collaborationOf(recipe)]}</p>
        <Button size="sm" variant="outline" onClick={async () => setCopied(await copyText(prompt))}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? '복사했어요' : '프롬프트 복사'}
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">
        {prompt}
      </pre>
    </div>
  );
}

export function RecipeOverview({
  recipe,
  plans,
  runLead,
}: {
  recipe: Recipe;
  plans: UserPlans;
  runLead?: string;
}) {
  const required = requiredPlans(recipe, providerData);
  const resolved = resolveRecipe(recipe, plans, providerData);
  const style = collaborationOf(recipe);
  const styleInfo = COLLABORATIONS[style];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <VerifiedBadge date={recipe.lastVerified} />
          <StyleChip recipe={recipe} />
        </div>
        {recipe.summary ? <p className="text-base leading-relaxed">{recipe.summary}</p> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {recipe.useCase ? <span>쓰임새: {recipe.useCase}</span> : null}
          {recipe.author ? <span>만든 사람: {recipe.author}</span> : null}
          <span>카드 {recipe.cards.length}장</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">필요한 플랜</span>
          <PlanBadges required={required} showDate />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">조리법 — {styleInfo.label}:</span> {styleInfo.description}
        </p>
      </section>

      <RecipeRunSummary resolution={resolved} lead={runLead} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">팀 구성</h2>
        {recipe.cards.map((card) => (
          <article key={card.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-base font-semibold">{card.displayName}</h3>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{card.name}</code>
              {roleLabel(card.tags) ? (
                <span className="text-xs text-muted-foreground">{roleLabel(card.tags)}</span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {style === 'debate'
                  ? '· 프롬프트 안의 역할'
                  : `· ${engineName(style === 'agent-team' ? 'claude-code' : card.preferredEngine)} · ${PERMISSION_LABELS[card.permission]}`}
              </span>
            </div>
            <p className="text-sm">{card.role}</p>
            <CardRoute resolution={resolved.perCard[card.id]} />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">지시문 보기</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">
                {card.instructions}
              </pre>
            </details>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">흐름 — 누가 누구에게 무엇을 넘기나</h2>
        <FlowSection recipe={recipe} resolution={resolved} />
        <FlowList recipe={recipe} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">이렇게 시작해요</h2>
        {recipe.howToRun ? <p className="text-sm leading-relaxed">{recipe.howToRun}</p> : null}
        <RunPromptBox recipe={recipe} />
      </section>
    </div>
  );
}
