// 웹 첫 화면 (#/): 처음 오는 사람에게 한 가지만 묻는다. "어떤 일을 AI 팀에게 맡길까요?"
// 적으면 레시피를 권하고(SuggestBox), 전체 목록은 레시피 책으로 넘긴다.
// 이미 팀을 돌리는 사람을 위한 '작업실'로 가는 다리는 맨 아래 한 줄뿐이다.
// 말투는 요리(레시피·재료)로 맞춘다. 팀원·업무 일지 같은 회사 말은 작업실에서 쓴다.

import { ArrowRight } from 'lucide-react';
import { SuggestBox } from '@/components/SuggestBox';
import { useStore } from '@/store/useStore';

const STEPS = ['하고 싶은 일 적기', '레시피 고르기', 'Claude Code·Codex에서 실행'];

export function HomePage() {
  const recipes = useStore((state) => state.recipes);
  return (
    <div className="flex flex-col gap-14 pt-2 sm:pt-6">
      <SuggestBox myRecipes={recipes}>
        <p className="text-sm font-medium text-primary">AI 팀을 레시피로 요리하세요</p>
        <h1 className="text-4xl leading-tight font-extrabold text-balance sm:text-6xl">
          어떤 일을
          <br />
          AI 팀에게 맡길까요?
        </h1>
        <p className="max-w-md text-base leading-relaxed text-pretty text-muted-foreground">
          하고 싶은 일을 적으면, 지금 쓰는 AI로 바로 돌릴 수 있는 팀 구성(레시피)을 권해 드려요. 무료 계정이어도 괜찮아요.
        </p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="쓰는 순서">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-foreground font-heading text-xs font-extrabold">
                {index + 1}
              </span>
              <span>{step}</span>
              {index < STEPS.length - 1 ? <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden /> : null}
            </li>
          ))}
        </ol>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a className="underline underline-offset-4 hover:text-primary" href="#/recipes">
            레시피 책 전체 보기
          </a>
          <a className="text-muted-foreground underline underline-offset-4 hover:text-primary" href="#/learn">
            멀티 에이전트가 처음이라면: 재료 사전
          </a>
        </p>
      </SuggestBox>

      <a
        href="#/workshop"
        className="group flex flex-wrap items-center justify-between gap-3 border-t-2 border-foreground pt-5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-heading text-xl font-extrabold">이미 Claude Code나 Codex로 팀을 돌리고 있나요?</span>
          <span className="text-sm text-muted-foreground">작업실에서 팀원을 보고 고치고, 누가 무슨 일을 했는지 보고받으세요.</span>
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium group-hover:text-primary">
          작업실 알아보기 <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </a>
    </div>
  );
}
