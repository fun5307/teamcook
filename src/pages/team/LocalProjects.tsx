// 내 컴퓨터 도우미(teamcook open)로 열었을 때의 '프로젝트 고르기'.
// 폴더 고르기 창 대신, Claude Code·Codex 기록에서 찾은 "최근에 AI를 쓴 프로젝트"를 보여 준다.
// 도우미가 무엇을 읽는지 이 화면에 항상 적어 둔다.

import { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { localInfo, recentProjects, type RecentProject } from '@/lib/local/client';
import { openLocalProject, useWorkspace } from '@/store/useWorkspace';

const fmtDay = (ms: number) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** 도우미가 읽는 곳 */
export function LocalReadScope() {
  const info = localInfo();
  if (!info) return null;
  return (
    <Notice tone="info" className="flex flex-col gap-1 text-xs">
      <span className="font-medium">내 컴퓨터 도우미로 열었어요. 도우미가 읽는 곳은 여기뿐이에요 (읽기만):</span>
      <code className="break-all">{info.claude.path}{info.claude.exists ? '' : ' (없음)'}</code>
      <code className="break-all">{info.codex.path}{info.codex.exists ? '' : ' (없음)'}</code>
      <span>이 두 폴더에서는 대화 기록 파일(.jsonl)만 열어요. 인증·설정 파일은 열지 않고, 아무것도 바깥으로 보내지 않아요.</span>
    </Notice>
  );
}

export function LocalProjects({ compact = false }: { compact?: boolean }) {
  const busy = useWorkspace((state) => state.busy);
  const [list, setList] = useState<RecentProject[] | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (fresh = false) => {
    setLoading(true);
    setError('');
    try {
      setList(await recentProjects(fresh));
    } catch (caught) {
      setError(`도우미와 연결하지 못했어요. 터미널에서 도우미가 켜져 있는지 확인해 주세요. (${(caught as Error).message})`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const open = async (path: string) => {
    if (await openLocalProject(path)) window.location.hash = '/team';
  };
  const shown = compact ? (list ?? []).slice(0, 4) : (list ?? []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-lg font-extrabold">최근에 AI를 쓴 프로젝트</p>
        {!compact ? (
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load(true)}>
            <RefreshCw aria-hidden />
            다시 찾기
          </Button>
        ) : null}
      </div>
      {loading && !list ? <p className="text-sm text-muted-foreground" role="status">기록에서 프로젝트를 찾는 중이에요…</p> : null}
      {list && list.length === 0 ? (
        <p className="text-sm text-muted-foreground">기록에서 프로젝트를 찾지 못했어요. 아래에 폴더 경로를 넣어 열 수 있어요.</p>
      ) : null}
      <ul className="flex flex-col gap-2" aria-label="최근 프로젝트">
        {shown.map((item) => (
          <li key={item.path}>
            <button
              type="button"
              disabled={busy || !item.exists}
              onClick={() => void open(item.path)}
              className="flex w-full flex-col gap-0.5 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-heading text-lg font-extrabold">{item.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmtDay(item.lastUsed)}</span>
              </span>
              <code className="truncate text-xs text-muted-foreground">{item.path}</code>
              <span className="text-xs text-muted-foreground">
                {[item.claudeSessions > 0 ? `Claude Code 대화 ${item.claudeSessions}` : '', item.codexSessions > 0 ? `Codex 대화 ${item.codexSessions}` : '']
                  .filter(Boolean)
                  .join(' · ')}
                {item.exists ? '' : ' · 지금은 이 폴더가 없어요'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {compact && list && list.length > shown.length ? (
        <a className="text-sm underline underline-offset-2 hover:text-primary" href="#/team">
          {list.length - shown.length}개 더 보기
        </a>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">목록에 없는 폴더 열기</summary>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (manual.trim()) void open(manual.trim());
          }}
        >
          <input
            aria-label="폴더 전체 경로"
            placeholder="예: C:\work\my-app"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !manual.trim()}>
            <FolderOpen aria-hidden />
            열기
          </Button>
        </form>
      </details>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!compact ? <LocalReadScope /> : null}
    </div>
  );
}
