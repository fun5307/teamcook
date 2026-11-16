import { describe, expect, it } from 'vitest';
import { builtinRecipes } from '../data/recipes';
import { layoutFlow } from './flowLayout';

const [crossReview, planBuildReview, researchTeam] = builtinRecipes;

describe('흐름 캔버스 자동 배치', () => {
  it('작성자 → 검토자 → 작성자: 되돌아오는 화살표는 자리를 바꾸지 않는다', () => {
    expect(layoutFlow(crossReview)).toEqual({
      'cr-writer': { level: 0, row: 0 },
      'cr-reviewer': { level: 1, row: 0 },
    });
  });

  it('기획 → 구현 → 검토는 왼쪽에서 오른쪽으로 세 단계', () => {
    const layout = layoutFlow(planBuildReview);
    expect(layout['pbr-planner'].level).toBe(0);
    expect(layout['pbr-implementer'].level).toBe(1);
    expect(layout['pbr-reviewer'].level).toBe(2);
  });

  it('조사원 둘은 같은 단계에 위아래로, 정리원은 다음 단계', () => {
    expect(layoutFlow(researchTeam)).toEqual({
      'rt-facts': { level: 0, row: 0 },
      'rt-risks': { level: 0, row: 1 },
      'rt-synth': { level: 1, row: 0 },
    });
  });

  it('흐름에 없는 카드는 마지막 단계 다음에 모은다', () => {
    const extra = { ...crossReview.cards[0], id: 'lonely', name: 'lonely' };
    const layout = layoutFlow({ ...crossReview, cards: [...crossReview.cards, extra] });
    expect(layout.lonely).toEqual({ level: 2, row: 0 });
  });

  it('흐름이 하나도 없으면 한 줄로 세운다', () => {
    const layout = layoutFlow({ ...planBuildReview, handoffs: [] });
    expect(Object.values(layout).map((position) => position.row)).toEqual([0, 1, 2]);
    expect(Object.values(layout).every((position) => position.level === 0)).toBe(true);
  });
});
