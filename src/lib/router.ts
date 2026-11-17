// 아주 작은 화면 전환기. 주소의 # 뒤(hash)만 쓴다.
// 서버 설정 없이도 새로고침·공유가 되고, 공유 링크(#r=...)와 같은 방식이라 단순하다.

import { useEffect, useState } from 'react';
import { readShareHash } from './share';

export type Route =
  | { page: 'gallery' }
  | { page: 'preview'; id: string }
  | { page: 'edit'; id: string }
  | { page: 'plans' }
  | { page: 'how' }
  | { page: 'shared'; encoded: string }
  | { page: 'runs' }
  | { page: 'run-new'; recipeId?: string; taskId?: string }
  | { page: 'run'; id: string }
  | { page: 'compare'; id: string };

export function parseRoute(hash: string): Route {
  const encoded = readShareHash(hash);
  if (encoded !== null) return { page: 'shared', encoded };

  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const [, first, second] = path.split('/');
  if (first === 'runs' && second === 'new') {
    const params = new URLSearchParams(query);
    const route: Route = { page: 'run-new' };
    const recipeId = params.get('recipe');
    const taskId = params.get('task');
    if (recipeId) route.recipeId = recipeId;
    if (taskId) route.taskId = taskId;
    return route;
  }
  if (first === 'runs') return { page: 'runs' };
  if (first === 'run' && second) return { page: 'run', id: decodeURIComponent(second) };
  if (first === 'compare' && second) return { page: 'compare', id: decodeURIComponent(second) };
  if (first === 'recipe' && second) return { page: 'preview', id: decodeURIComponent(second) };
  if (first === 'edit' && second) return { page: 'edit', id: decodeURIComponent(second) };
  if (first === 'plans') return { page: 'plans' };
  if (first === 'how') return { page: 'how' };
  return { page: 'gallery' };
}

/** 화면을 바꾼다. 예: navigate('/edit/recipe-1234') */
export function navigate(path: string): void {
  window.location.hash = path;
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
