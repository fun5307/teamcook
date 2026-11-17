// 앱 틀: 위쪽 메뉴 + 화면 전환.

import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { providerData } from '@/data/providers';
import { type Route, useRoute } from '@/lib/router';
import { ConceptsPage } from '@/pages/ConceptsPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { HowToRunPage } from '@/pages/HowToRunPage';
import { MyPlansPage } from '@/pages/MyPlansPage';
import { PracticePanelButton } from '@/components/practice/PracticePanel';
import { ComparisonPage } from '@/pages/practice/ComparisonPage';
import { PracticeListPage } from '@/pages/practice/PracticeListPage';
import { PracticeNewPage } from '@/pages/practice/PracticeNewPage';
import { PracticeRunPage } from '@/pages/practice/PracticeRunPage';
import { RecipeEditorPage } from '@/pages/RecipeEditorPage';
import { BuiltinRecipePage, SharedRecipePage } from '@/pages/RecipePreviewPage';

const NAV: { href: string; label: string; pages: Route['page'][] }[] = [
  { href: '#/', label: '레시피', pages: ['gallery', 'preview', 'edit', 'shared'] },
  { href: '#/plans', label: '내 AI 현황', pages: ['plans'] },
  { href: '#/learn', label: '재료 사전', pages: ['learn'] },
];

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'preview':
      return <BuiltinRecipePage id={route.id} />;
    case 'edit':
      // key를 주어 다른 레시피로 옮기면 편집 상태(열린 카드 등)를 새로 시작한다
      return <RecipeEditorPage key={route.id} id={route.id} />;
    case 'plans':
      return <MyPlansPage />;
    case 'how':
      return <HowToRunPage />;
    case 'learn':
      return <ConceptsPage />;
    case 'runs':
      return <PracticeListPage />;
    case 'run-new':
      return <PracticeNewPage key={`${route.recipeId}-${route.taskId}`} recipeId={route.recipeId} taskId={route.taskId} />;
    case 'run':
      return <PracticeRunPage key={route.id} id={route.id} />;
    case 'compare':
      return <ComparisonPage key={route.id} id={route.id} />;
    case 'shared':
      return <SharedRecipePage key={route.encoded} encoded={route.encoded} />;
    default:
      return <GalleryPage />;
  }
}

export default function App() {
  const route = useRoute();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-3.5">
          <a href="#/" className="font-heading text-2xl font-extrabold tracking-tight">
            teamcook
          </a>
          <nav className="flex flex-wrap items-center gap-x-7 gap-y-1" aria-label="주 메뉴">
            {NAV.map((item) => {
              const active = item.pages.includes(route.page);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'nav-link text-[15px] transition-colors duration-200',
                    active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </a>
              );
            })}
            <a
              href="#/how"
              aria-current={route.page === 'how' ? 'page' : undefined}
              title="내보낸 파일을 어디서, 어떻게 돌리는지 알려 드려요"
              className={cn(
                'inline-flex items-center gap-1 text-xs transition-colors duration-200 hover:text-primary',
                route.page === 'how' ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <CircleHelp className="size-3.5" aria-hidden />
              도움말
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Page route={route} />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground">
          <p>teamcook — 실행은 어디서든, 팀 설계와 레시피는 여기서. 이 사이트는 에이전트를 직접 실행하지 않아요.</p>
          <div className="flex flex-wrap items-center gap-x-2">
            <span>부가 기능:</span>
            <PracticePanelButton route={route} />
            <span>밖에서 실습한 결과를 적고 비교해요.</span>
          </div>
          <p>
            레시피, 실습 기록, 내 AI 현황은 이 브라우저에만 저장됩니다. 로그인도, 서버 저장도, API 키 입력도 없어요. 요금제
            정보는 {providerData.lastVerified}에 확인했습니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
