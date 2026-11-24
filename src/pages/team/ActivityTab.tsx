// '활동' 탭: 이 프로젝트 폴더에서 AI가 한 일. Claude Code·Codex가 남긴 대화 기록에서
// 대화 수, 내가 한 말, 고친 파일, 팀원별 일한 양을 모아 보여 준다. 팀원이 없는 폴더에서도 볼 것이 생긴다.
// 읽기 전용이다. 기록은 내 컴퓨터 도우미가 읽어 요약만 보내 주고, 이 화면은 요약을 저장하지 않는다.
// AI로 요약하지 않는다: 기록에 적힌 것만 세고, 없는 값은 0이 아니라 '모름'으로 둔다. 금액은 계산하지 않는다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { BrandLogo } from '@/components/BrandLogo';
import { checkPermissions, type ActivityFile, type ActivityRole, type ActivitySession, type ActivitySummary } from '@/lib/journal/activity';
import { fetchActivity, subscribeLocal } from '@/lib/local/client';
import { fmtCompact, fmtDay, fmtDuration, fmtTime, fmtTokens } from '@/pages/team/format';
import { ShowMore, TOOL_LABEL, ToolLogo } from '@/pages/team/parts';
import type { AgentCard } from '@/types';

const FIRST = 5;

/** 카드의 머리줄 */
function CardHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
      <h3 className="font-heading text-lg font-extrabold">{title}</h3>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl leading-none font-extrabold tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-base font-bold text-muted-foreground">{unit}</span> : null}
      </p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** 도구마다 기록한 토큰. 뜻이 달라(Claude Code 출력 토큰, Codex 합계) 줄을 나눠 회사 로고와 함께 적는다. */
function TokenStat({ claude, codex, hasClaude, hasCodex }: { claude: number; codex: number; hasClaude: boolean; hasCodex: boolean }) {
  const rows = [
    ...(hasClaude ? [{ key: 'claude', logo: 'anthropic' as const, name: 'Claude 출력', value: claude }] : []),
    ...(hasCodex ? [{ key: 'codex', logo: 'openai' as const, name: 'Codex', value: codex }] : []),
  ];
  return (
    <div className="flex flex-col gap-2 bg-card p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">기록된 토큰</p>
      {rows.length === 0 ? <p className="font-heading text-3xl leading-none font-extrabold">—</p> : null}
      {rows.map((row) => (
        <p key={row.key} className="flex min-w-0 items-center gap-2" title={`${row.value.toLocaleString('ko-KR')} 토큰`}>
          <BrandLogo provider={row.logo} className="size-3.5 shrink-0 text-muted-foreground" />
          <span className={cn('font-heading leading-none font-extrabold whitespace-nowrap tabular-nums', rows.length === 1 ? 'text-3xl' : 'text-xl')}>
            {fmtCompact(row.value)}
          </span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">{row.name}</span>
        </p>
      ))}
    </div>
  );
}

