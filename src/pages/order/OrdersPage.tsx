// 주문 목록 (#/orders): 이어서 하기, 주문 파일 가져오기, 지우기.
// '이 레시피로 작업 설계'(StartOrderButton)도 여기 둔다.

import { useRef, useState } from 'react';
import { FileUp, ListTodo, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice, PageHeader } from '@/components/common';
import { newOrder } from '@/lib/order/draft';
import { importOrder, OrderFormatError } from '@/lib/order/schema';
import { orderFromRecipe } from '@/lib/order/toRecipe';
import { STATUS_LABELS, STEP_LABELS } from '@/lib/order/types';
import { formatLocal } from '@/lib/practice/time';
import { navigate } from '@/lib/router';
import { putOrder, removeOrder, useOrders } from '@/store/useOrders';
import type { Recipe } from '@/types';

/** 기존 레시피의 역할·작업을 초안으로 가져와 주문을 시작한다. 원본 레시피는 바꾸지 않는다. */
export function StartOrderButton({ recipe }: { recipe: Recipe }) {
  return (
    <Button
      variant="ghost"
      onClick={() => {
        const order = orderFromRecipe(recipe, newOrder());
        if (putOrder(order).ok) navigate(`/order/${order.id}`);
      }}
    >
      <ListTodo aria-hidden />이 레시피로 작업 설계
    </Button>
  );
}

export function OrdersPage() {
  const orders = useOrders((state) => state.orders);
  const unreadable = useOrders((state) => state.unreadable);
  const saveError = useOrders((state) => state.saveError);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const order = importOrder(await file.text(), orders);
      const result = putOrder(order);
      setMessage(result.ok ? { tone: 'success', text: `"${order.title || '이름 없는 주문'}"을(를) 가져왔어요.` } : { tone: 'error', text: result.message });
    } catch (error) {
      setMessage({ tone: 'error', text: `가져오지 않았어요. ${error instanceof OrderFormatError ? error.message : '파일을 읽지 못했어요.'} 기존 주문은 그대로예요.` });
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="주문"
        description="작업 설계를 이어서 하거나, 저장해 둔 주문 파일을 가져와요."
        actions={
          <>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <FileUp aria-hidden />
              주문 파일 가져오기
            </Button>
            <Button asChild>
              <a href="#/">새 주문</a>
            </Button>
          </>
        }
      />
      <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void onImport(event.target.files?.[0])} />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
      {unreadable.length > 0 ? <Notice tone="warn">이 버전이 읽지 못한 주문 {unreadable.length}개를 지우지 않고 보관하고 있어요.</Notice> : null}
      {orders.length === 0 ? <p className="text-muted-foreground">아직 주문이 없어요. 첫 화면에서 이루고 싶은 일을 적어 보세요.</p> : null}
      <ul className="flex flex-col gap-2">
        {orders.map((order) => (
          <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
            <a href={order.step === 'request' ? '#/' : `#/order/${encodeURIComponent(order.id)}`} className="min-w-0 flex-1 hover:underline">
              <span className="block font-medium">{order.title || order.request.text.split('\n')[0]?.slice(0, 60) || '이름 없는 주문'}</span>
              <span className="text-xs text-muted-foreground">
                {STATUS_LABELS[order.status]} · {STEP_LABELS[order.step]} · 작업 {order.work.length} · {formatLocal(order.updatedAt)}
              </span>
            </a>
            {confirmId === order.id ? (
              <span className="flex items-center gap-2 text-sm">
                지울까요? 만든 레시피와 실습 기록은 남아요.
                <Button size="xs" variant="outline" onClick={() => { removeOrder(order.id); setConfirmId(null); }}>
                  지우기
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setConfirmId(null)}>
                  취소
                </Button>
              </span>
            ) : (
              <Button size="icon-sm" variant="ghost" aria-label={`${order.title} 지우기`} onClick={() => setConfirmId(order.id)}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
