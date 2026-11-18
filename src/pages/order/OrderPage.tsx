// 주문 설계 작업 공간 (#/order/<id>): 주문 정리 → 작업 설계 → 팀 제안 → 실행 준비.
// 왼쪽은 편집, 오른쪽은 영수증 모양의 주문 요약. 고칠 때마다 저장되고, 저장에 실패하면 알린다.
// '작업 설계하기'와 이 화면 어디에도 실행 버튼은 없다. 실행은 내보낸 파일로 Claude Code·Codex에서 한다.

import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { SectionTabs } from '@/components/practice/PracticeParts';
import { TYPE_LABELS, type RequestType } from '@/lib/order/draft';
import { redraftAdditions, requestChanged, staleEvidence } from '@/lib/order/ops';
import { MATERIAL_STATUS_LABELS } from '@/lib/order/materials';
import type { OrderDraft, OrderStep, Requirement, RequirementKind } from '@/lib/order/types';
import { Receipt, QuestionsPanel, RequirementGroup } from '@/pages/order/parts';
import { ReadyStep } from '@/pages/order/ReadyStep';
import { TeamStep } from '@/pages/order/TeamStep';
import { WorkStep } from '@/pages/order/WorkStep';
import { putOrder, useOrders } from '@/store/useOrders';
import { useStore } from '@/store/useStore';

type DesignStep = Exclude<OrderStep, 'request'>;
const STEPS: { id: DesignStep; label: string }[] = [
  { id: 'define', label: '① 주문 정리' },
  { id: 'work', label: '② 작업 설계' },
  { id: 'team', label: '③ 팀 제안' },
  { id: 'ready', label: '④ 실행 준비' },
];

export interface StepProps {
  order: OrderDraft;
  save: (next: OrderDraft) => void;
  go: (step: DesignStep) => void;
}

