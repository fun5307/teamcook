// 주문 저장소. 실습 기록 저장소와 같은 방식: 먼저 브라우저에 저장해 보고, 성공했을 때만 화면 상태를 바꾼다.

import { create } from 'zustand';
import { loadOrders, saveOrders, type OrderData, type SaveResult } from '@/lib/order/schema';
import type { OrderDraft } from '@/lib/order/types';
import { nowIso } from '@/lib/practice/time';

interface OrdersState extends OrderData {
  saveError: string | null;
  commit: (change: (data: OrderData) => OrderData) => SaveResult;
}

export const useOrders = create<OrdersState>()((set, get) => ({
  ...loadOrders(),
  saveError: null,
  commit: (change) => {
    const { version, orders, unreadable } = get();
    const next = change({ version, orders, unreadable });
    const result = saveOrders(next);
    if (result.ok) set({ ...next, saveError: null });
    else set({ saveError: result.message });
    return result;
  },
}));

/** 주문을 저장한다 (없으면 더하고, 있으면 바꾼다). 바꿀 때마다 수정 번호가 오른다. */
export function putOrder(order: OrderDraft): SaveResult {
  return useOrders.getState().commit((data) => {
    const exists = data.orders.some((item) => item.id === order.id);
    const stamped = { ...order, updatedAt: nowIso() };
    return {
      ...data,
      orders: exists
        ? data.orders.map((item) => (item.id === order.id ? { ...stamped, revision: item.revision + 1 } : item))
        : [stamped, ...data.orders],
    };
  });
}

export function removeOrder(id: string): SaveResult {
  return useOrders.getState().commit((data) => ({ ...data, orders: data.orders.filter((item) => item.id !== id) }));
}
