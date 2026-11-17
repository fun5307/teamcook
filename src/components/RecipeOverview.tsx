// 레시피를 읽기 전용으로 보여 주는 부품 (기본 레시피 미리보기, 공유받은 레시피 화면에서 사용).
// 주의: 공유 링크로 들어온 데이터는 남이 만든 것이다. 반드시 텍스트로만 그린다
// (React가 자동으로 글자를 안전하게 처리하므로 dangerouslySetInnerHTML만 쓰지 않으면 된다).

import { useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlowSection } from '@/components/FlowSection';
import { CardRoute, PlanBadges, RecipeRunSummary, StyleChip, engineName } from '@/components/RouteInfo';
import { PermissionNote, VerificationList } from '@/components/SpecEditors';
import { UsageNote } from '@/components/SuggestBox';
import { COLLABORATIONS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { copyText } from '@/lib/download';
import { handoffDeliverables } from '@/lib/exportCheck';
import { PERMISSION_LABELS, runPrompt } from '@/lib/recipeMd';
import { FLOW_NOTE, PLAN_FIT_NOTE, previewInstructions, reflectionScope } from '@/lib/support';
import { hasSuccessfulRun } from '@/lib/verification';
import { requiredPlans } from '@/lib/requiredPlans';
import { resolveRecipe } from '@/lib/resolvePath';
import { ROLE_LABELS } from '@/lib/roles';
import type { Recipe, RoleTag, UserPlans } from '@/types';

export function roleLabel(tags: string[] | undefined): string | null {
  const tag = (tags ?? [])[0];
  if (!tag) return null;
  return ROLE_LABELS[tag as RoleTag] ?? tag;
}

/** 넘겨주기 한 건이 넘기는 산출물 (지워진 것을 가리키면 '재선택 필요') */
function HandoffItems({ recipe, handoff }: { recipe: Recipe; handoff: Recipe['handoffs'][number] }) {
  const { found, missing } = handoffDeliverables(recipe, handoff);
  return (
    <>
      {found.length > 0 ? (
        <span className="w-full pl-7 text-xs text-muted-foreground">
          넘기는 산출물: {found.map((item) => item.name).join(', ')}
        </span>
      ) : null}
      {missing.length > 0 ? (
        <span className="w-full pl-7 text-xs font-medium text-amber-800">
          재선택 필요: 지워진 산출물을 가리키고 있어요
        </span>
      ) : null}
      {found.length === 0 && missing.length === 0 && !handoff.label ? (
        <span className="text-xs text-muted-foreground">(무엇을 넘기는지 적혀 있지 않아요)</span>
      ) : null}
    </>
  );
}

function Lines({ items, empty }: { items: string[] | undefined; empty: string }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="list-disc pl-5 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
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
            <span className="rounded-md border bg-card px-2 py-0.5 font-medium">{from.displayName}</span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            <span className="rounded-md border bg-card px-2 py-0.5 font-medium">{to.displayName}</span>
            {handoff.label ? <span className="text-muted-foreground">{handoff.label}</span> : null}
            <HandoffItems recipe={recipe} handoff={handoff} />
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
  const ran = hasSuccessfulRun(recipe.verification);
  const hasLearning =
    Boolean(recipe.learningObjective?.trim()) || Boolean(recipe.successCriteria?.length) || Boolean(recipe.sampleTask?.trim());
  const hasSpec = (card: Recipe['cards'][number]) =>
    Boolean(card.deliverables?.length || card.completionCriteria?.length || card.requiredInputs?.length || card.boundaries?.length);

  return (
    <div className="flex flex-col gap-8">
      {/* 1. 설명과 협업 방식 */}
      <section className="flex flex-col gap-2">
        {recipe.summary ? <p className="text-base leading-relaxed">{recipe.summary}</p> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <StyleChip recipe={recipe} />
          <span>{styleInfo.availability}</span>
          {recipe.author ? <span>만든 사람: {recipe.author}</span> : null}
        </div>
      </section>

      {/* 2. 학습 목표와 성공 조건 (적혀 있을 때만) */}
      {hasLearning ? (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">이 레시피로 익히는 것</h2>
          {recipe.learningObjective?.trim() ? (
            <p className="text-base leading-relaxed">{recipe.learningObjective}</p>
          ) : null}
          {recipe.successCriteria?.length ? (
            <div>
              <h3 className="text-sm font-bold">이렇게 되면 성공</h3>
              <Lines items={recipe.successCriteria} empty="" />
            </div>
          ) : null}
          {recipe.sampleTask?.trim() ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">처음 넣어 볼 과제:</span> {recipe.sampleTask}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 3. 내 플랜으로 되는지 */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">필요한 플랜</span>
          <PlanBadges required={required} />
        </div>
        <RecipeRunSummary resolution={resolved} lead={runLead} />
        <p className="text-xs text-muted-foreground">{PLAN_FIT_NOTE}</p>
        <UsageNote recipe={recipe} plans={plans} />
      </section>

      {/* 4. 팀 구성: 한 줄 요약을 먼저, 자세한 것은 접어 둔다 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">팀 구성 {recipe.cards.length}명</h2>
        {recipe.cards.map((card) => (
          <article key={card.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-base font-semibold">{card.displayName}</h3>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{card.name}</code>
              <span className="text-xs text-muted-foreground">
                {style === 'debate'
                  ? '프롬프트 안의 역할'
                  : `${engineName(style === 'agent-team' ? 'claude-code' : card.preferredEngine)} · ${PERMISSION_LABELS[card.permission]}`}
              </span>
            </div>
            <p className="text-sm">{card.role}</p>
            {card.deliverables?.length ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">내놓는 것:</span>{' '}
                {card.deliverables.map((item) => item.name).join(', ')}
              </p>
            ) : null}
            <CardRoute resolution={resolved.perCard[card.id]} />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">자세히</summary>
              <div className="mt-2 flex flex-col gap-3">
                {hasSpec(card) ? (
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {card.completionCriteria?.length ? (
                      <div>
                        <dt className="font-bold">완료 기준</dt>
                        <dd>
                          <Lines items={card.completionCriteria} empty="" />
                        </dd>
                      </div>
                    ) : null}
                    {card.requiredInputs?.length ? (
                      <div>
                        <dt className="font-bold">받을 입력</dt>
                        <dd>
                          <Lines items={card.requiredInputs} empty="" />
                        </dd>
                      </div>
                    ) : null}
                    {card.boundaries?.length ? (
                      <div>
                        <dt className="font-bold">하지 않을 일</dt>
                        <dd>
                          <Lines items={card.boundaries} empty="" />
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
                {style !== 'debate' ? <PermissionNote card={card} style={style} /> : null}
                <div>
                  <p className="font-bold">파일에 들어갈 지시문</p>
                  <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">
                    {previewInstructions(card, style)}
                  </pre>
                </div>
              </div>
            </details>
          </article>
        ))}
      </section>

      {/* 5. 전달 흐름 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">누가 누구에게 무엇을 넘기나</h2>
        <FlowSection recipe={recipe} resolution={resolved} />
        <FlowList recipe={recipe} />
        <p className="text-xs text-muted-foreground">{FLOW_NOTE}</p>
      </section>

      {/* 6. 시작 안내 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">이렇게 시작해요</h2>
        {recipe.howToRun ? <p className="text-sm leading-relaxed">{recipe.howToRun}</p> : null}
        <RunPromptBox recipe={recipe} />
        <p className="text-sm text-muted-foreground">
          파일로 받으려면 맨 위의 <strong className="font-medium text-foreground">내보내기</strong>를 누르세요.
        </p>
      </section>

      {/* 7. 더 알고 싶을 때: 준비 조건, 실행 반영 범위, 확인 기록 */}
      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          더 알아보기{' '}
          <span className="font-normal text-muted-foreground">준비할 것, 설계가 파일 어디에 들어가는지, 확인 기록</span>
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          {recipe.prerequisites?.length ? (
            <div>
              <h3 className="text-sm font-bold">준비할 것</h3>
              <Lines items={recipe.prerequisites} empty="" />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">설계한 내용이 어디에 들어가나</h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <tbody>
                  {reflectionScope(recipe, providerData).map((row) => (
                    <tr key={row.item} className="border-b align-top last:border-b-0">
                      <th className="p-2.5 font-medium whitespace-nowrap">{row.item}</th>
                      <td className="p-2.5">{row.where}</td>
                      <td className="p-2.5 text-muted-foreground">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">확인 기록</h3>
            <VerificationList records={recipe.verification} />
            {!ran ? (
              <p className="text-xs text-muted-foreground">
                실제 도구에서 돌려 성공했다는 기록은 없습니다. "내 플랜으로 가능"은 요금제 기준이며 실행 확인이 아닙니다.
              </p>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
