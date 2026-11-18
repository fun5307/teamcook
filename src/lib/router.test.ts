import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

describe('화면 주소', () => {
  it('웹과 작업실의 주소를 알아본다', () => {
    expect(parseRoute('#/')).toEqual({ page: 'home' });
    expect(parseRoute('#/recipes')).toEqual({ page: 'gallery' });
    expect(parseRoute('#/workshop')).toEqual({ page: 'workshop' });
    expect(parseRoute('#/team')).toEqual({ page: 'team' });
    expect(parseRoute('#/journal')).toEqual({ page: 'journal' });
  });

  it('숨긴 화면도 주소로는 들어갈 수 있다 (주문서 시작·목록)', () => {
    expect(parseRoute('#/orders/new')).toEqual({ page: 'order-start' });
    expect(parseRoute('#/orders')).toEqual({ page: 'orders' });
    expect(parseRoute('#/order/abc')).toEqual({ page: 'order', id: 'abc' });
  });
});
