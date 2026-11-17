// 기본 레시피 묶음 점검: 개수, 이름 규칙, 상황별 묶음.

import { describe, expect, it } from 'vitest';
import { AGENT_NAME_PATTERN } from './tips';
import { SHELVES, moreRecipes } from './moreRecipes';
import { builtinRecipes } from './recipes';
import { parseRecipe } from '../lib/recipeSchema';
import { buildRecipeFiles } from '../lib/exportZip';
import { providerData } from './providers';
import { DETAILED_RECIPE_IDS } from './recipeDetails';
import { checkRecipe } from '../lib/exportCheck';

describe('기본 레시피', () => {
  it('21종이고 id가 겹치지 않는다', () => {
    expect(builtinRecipes).toHaveLength(21);
    expect(moreRecipes).toHaveLength(16);
    expect(new Set(builtinRecipes.map((recipe) => recipe.id)).size).toBe(21);
  });

  it('모든 레시피가 형식 검사를 그대로 통과한다 (공유 링크로 보내도 똑같다)', () => {
    for (const recipe of builtinRecipes) {
      expect(parseRecipe(JSON.parse(JSON.stringify(recipe)))).toEqual(recipe);
    }
  });

  it('에이전트 이름은 파일 이름으로 쓸 수 있고, 한 레시피 안에서 겹치지 않는다', () => {
    for (const recipe of builtinRecipes) {
      const names = recipe.cards.map((card) => card.name);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(name).toMatch(AGENT_NAME_PATTERN);
      expect(recipe.cards.length).toBeGreaterThanOrEqual(2);
      expect(recipe.title).not.toBe('');
      expect(recipe.summary.length).toBeGreaterThan(20);
    }
  });

  it('넘겨주기는 같은 레시피 안의 카드만 가리킨다', () => {
    for (const recipe of builtinRecipes) {
      const ids = new Set(recipe.cards.map((card) => card.id));
      for (const handoff of recipe.handoffs) {
        expect(ids.has(handoff.from)).toBe(true);
        expect(ids.has(handoff.to)).toBe(true);
      }
    }
  });

  it('실제로 돌려 보지 않은 레시피에는 "실제 실행 확인" 기록을 적지 않는다', () => {
    // 사용자가 실제 도구에서 확인한 것은 'Claude 작성 + Codex 교차 검토' 하나뿐이다
    for (const recipe of builtinRecipes) {
      const ran = (recipe.verification ?? []).some((record) => record.kind === 'run');
      expect(ran).toBe(recipe.id === 'builtin-cross-review');
    }
  });

  it('모든 기본 레시피에 보완 내용이 있고, 내보내기 점검에 "수정 필요"가 없다', () => {
    expect([...DETAILED_RECIPE_IDS].sort()).toEqual(builtinRecipes.map((recipe) => recipe.id).sort());
    for (const recipe of builtinRecipes) {
      const errors = checkRecipe(recipe, providerData).filter((issue) => issue.level === 'error');
      expect(errors.map((issue) => issue.code)).toEqual([]);
    }
  });

  it('모든 레시피를 zip 파일 목록으로 내보낼 수 있다', () => {
    for (const recipe of builtinRecipes) {
      const files = buildRecipeFiles(recipe, providerData);
      expect(Object.keys(files).some((path) => path.endsWith('RECIPE.md'))).toBe(true);
    }
  });
});

describe('첫 화면의 상황별 묶음', () => {
  it('모든 기본 레시피가 정확히 한 묶음에 들어 있다', () => {
    const placed = SHELVES.flatMap((shelf) => shelf.recipeIds);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(builtinRecipes.map((recipe) => recipe.id).sort());
  });

  it('묶음마다 이름과 설명이 있고 레시피가 2개 이상이다', () => {
    for (const shelf of SHELVES) {
      expect(shelf.label).not.toBe('');
      expect(shelf.hint).not.toBe('');
      expect(shelf.recipeIds.length).toBeGreaterThanOrEqual(2);
    }
  });
});
