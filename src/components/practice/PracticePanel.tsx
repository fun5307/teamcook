// 실습 기록은 레시피 설계(주 기능)와 따로 두는 부가 기능이다.
// 주 메뉴에 넣지 않고, 머리말의 작은 버튼으로 여는 옆 패널에서 들어간다.

import { useEffect, useRef } from 'react';
import { NotebookPen, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RunBadges } from '@/components/practice/PracticeParts';
import { builtinRecipes } from '@/data/recipes';
import type { Route } from '@/lib/router';
import { formatLocal } from '@/lib/practice/time';
import { usePractice } from '@/store/usePractice';
import { useStore } from '@/store/useStore';

const PRACTICE_PAGES: Route['page'][] = ['runs', 'run-new', 'run', 'compare'];

export function PracticePanelButton({ route }: { route: Route }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const runs = usePractice((state) => state.runs);
  const comparisons = usePractice((state) => state.comparisons);
  const myRecipes = useStore((state) => state.recipes);
  const active = PRACTICE_PAGES.includes(route.page);

  // 패널 안의 링크로 화면이 바뀌면 패널을 닫는다
  useEffect(() => {
    const close = () => dialog.current?.close();
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  // 지금 보고 있는 레시피가 있으면 그 레시피로 바로 기록을 만들 수 있게 한다
  const recipeId = route.page === 'preview' || route.page === 'edit' ? route.id : null;
  const recipe = recipeId ? [...myRecipes, ...builtinRecipes].find((item) => item.id === recipeId) : undefined;
  const recent = runs.filter((run) => !run.archived).slice(0, 5);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        title="밖에서 실습한 결과를 적고 비교하는 부가 기능"
        className={cn(
          'inline-flex items-center gap-1 text-xs transition-colors duration-200 hover:text-primary',
          active ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        <NotebookPen className="size-3.5" aria-hidden />
        실습 기록
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="practice-panel-title"
        className="m-0 ml-auto h-dvh max-h-none w-[min(24rem,100vw)] border-l bg-background p-0 text-foreground backdrop:bg-black/30"
      >
        <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="practice-panel-title" className="text-xl font-extrabold">
                실습 기록
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                필요할 때만 쓰는 부가 기능이에요. 레시피로 밖에서 실습한 결과를 적어 두고, 같은 과제의 다른 방식과 견주어 봐요.
              </p>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label="닫기" onClick={() => dialog.current?.close()}>
              <X />
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {recipe ? (
              <Button asChild>
                <a href={`#/runs/new?recipe=${encodeURIComponent(recipe.id)}`}>
                  <Plus aria-hidden />
                  이 레시피로 기록 만들기
                </a>
              </Button>
            ) : null}
            <Button asChild variant={recipe ? 'outline' : 'default'}>
              <a href="#/runs/new">
                <Plus aria-hidden />
                새 기록
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="#/runs">기록 전체 보기</a>
            </Button>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">최근 기록</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 없어요. "기록 전체 보기"에서 예제를 불러올 수 있어요.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recent.map((run) => (
                  <li key={run.id}>
                    <a
                      href={`#/run/${encodeURIComponent(run.id)}`}
                      className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2 hover:border-foreground/40"
                    >
                      <span className="text-sm font-medium">{run.title}</span>
                      <RunBadges run={run} />
                      <span className="text-xs text-muted-foreground">{formatLocal(run.updatedAt)} 수정</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {comparisons.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">비교</h3>
              <ul className="flex flex-col gap-1.5">
                {comparisons.slice(0, 3).map((comparison) => (
                  <li key={comparison.id}>
                    <a
                      href={`#/compare/${encodeURIComponent(comparison.id)}`}
                      className="block rounded-lg border bg-card px-3 py-2 text-sm hover:border-foreground/40"
                    >
                      {comparison.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
