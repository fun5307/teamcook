// 화면 E — 실행 준비: 점검(막는 것과 알리는 것) → 레시피 만들기·갱신 → 기존 1차 내보내기·2차 실습 기록으로.
// 같은 버튼을 다시 눌러도 같은 레시피를 갱신한다(중복 없음). 레시피를 손으로 고쳤으면 덮어쓰지 않고 먼저 묻는다.

import { useState } from 'react';
import { Download, FilePlus2, NotebookPen, PencilLine, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { ExportPrepButton } from '@/components/ExportDialog';
import { providerData } from '@/data/providers';
import { downloadBytes } from '@/lib/download';
import { exportOrder } from '@/lib/order/schema';
import { checkOrder, generateRecipe, includedWork, linkState, orderPrompt, recipeFromOrder, type GenerateMode } from '@/lib/order/toRecipe';
import { safeFileName } from '@/components/practice/PracticeParts';
import { useStore } from '@/store/useStore';
import type { StepProps } from '@/pages/order/OrderPage';

const STEP_NAMES = { define: '주문 정리', work: '작업 설계', team: '팀 제안', ready: '실행 준비' } as const;

export function ReadyStep({ order, save, go }: StepProps) {
  const recipes = useStore((state) => state.recipes);
  const saveRecipe = useStore((state) => state.saveRecipe);
  const plans = useStore((state) => state.plans);
  const [withContent, setWithContent] = useState(false);
  const [done, setDone] = useState('');
  const issues = checkOrder(order, providerData);
  const errors = issues.filter((item) => item.level === 'error');
  const warns = issues.filter((item) => item.level === 'warn');
  const state = linkState(order, recipes);
  const linked = order.link ? recipes.find((item) => item.id === order.link!.recipeId) : undefined;
  const preview = recipeFromOrder(order, linked);
  const work = includedWork(order);

  const generate = (mode: GenerateMode) => {
    const result = generateRecipe(order, recipes, mode);
    if (!result) return;
    saveRecipe(result.recipe);
    save({ ...result.order, step: 'ready' });
    setDone(mode === 'separate' ? '새 레시피를 따로 만들었어요. 손으로 고친 레시피는 그대로예요.' : state === 'none' || state === 'missing' ? '레시피를 만들었어요.' : '레시피를 갱신했어요.');
  };

  return (
    <div className="flex flex-col gap-6">
      {errors.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950" aria-label="막는 문제">
          <p className="font-semibold">레시피를 만들기 전에 {errors.length}곳을 정해 주세요</p>
          <ul className="flex flex-col gap-1 text-sm">
            {errors.map((item) => (
              <li key={item.code + item.message} className="flex flex-wrap items-center gap-2">
                <span>{item.message}</span>
                <Button size="xs" variant="ghost" onClick={() => go(item.step)}>
                  {STEP_NAMES[item.step]}로
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Notice tone="success">막는 문제가 없어요. 레시피를 만들 수 있어요.</Notice>
      )}
      {warns.length > 0 ? (
        <details className="rounded-xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">확인하고 넘어가도 되는 것 {warns.length}가지</summary>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {warns.map((item) => (
              <li key={item.code}>{item.message}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="확정한 설계">
        <h3 className="font-heading text-lg font-extrabold">확정한 설계</h3>
        <ol className="flex flex-col gap-1.5 text-sm">
          {work.map((item, index) => {
            const owner = order.roles.find((role) => order.assignments.some((entry) => entry.workId === item.id && entry.roleId === role.id && entry.responsibility === 'owner'));
            return (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="w-5 text-right text-muted-foreground tabular-nums">{index + 1}.</span>
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground">→ {owner?.displayName ?? '담당 없음'}</span>
                {item.outputs.length > 0 ? <span className="text-xs text-muted-foreground">내놓을 것: {item.outputs.map((out) => out.name).join(', ')}</span> : null}
                {item.checkpoint ? <span className="text-xs text-primary">확인 지점</span> : null}
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted-foreground">
          역할 {preview.cards.length}개, 역할 사이 전달 {preview.handoffs.length}건. 같은 역할 안의 작업 순서는 그 역할의 지시문에 적혀요.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border-2 border-foreground bg-card p-4" aria-label="레시피">
        <h3 className="font-heading text-lg font-extrabold">레시피</h3>
        {state === 'recipe-edited' ? (
          <Notice tone="warn" className="flex flex-col gap-2">
            <span>"{linked?.title}" 레시피를 만든 뒤 손으로 고쳤어요 (설계 이후 수정됨). 주문 내용으로 덮어쓰면 그 수정이 사라져요.</span>
            <span className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={errors.length > 0} onClick={() => generate('separate')}>
                <FilePlus2 aria-hidden />
                새 레시피로 따로 만들기
              </Button>
              <Button size="sm" variant="ghost" disabled={errors.length > 0} onClick={() => generate('overwrite')}>
                주문 내용으로 덮어쓰기
              </Button>
            </span>
          </Notice>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={errors.length > 0 || state === 'same'} onClick={() => generate('auto')}>
              {state === 'none' || state === 'missing' ? <FilePlus2 aria-hidden /> : <RefreshCw aria-hidden />}
              {state === 'none' || state === 'missing' ? '레시피 만들기' : state === 'same' ? '최신 상태예요' : '레시피 갱신하기'}
            </Button>
            {state === 'order-changed' ? <span className="text-sm text-muted-foreground">레시피를 만든 뒤 주문을 고쳤어요.</span> : null}
            {state === 'missing' ? <span className="text-sm text-muted-foreground">전에 만든 레시피를 지워서 새로 만들어요.</span> : null}
          </div>
        )}
        {done ? <p className="text-sm text-emerald-800" role="status">{done}</p> : null}
        {linked ? (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button asChild variant="outline">
              <a href={`#/edit/${encodeURIComponent(linked.id)}`}>
                <PencilLine aria-hidden />
                레시피 편집
              </a>
            </Button>
            <ExportPrepButton recipe={linked} plans={plans} />
            <Button asChild variant="ghost">
              <a href={`#/runs/new?recipe=${encodeURIComponent(linked.id)}&order=${encodeURIComponent(order.id)}`}>
                <NotebookPen aria-hidden />
                실습 기록 만들기
              </a>
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          레시피 공유 링크에는 확정한 주문 요약만 들어가요. 요청 원문과 자료 본문은 들어가지 않아요. 레시피를 만들어도 실행되거나 실습 기록이 생기지 않아요.
        </p>
      </section>

      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer font-medium">
          파일에 들어갈 내용 미리 보기 <span className="text-sm font-normal text-muted-foreground">시작 프롬프트, 역할별 지시문</span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-bold text-primary">시작 프롬프트 (Claude Code·Codex에 붙여 넣을 것)</p>
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{orderPrompt(order, preview)}</pre>
          </div>
          {preview.cards.map((card) => (
            <div key={card.id}>
              <p className="mb-1 text-xs font-bold text-primary">
                {card.displayName} ({card.name}) 지시문
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{card.instructions}</pre>
            </div>
          ))}
        </div>
      </details>

      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm" aria-label="주문 내보내기">
        <h3 className="font-heading text-lg font-extrabold">주문 파일로 저장 (JSON)</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={withContent} onChange={(event) => setWithContent(event.target.checked)} />
          자료 본문도 넣기 (기본은 빼요. 자료 이름과 주소만 들어가요)
        </label>
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadBytes(new TextEncoder().encode(exportOrder(order, { materialContent: withContent })), `${safeFileName(order.title || 'order')}.order.json`, 'application/json')}
          >
            <Download aria-hidden />
            주문 내려받기
          </Button>
        </div>
      </section>
    </div>
  );
}
