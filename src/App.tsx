// 앱 틀. 문이 두 개다.
// - 웹 (teamcook-eta.vercel.app): 처음 해 보는 사람에게 레시피를 권하고 받아 가게 한다. 말투는 요리(레시피·재료).
// - 작업실 (teamcook open이 띄운 화면): 이미 팀을 돌리는 사람이 팀원을 보고 고치고 보고받는다. 말투는 회사(팀원·업무 일지).
// 코드는 하나이고, 도우미가 띄운 화면인지(isLocal)로 틀을 고른다. 사용자가 고를 필요가 없다.
// 숨긴 화면(주문서 #/orders, 실습 기록 #/runs)은 주소로만 들어갈 수 있고 메뉴·링크에는 없다.

import { CircleHelp, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isLocal } from '@/lib/local/client';
import { type Route, useRoute } from '@/lib/router';
import { ConceptsPage } from '@/pages/ConceptsPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { HomePage } from '@/pages/HomePage';
import { WorkshopPage } from '@/pages/WorkshopPage';
import { TeamPage } from '@/pages/team/TeamPage';
import { OrderPage } from '@/pages/order/OrderPage';
import { OrdersPage } from '@/pages/order/OrdersPage';
import { OrderStartPage } from '@/pages/order/OrderStartPage';
import { HowToRunPage } from '@/pages/HowToRunPage';
import { MyPlansPage } from '@/pages/MyPlansPage';
import { ComparisonPage } from '@/pages/practice/ComparisonPage';
import { PracticeListPage } from '@/pages/practice/PracticeListPage';
import { PracticeNewPage } from '@/pages/practice/PracticeNewPage';
import { PracticeRunPage } from '@/pages/practice/PracticeRunPage';
import { RecipeEditorPage } from '@/pages/RecipeEditorPage';
import { BuiltinRecipePage, SharedRecipePage } from '@/pages/RecipePreviewPage';

interface NavItem {
  href: string;
  label: string;
  pages: Route['page'][];
}

const WEB_NAV: NavItem[] = [
  { href: '#/recipes', label: '레시피 책', pages: ['home', 'gallery', 'preview', 'edit', 'shared', 'learn'] },
  { href: '#/workshop', label: '작업실', pages: ['workshop', 'team', 'journal', 'activity'] },
];

const WORKSHOP_NAV: NavItem[] = [
  { href: '#/team', label: '팀원', pages: ['home', 'team'] },
  { href: '#/activity', label: '활동', pages: ['activity'] },
  { href: '#/journal', label: '업무 일지', pages: ['journal'] },
];

/** 두 문이 함께 쓰는 화면 */
function SharedPage({ route }: { route: Route }) {
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
      return <PracticeNewPage key={`${route.recipeId}-${route.taskId}-${route.orderId}`} recipeId={route.recipeId} taskId={route.taskId} orderId={route.orderId} />;
    case 'run':
      return <PracticeRunPage key={route.id} id={route.id} />;
    case 'compare':
      return <ComparisonPage key={route.id} id={route.id} />;
    case 'shared':
      return <SharedRecipePage key={route.encoded} encoded={route.encoded} />;
    case 'gallery':
      return <GalleryPage />;
    case 'order':
      return <OrderPage key={route.id} id={route.id} />;
    case 'orders':
      return <OrdersPage />;
    case 'order-start':
      return <OrderStartPage />;
    default:
      return null;
  }
}

function WebPage({ route }: { route: Route }) {
  switch (route.page) {
    case 'home':
      return <HomePage />;
    case 'workshop':
    case 'activity':
      // 활동은 내 컴퓨터 도우미가 있어야 볼 수 있어서, 웹에서는 작업실 소개로 안내한다
      return <WorkshopPage />;
    case 'team':
      return <TeamPage />;
    case 'journal':
      return <TeamPage key="journal" view="journal" />;
    default:
      return <SharedPage route={route} />;
  }
}

function WorkshopRoutePage({ route }: { route: Route }) {
  switch (route.page) {
    case 'home':
    case 'team':
    case 'workshop':
      return <TeamPage key="members" view="members" />;
    case 'activity':
      return <TeamPage key="activity" view="activity" />;
    case 'journal':
      return <TeamPage key="journal" view="journal" />;
    default:
      return <SharedPage route={route} />;
  }
}

function NavLinks({ items, route }: { items: NavItem[]; route: Route }) {
  return (
    <>
      {items.map((item) => {
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
    </>
  );
}

function IconLink({ href, label, title, active, icon: Icon }: { href: string; label: string; title: string; active: boolean; icon: typeof CircleHelp }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      title={title}
      className={cn('inline-flex items-center gap-1 text-xs transition-colors duration-200 hover:text-primary', active ? 'text-primary' : 'text-muted-foreground')}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </a>
  );
}

function Shell({ brand, nav, extra, footer, children }: { brand: React.ReactNode; nav: React.ReactNode; extra?: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-3.5">
          {brand}
          <nav className="flex flex-wrap items-center gap-x-7 gap-y-1" aria-label="주 메뉴">
            {nav}
            {extra}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground">{footer}</div>
      </footer>
    </div>
  );
}

function WebShell({ route }: { route: Route }) {
  return (
    <Shell
      brand={
        <a href="#/" className="font-heading text-2xl font-extrabold tracking-tight">
          teamcook
        </a>
      }
      nav={<NavLinks items={WEB_NAV} route={route} />}
      extra={
        <span className="flex items-center gap-x-4">
          <IconLink href="#/plans" label="내 AI" title="내가 쓰는 AI와 사용량 여유. 추천에 쓰여요" active={route.page === 'plans'} icon={Settings2} />
          <IconLink href="#/how" label="도움말" title="받은 파일을 어디서, 어떻게 돌리는지 알려 드려요" active={route.page === 'how'} icon={CircleHelp} />
        </span>
      }
      footer={
        <>
          <p>teamcook — 실행은 Claude Code·Codex에서, 팀 설계와 레시피는 여기서. 이 사이트는 AI를 실행하지 않아요.</p>
          <p>
            레시피와 내 AI 정보는 이 브라우저에만 저장돼요. 로그인도, 서버 저장도, API 키 입력도 없어요.{' '}
            <a className="underline underline-offset-2 hover:text-primary" href="#/learn">
              재료 사전
            </a>
          </p>
        </>
      }
    >
      <WebPage route={route} />
    </Shell>
  );
}

function WorkshopShell({ route }: { route: Route }) {
  return (
    <Shell
      brand={
        <a href="#/team" className="flex items-baseline gap-2">
          <span className="font-heading text-2xl font-extrabold tracking-tight">teamcook</span>
          <span className="rounded-md bg-foreground px-2 py-0.5 text-xs font-medium text-background">작업실</span>
        </a>
      }
      nav={<NavLinks items={WORKSHOP_NAV} route={route} />}
      extra={<IconLink href="#/how" label="도움말" title="역할 파일을 어디서, 어떻게 쓰는지 알려 드려요" active={route.page === 'how'} icon={CircleHelp} />}
      footer={
        <>
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-600" aria-hidden />
            작업실은 이 컴퓨터 안에서만 열려 있어요. AI를 실행하지 않고, 대화 기록은 읽기만 해요.
          </p>
          <p>끝내려면 도우미를 켠 터미널에서 Ctrl+C를 누르세요.</p>
        </>
      }
    >
      <WorkshopRoutePage route={route} />
    </Shell>
  );
}

export default function App() {
  const route = useRoute();
  return isLocal() ? <WorkshopShell route={route} /> : <WebShell route={route} />;
}
