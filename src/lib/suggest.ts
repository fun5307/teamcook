// "~한 작업을 하고 싶다"는 말에 맞는 레시피를 제안한다.
// AI를 부르지 않는다 (서버·API 키가 없다). 낱말 맞추기 + 내 플랜 + 사용량 여유로 점수를 매긴다.
// 그래서 결과마다 "왜 골랐는지"를 함께 돌려준다.

import { SHELVES } from '../data/moreRecipes';
import type { ProviderData, Recipe, UserPlans } from '../types';
import { costOutlook, USAGE_LABELS, type Budget, type CostOutlook } from './cost';
import { fitsMyPlans } from './requiredPlans';

/** 상황 묶음(SHELVES)마다, 사용자가 쓸 법한 낱말 */
export const INTENT_WORDS: Record<string, string[]> = {
  build: ['만들', '구현', '개발', '추가', '기능', '화면', '페이지', '앱', '사이트', '업그레이드', '마이그레이션', '버전', '코딩', 'ui', '디자인'],
  fix: ['버그', '오류', '에러', '고치', '고장', '안돼', '안 돼', '원인', '디버그', '리팩터', '리팩토링', '정리', '테스트', '느려', '깨져'],
  review: ['리뷰', '검토', '점검', '보안', '취약', '검수', '확인받', '코드리뷰', 'pr'],
  research: ['조사', '알아보', '찾아', '분석', '파악', '이해', '자료', '시장', '데이터', '비교', '타당성', 'graphrag', '리서치', '공부'],
  write: ['글', '문서', '블로그', '보고서', '작성', '쓰기', '써줘', '초안', '번역', '설명서', 'readme', '기사'],
  decide: ['결정', '고민', '선택', '정하', '토론', '장단점', '어느', '뭐가 나', '아이디어', '브레인스토밍', '설계안'],
};

/** 뜻이 없어 점수에 넣지 않는 낱말 */
const STOP_WORDS = new Set([
  '싶어', '싶다', '싶은', '싶어요', '하고', '해줘', '해서', '하는', '작업', '그리고', '우리', '내가', '이거', '어떻게',
  '있는', '있어', '위한', '대한', '좀', '것', '수', '를', '을', '이', '가', '하려고', '합니다', '해요', '할래', '원해', '중에', '중에서', '관련', '대해',
]);

export interface Suggestion {
  recipe: Recipe;
  score: number;
  /** 왜 골랐는지 (화면에 그대로 보여 준다) */
  reasons: string[];
  fit: ReturnType<typeof fitsMyPlans>;
  cost: CostOutlook;
}

function words(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.!?~·/()[\]"']+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

/** 낱말이 글에 들어 있으면 맞은 부분을 돌려준다. 조사가 붙은 낱말("버그를")은 앞 두 글자 이상이 맞으면 인정한다. */
function hit(text: string, word: string): string | null {
  for (let length = word.length; length >= 2; length -= 1) {
    if (text.includes(word.slice(0, length))) return word.slice(0, length);
  }
  return null;
}

const shelfOf = (recipeId: string) => SHELVES.find((shelf) => shelf.recipeIds.includes(recipeId));

/**
 * 제안 목록 (점수 높은 순, 기본 3개). 과제와 맞는 낱말이 하나도 없는 레시피는 넣지 않는다.
 * 점수: 과제 맞춤(제목 3, 쓰임새 2, 상황 묶음 3, 설명·역할 1) + 내 플랜(+2/+1/−2) + 사용량 여유.
 */
export function suggestRecipes(
  query: string,
  recipes: Recipe[],
  plans: UserPlans,
  providers: ProviderData,
  budget: Budget = 'normal',
  limit = 3,
): Suggestion[] {
  const list = words(query);
  if (list.length === 0) return [];
  const lowered = query.toLowerCase();
  const intents = Object.entries(INTENT_WORDS)
    .filter(([, keys]) => keys.some((key) => lowered.includes(key)))
    .map(([id]) => id);

  const results: Suggestion[] = [];
  for (const recipe of recipes) {
    const title = recipe.title.toLowerCase();
    const useCase = recipe.useCase.toLowerCase();
    const body = [recipe.summary, recipe.learningObjective ?? '', recipe.sampleTask ?? '', ...recipe.cards.map((card) => card.role)]
      .join(' ')
      .toLowerCase();
    let match = 0;
    const matched: string[] = [];
    for (const word of list) {
      const found: [string | null, number][] = [
        [hit(title, word), 3],
        [hit(useCase, word), 2],
        [hit(body, word), 1],
      ];
      const best = found.find(([part]) => part !== null);
      if (best) {
        match += best[1];
        if (!matched.includes(best[0]!)) matched.push(best[0]!);
      }
    }
    const shelf = shelfOf(recipe.id);
    const inIntent = shelf !== undefined && intents.includes(shelf.id);
    if (inIntent) match += 3;
    if (match === 0) continue;

    const reasons: string[] = [];
    if (inIntent) reasons.push(`"${shelf!.label}"에 쓰는 레시피예요`);
    if (matched.length > 0) reasons.push(`"${matched.slice(0, 3).join('", "')}"와 맞아요`);

    let score = match;
    const fit = fitsMyPlans(recipe, plans, providers);
    if (fit === 'full') {
      score += 2;
      reasons.push('내 플랜으로 그대로 돼요');
    } else if (fit === 'with-alternatives') {
      score += 1;
      reasons.push('도구를 바꾸면 내 플랜으로 돼요');
    } else {
      score -= 2;
      reasons.push('내 플랜으로는 직접 붙여 넣어야 하는 역할이 있어요');
    }

    const cost = costOutlook(recipe, plans, providers);
    const level = cost.usage.level;
    if (budget === 'save') {
      if (level === 'light') {
        score += 2;
        reasons.push('사용량이 가벼워요');
      } else if (level === 'heavy') {
        score -= 2;
        reasons.push('사용량이 무거워 아껴 쓰기에는 맞지 않아요');
      }
      if (cost.metered > 0) {
        score -= 1;
        reasons.push('API 키로 쓴 만큼 돈이 나가요');
      }
    } else if (level === 'heavy' && (cost.freeTier > 0 || budget === 'normal')) {
      // 무거운 레시피는 무료 한도로는 끝까지 못 갈 수 있다. 보통일 때는 알려만 준다.
      if (cost.freeTier > 0) score -= 1;
      reasons.push(cost.freeTier > 0 ? '무거운 레시피라 무료 한도로는 중간에 멈출 수 있어요' : `사용량 ${USAGE_LABELS[level]}`);
    }
    results.push({ recipe, score, reasons, fit, cost });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