function PermissionCheck({ summary, cards }: { summary: ActivitySummary; cards: AgentCard[] }) {
  const check = checkPermissions(summary.roleEdits, cards);
  if (check.readOnlyRoles.length === 0) return null;
  if (check.issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-emerald-600" aria-hidden />
        권한 점검: 읽기 전용 팀원({check.readOnlyRoles.join(', ')})이 파일을 고친 기록은 없어요.
      </p>
    );
  }
  const codex = check.issues.some((issue) => issue.tools.includes('codex-cli'));
  const claude = check.issues.some((issue) => issue.tools.includes('claude-code'));
  return (
    <Notice tone="warn">
      <p className="font-medium">권한 점검: 읽기 전용으로 적힌 팀원이 파일을 고친 기록이 있어요.</p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {check.issues.map((issue) => (
          <li key={issue.role}>
            <span className="font-heading font-extrabold">{issue.role}</span>
            <span className="text-xs">
              {' '}
              · 맡은 일 {issue.times}건 · {issue.tools.map((tool) => TOOL_LABEL[tool]).join(', ')}
              {issue.lastAt ? ` · 마지막 ${fmtTime(issue.lastAt)}` : ''}
            </span>
            <br />
            <code className="text-xs break-all">
              {issue.files.join(', ')}
              {issue.files.length >= 6 ? ' …' : ''}
            </code>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs">
        {codex ? 'Codex는 읽기 전용을 지시문 문장으로만 안내해서 지켜지지 않을 수 있어요. ' : ''}
        {claude ? 'Claude Code는 역할 파일의 도구 목록(tools)으로 막으니, 목록에 Edit·Write가 들어 있지 않은지 확인해 보세요. ' : ''}
        지금 역할 파일 기준이라 그때는 권한이 달랐을 수도 있어요.
      </p>
    </Notice>
  );
}

function splitPath(file: string) {
  const at = file.lastIndexOf('/');
  return at < 0 ? { dir: '', base: file } : { dir: file.slice(0, at + 1), base: file.slice(at + 1) };
}

function TopFiles({ files }: { files: ActivityFile[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? files : files.slice(0, FIRST);
  const max = Math.max(1, ...files.map((file) => file.edits));
  return (
    <section className="overflow-hidden rounded-2xl border bg-card" aria-label="많이 고친 파일">
      <CardHead title="많이 고친 파일" note="고친 횟수" />
      <ul className="flex flex-col px-5 pb-3">
        {shown.map((file) => {
          const { dir, base } = splitPath(file.path);
          return (
            <li key={file.path} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2">
              <div className="min-w-0">
                <p className="flex min-w-0 items-baseline gap-1.5 text-sm" title={file.path}>
                  <span className="shrink-0 font-medium">{base}</span>
                  {dir ? <span className="truncate font-mono text-xs text-muted-foreground">{dir}</span> : null}
                </p>
                <div className="mt-1.5 h-[3px] rounded-full bg-muted" aria-hidden>
                  <div className="h-[3px] rounded-full bg-primary/45" style={{ width: `${Math.max(4, (file.edits / max) * 100)}%` }} />
                </div>
              </div>
              <span className="text-sm tabular-nums">
                {file.edits}
                <span className="text-xs text-muted-foreground">번</span>
              </span>
            </li>
          );
        })}
      </ul>
      <ShowMore open={open} hidden={files.length - FIRST} onToggle={() => setOpen(!open)} />
    </section>
  );
}

function Roles({ roles }: { roles: ActivityRole[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card" aria-label="팀원별로 일한 양">
      <CardHead title="팀원별로 일한 양" />
      <ul className="flex flex-col divide-y px-5 pb-2">
        {roles.map((row) => (
          <li key={row.role} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
            <span className="font-heading font-extrabold">{row.role}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              맡은 일 <b className="font-semibold text-foreground">{row.count}건</b> · {fmtDuration(row.durationMs)} · 토큰 {fmtCompact(row.tokens)} · 고친 파일{' '}
              {row.editedFiles === null ? '모름' : `${row.editedFiles}개`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SessionRow({ item }: { item: ActivitySession }) {
  const meta = [
    fmtTime(item.startedAt),
    `내 말 ${item.turns}번`,
    ...(item.delegations > 0 ? [`팀원에게 ${item.delegations}건`] : []),
    `고친 파일 ${item.editedFiles}개`,
    ...(item.tokens ? [`토큰 ${fmtCompact(item.tokens.value)}`] : []),
  ];
  return (
    <li>
      <a
        href={`#/journal?open=${item.tool}:${encodeURIComponent(item.id)}`}
        className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60"
        title="업무 일지에서 자세히 보기"
      >
        <ToolLogo tool={item.tool} className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-medium">{item.title || '(첫 메시지를 찾지 못했어요)'}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{meta.join(' · ')}</p>
        </div>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </a>
    </li>
  );
}

function RecentSessions({ sessions, total }: { sessions: ActivitySession[]; total: number }) {
  const [open, setOpen] = useState(false);
  const shown = open ? sessions : sessions.slice(0, FIRST);
  return (
    <section className="overflow-hidden rounded-2xl border bg-card" aria-label="최근 대화">
      <CardHead title="최근 대화" note="누르면 업무 일지에서 열려요" />
      <ul className="flex flex-col divide-y border-t">
        {shown.map((item) => (
          <SessionRow key={`${item.tool}-${item.id}`} item={item} />
        ))}
      </ul>
      <ShowMore open={open} hidden={sessions.length - FIRST} onToggle={() => setOpen(!open)} />
      {open && sessions.length < total ? (
        <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">최근 {sessions.length}개까지만 보여 드려요. 위의 숫자는 {total}개 전체를 센 거예요.</p>
      ) : null}
    </section>
  );
}

/** 세는 방법과 한계는 한 곳에 접어 둔다 (같은 안내를 화면 곳곳에 되풀이하지 않는다) */
function HowCounted({ summary }: { summary: ActivitySummary }) {
  return (
    <details className="group rounded-2xl border bg-card px-5 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground group-open:text-foreground">이 숫자는 어떻게 셌나요?</summary>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>Claude Code·Codex가 이 컴퓨터에 남긴 대화 기록에 적힌 것만 셉니다. 기록에 없는 값은 0이 아니라 "모름"으로 두고, 금액은 계산하지 않아요.</li>
        <li>파일 고침은 AI의 파일 고침 도구(Claude Code의 Edit·Write 등, Codex의 파일 변경)로 남은 것만 셉니다. 셸 명령으로 바뀐 파일은 빠져요.</li>
        <li>토큰은 Claude Code가 적은 출력 토큰과 Codex가 적은 합계를 그대로 보여 드려요.</li>
        <li>이어하기(resume)로 앞 대화가 새 대화에 복사돼도 처음 대화에서 한 번만 셉니다.</li>
        <li>Claude Code는 기본으로 30일이 지난 기록을 지워서, 그보다 오래된 일은 보이지 않을 수 있어요.</li>
        {summary.uncheckedDelegations > 0 ? <li>팀원의 세부 기록을 찾지 못해 파일을 고쳤는지 모르는 맡긴 일이 {summary.uncheckedDelegations}건 있어요.</li> : null}
        {summary.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        <li>
          읽기만 하고, 요약은 이 화면에만 보이며 저장하거나 보내지 않아요.
          {summary.tookMs !== undefined ? ` 읽는 데 ${(summary.tookMs / 1000).toFixed(1)}초 걸렸어요.` : ''}
        </li>
      </ul>
    </details>
  );
}

export function ActivityTab({ cards }: { cards: AgentCard[] }) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lastLoad = useRef(0);

  /** quiet면 실시간 갱신이라 보고 있던 화면을 그대로 둔다 */
  const load = useCallback(async (quiet: boolean) => {
    if (!quiet) {
      setBusy(true);
      setError('');
    }
    try {
      setSummary(await fetchActivity());
      lastLoad.current = Date.now();
    } catch (caught) {
      if (!quiet) setError(`활동을 읽지 못했어요: ${(caught as Error).message}`);
    } finally {
      if (!quiet) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    // AI가 일하는 동안 기록이 늘면 저절로 다시 읽는다. 기록이 계속 늘어도 너무 자주 읽지 않게 간격을 둔다.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = subscribeLocal((event) => {
      if (event.root === 'project' || timer) return;
      const wait = Math.max(8000, 12000 - (Date.now() - lastLoad.current));
      timer = setTimeout(() => {
        timer = null;
        void load(true);
      }, wait);
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  const totals = summary?.totals;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {totals?.firstAt ? `${fmtDay(totals.firstAt)} ~ ${fmtDay(totals.lastAt)} · ` : ''}Claude Code·Codex 대화 기록에서 모았어요
        </p>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void load(false)}>
          <RefreshCw aria-hidden className={cn(busy && 'animate-spin')} />
          기록 다시 읽기
        </Button>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {busy && !summary ? (
        <p className="rounded-2xl border bg-card px-5 py-8 text-center text-sm text-muted-foreground" role="status">
          기록을 훑는 중이에요. 처음에는 기록이 크면 몇 초 걸려요…
        </p>
      ) : null}

      {summary && totals ? (
        totals.sessions === 0 ? (
          <Notice tone="info">이 폴더에서 한 Claude Code·Codex 대화 기록을 찾지 못했어요. Claude Code는 기본으로 30일이 지난 기록을 지워요.</Notice>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-4">
              <Stat label="대화" value={String(totals.sessions)} unit="개" sub={`${TOOL_LABEL['claude-code']} ${totals.claude} · Codex ${totals.codex}`} />
              <Stat label="내가 한 말" value={fmtTokens(totals.turns)} unit="번" />
              <Stat label="파일 고침" value={fmtTokens(totals.editCount)} unit="번" sub={`서로 다른 파일 ${totals.editedFiles}개`} />
              <TokenStat claude={totals.claudeOutputTokens} codex={totals.codexTokens} hasClaude={totals.claude > 0} hasCodex={totals.codex > 0} />
            </div>

            <PermissionCheck summary={summary} cards={cards} />

            <div className={cn('grid gap-5', summary.roles.length > 0 && summary.topFiles.length > 0 && 'lg:grid-cols-2')}>
              {summary.topFiles.length > 0 ? <TopFiles files={summary.topFiles} /> : null}
              {summary.roles.length > 0 ? <Roles roles={summary.roles} /> : null}
            </div>

            <RecentSessions sessions={summary.sessions} total={totals.sessions} />
            <HowCounted summary={summary} />
          </>
        )
      ) : null}
    </div>
  );
}
