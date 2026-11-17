// 앱 전체 상태. 서버 없이 브라우저의 localStorage에 자동 저장한다.
// 저장하는 것: 내 레시피 목록, 내 AI 현황(플랜). API 키 "값"은 어디에도 저장하지 않는다.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderId, Recipe, UserPlans } from '../types';
import { parseRecipe } from '../lib/recipeSchema';

/**
 * 저장돼 있던 레시피를 읽는다. 옛 형식은 지금 형식으로 바꾸고(parseRecipe),
 * 읽지 못한 것은 버리지 않고 unreadable에 그대로 둔다 (다음에 저장할 때 사라지지 않게).
 * 전에 못 읽어 보관해 둔 것도 다시 읽어 본다.
 */
export function loadSavedRecipes(
  savedRecipes: unknown,
  savedUnreadable: unknown,
): { recipes: Recipe[]; unreadable: unknown[] } {
  const recipes: Recipe[] = [];
  const unreadable: unknown[] = [];
  const items = [
    ...(Array.isArray(savedRecipes) ? savedRecipes : []),
    ...(Array.isArray(savedUnreadable) ? savedUnreadable : []),
  ];
  for (const item of items) {
    try {
      recipes.push(parseRecipe(item));
    } catch {
      unreadable.push(item);
    }
  }
  return { recipes, unreadable };
}

/** 처음 온 사람의 기본값: 모두 무료 계정이라고 가정한다. */
export const DEFAULT_PLANS: UserPlans = {
  openai: 'free',
  anthropic: 'free',
  google: 'none',
  xai: 'none',
  apiKeys: {},
};

interface AppState {
  /** 내가 만들거나 가져온 레시피 */
  recipes: Recipe[];
  plans: UserPlans;
  /** 사용자가 '내 AI 현황'을 한 번이라도 직접 고쳤는지 */
  plansConfirmed: boolean;
  /**
   * 이 버전이 읽지 못한 저장 데이터 (더 새로운 형식이거나 깨진 것). 지우거나 덮어쓰지 않고 그대로 보관한다.
   * 새 버전의 사이트에서 다시 열면 읽을 수 있다.
   */
  unreadable: unknown[];

  /** 레시피를 추가하거나(새 id) 덮어쓴다(같은 id) */
  saveRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  setPlan: <P extends ProviderId>(provider: P, plan: UserPlans[P]) => void;
  setApiKey: (provider: ProviderId, has: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      recipes: [],
      plans: DEFAULT_PLANS,
      plansConfirmed: false,
      unreadable: [],

      saveRecipe: (recipe) =>
        set((state) => {
          const exists = state.recipes.some((item) => item.id === recipe.id);
          return {
            recipes: exists
              ? state.recipes.map((item) => (item.id === recipe.id ? recipe : item))
              : [recipe, ...state.recipes],
          };
        }),

      removeRecipe: (id) =>
        set((state) => ({ recipes: state.recipes.filter((item) => item.id !== id) })),

      setPlan: (provider, plan) =>
        set((state) => ({ plans: { ...state.plans, [provider]: plan }, plansConfirmed: true })),

      setApiKey: (provider, has) =>
        set((state) => ({
          plans: { ...state.plans, apiKeys: { ...state.plans.apiKeys, [provider]: has } },
          plansConfirmed: true,
        })),
    }),
    {
      // 저장 이름은 옛 가칭 그대로 둔다. 바꾸면 이미 저장된 사용자 레시피가 사라진다.
      name: 'agent-recipes',
      version: 1,
      // 저장된 데이터가 깨졌거나 옛 모양이어도 앱이 죽지 않게, 읽을 때 한 번 다듬는다.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        const { recipes, unreadable } = loadSavedRecipes(saved.recipes, saved.unreadable);
        return {
          ...current,
          recipes,
          unreadable,
          plans: { ...DEFAULT_PLANS, ...(saved.plans ?? {}), apiKeys: { ...(saved.plans?.apiKeys ?? {}) } },
          plansConfirmed: saved.plansConfirmed === true,
        };
      },
    },
  ),
);
