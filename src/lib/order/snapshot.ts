// 주문 → 실습 기록용 복사본. 원문·확정 내용·작업만 담고, 자료는 이름·종류·상태만 담는다 (본문은 넣지 않는다).

import type { OrderSnapshot } from '../practice/types';
import { includedWork } from './toRecipe';
import type { OrderDraft } from './types';

export function orderSnapshot(order: OrderDraft): OrderSnapshot {
  return {
    orderId: order.id,
    revision: order.revision,
    title: order.title,
    requestText: order.request.text,
    materials: order.request.materials.map((item) => ({ name: item.name, kind: item.kind, status: item.status })),
    requirements: order.requirements.filter((item) => item.state === 'accepted').map((item) => ({ kind: item.kind, text: item.text })),
    work: includedWork(order).map((item) => ({ id: item.id, title: item.title, outputs: item.outputs.map((out) => out.name), criteria: [...item.criteria] })),
    open: order.questions.filter((item) => item.state !== 'answered').map((item) => item.text),
  };
}