function DefineStep({ order, save, go }: StepProps) {
  const [review, setReview] = useState<Requirement[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [editRequest, setEditRequest] = useState(false);
  const stale = new Map(staleEvidence(order).map((item) => [item.id, item.reason]));
  const sourceName = (id: string) =>
    id === 'request' ? '요청 원문' : (order.request.materials.find((item) => item.id === id)?.name ?? '삭제된 자료');
  const setRequirements = (requirements: Requirement[]) => save({ ...order, requirements });
  const basic: RequirementKind[] = ['goal', 'deliverable', 'success'];
  const proposedBasic = order.requirements.filter((item) => basic.includes(item.kind) && item.state === 'proposed');

  return (
    <div className="flex flex-col gap-6">
      {requestChanged(order) ? (
        <Notice tone="warn" className="flex flex-col gap-2">
          <span>정리한 뒤 원문이 바뀌었어요. 정리한 내용은 그대로 두었어요 (자동으로 덮어쓰지 않아요).</span>
          {review === null ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { const added = redraftAdditions(order); setReview(added); setPicked(added.map((item) => item.id)); }}>
                바뀐 원문으로 다시 정리해 보기
              </Button>
              <Button size="sm" variant="ghost" onClick={() => save({ ...order, request: { ...order.request, textAtDraft: order.request.text } })}>
                이대로 두기
              </Button>
            </div>
          ) : review.length === 0 ? (
            <span>새로 나온 항목이 없어요. 근거가 사라진 항목은 아래에 표시했어요.</span>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">새로 나온 항목 (고른 것만 더해요. 기존 항목은 지우지 않아요)</span>
              {review.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={picked.includes(item.id)} onChange={() => setPicked(picked.includes(item.id) ? picked.filter((id) => id !== item.id) : [...picked, item.id])} />
                  <span>
                    <span className="font-medium">[{item.kind === 'goal' ? '목표' : item.kind === 'success' ? '성공 조건' : item.kind === 'constraint' ? '조건' : item.kind === 'exclusion' ? '제외' : item.kind === 'current' ? '현재 상태' : '결과물'}]</span> {item.text}
                  </span>
                </label>
              ))}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { save({ ...order, requirements: [...order.requirements, ...review.filter((item) => picked.includes(item.id))], request: { ...order.request, textAtDraft: order.request.text } }); setReview(null); }}>
                  고른 것 더하기
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReview(null)}>
                  닫기
                </Button>
              </div>
            </div>
          )}
        </Notice>
      ) : null}

      <QuestionsPanel order={order} onChange={(questions) => save({ ...order, questions })} />

      {proposedBasic.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm">
          <span>규칙이 뽑은 제안 {proposedBasic.length}개가 확정을 기다려요. 확정한 것만 레시피에 들어가요.</span>
          <Button size="sm" variant="outline" onClick={() => setRequirements(order.requirements.map((item) => (basic.includes(item.kind) && item.state === 'proposed' ? { ...item, state: 'accepted' } : item)))}>
            <Check aria-hidden />
            목표·결과물·성공 조건 모두 확정
          </Button>
        </div>
      ) : null}

      <RequirementGroup order={order} kind="goal" hint="무엇을 이루려는지 한 문장으로" staleMap={stale} sourceName={sourceName} onChange={setRequirements} />
      <RequirementGroup order={order} kind="deliverable" hint="끝나면 손에 쥘 것" staleMap={stale} sourceName={sourceName} onChange={setRequirements} />
      <RequirementGroup order={order} kind="success" hint="이렇게 되면 성공" staleMap={stale} sourceName={sourceName} onChange={setRequirements} />

      <details className="rounded-xl border bg-card p-4" open={order.requirements.some((item) => ['current', 'constraint', 'exclusion'].includes(item.kind) && item.state === 'proposed')}>
        <summary className="cursor-pointer font-heading text-lg font-extrabold">
          더 적기 <span className="font-sans text-sm font-normal text-muted-foreground">현재 상태, 반드시 지킬 조건, 제외 범위, 자료와 원문</span>
        </summary>
        <div className="mt-4 flex flex-col gap-6">
          <RequirementGroup order={order} kind="current" staleMap={stale} sourceName={sourceName} onChange={setRequirements} />
          <RequirementGroup order={order} kind="constraint" hint="모든 작업이 물려받아요" staleMap={stale} sourceName={sourceName} onChange={setRequirements} />
          <RequirementGroup order={order} kind="exclusion" hint="이번에 하지 않을 것" staleMap={stale} sourceName={sourceName} onChange={setRequirements} />
          <section className="flex flex-col gap-2" aria-label="참고 자료">
            <h3 className="font-heading text-lg font-extrabold">참고 자료</h3>
            {order.request.materials.length === 0 ? <p className="text-sm text-muted-foreground">넣은 자료가 없어요.</p> : null}
            <ul className="flex flex-col gap-1.5">
              {order.request.materials.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{item.name}</span>{' '}
                    <span className="text-xs text-muted-foreground">{MATERIAL_STATUS_LABELS[item.status]}{item.url ? ` · ${item.url}` : ''}</span>
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => save({ ...order, request: { ...order.request, materials: order.request.materials.filter((entry) => entry.id !== item.id) } })}
                  >
                    자료 빼기
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">자료를 빼도 그 자료에서 뽑은 항목은 지우지 않고 "근거가 사라졌어요"로 표시해요.</p>
          </section>
          <section className="flex flex-col gap-2" aria-label="요청 원문">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-extrabold">요청 원문</h3>
              <Button size="xs" variant="ghost" onClick={() => setEditRequest(!editRequest)}>
                {editRequest ? '다 고쳤어요' : '원문 고치기'}
              </Button>
            </div>
            {editRequest ? (
              <textarea
                aria-label="요청 원문 고치기"
                rows={6}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={order.request.text}
                onChange={(event) => save({ ...order, request: { ...order.request, text: event.target.value } })}
              />
            ) : (
              <p className="max-h-60 overflow-y-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{order.request.text || '(원문 없음)'}</p>
            )}
          </section>
        </div>
      </details>

      <div>
        <Button onClick={() => go('work')}>
          다음: 작업 설계 <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function OrderPage({ id }: { id: string }) {
  const order = useOrders((state) => state.orders.find((item) => item.id === id));
  const saveError = useOrders((state) => state.saveError);
  const recipes = useStore((state) => state.recipes);
  if (!order) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warn">이 주문을 찾을 수 없어요.</Notice>
        <a className="underline" href="#/orders">
          주문 목록
        </a>
      </div>
    );
  }
  const step: DesignStep = order.step === 'request' ? 'define' : order.step;
  const save = (next: OrderDraft) => {
    putOrder(next);
  };
  const go = (next: DesignStep) => {
    save({ ...order, step: next });
    window.scrollTo(0, 0);
  };
  const linked = order.link ? recipes.find((item) => item.id === order.link!.recipeId) : undefined;
  const props: StepProps = { order, save, go };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <a className="underline underline-offset-2 hover:text-primary" href="#/orders">
            주문
          </a>
          <span>·</span>
          <span>규칙 기반 초안{order.detected.length > 0 ? `: ${order.detected.map((type) => TYPE_LABELS[type as RequestType] ?? type).join(' + ')}로 알아봤어요` : ' (유형을 알아보지 못해 원문만 담았어요. 직접 채워 주세요)'}</span>
        </p>
        <input
          aria-label="주문 이름"
          className="w-full rounded-md bg-transparent font-heading text-3xl font-extrabold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-4xl"
          value={order.title}
          onChange={(event) => save({ ...order, title: event.target.value })}
        />
      </div>
      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
      <SectionTabs label="주문 단계" items={STEPS} current={step} onChange={go} />

      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {step === 'define' ? <DefineStep {...props} /> : null}
          {step === 'work' ? <WorkStep {...props} /> : null}
          {step === 'team' ? <TeamStep {...props} /> : null}
          {step === 'ready' ? <ReadyStep {...props} /> : null}
        </div>
        <aside className="lg:sticky lg:top-24">
          <details className="lg:hidden" aria-label="주문 요약 펼치기">
            <summary className="cursor-pointer text-sm font-medium">주문 요약 보기</summary>
            <div className="mt-2">
              <Receipt order={order} recipeTitle={linked?.title} />
            </div>
          </details>
          <div className="hidden lg:block">
            <Receipt order={order} recipeTitle={linked?.title} />
          </div>
        </aside>
      </div>
    </div>
  );
}
