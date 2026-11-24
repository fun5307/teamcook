// '업무 일지' 탭: Claude Code·Codex가 남긴 대화 기록에서 "누구에게 무엇을 시켰고 무엇을 돌려받았는지"를 보여 준다.
// 읽기 전용이다. 기록 폴더는 사용자가 직접 골라야 열리고, 그 안의 대화 기록(.jsonl)만 읽는다.
// 내 컴퓨터 도우미(teamcook open)로 열었으면 고르지 않아도 정해진 기록 폴더를 읽고, 기록이 늘어나면 저절로 다시 읽는다.
// 기록 형식은 공식 문서에 없어서 도구가 바뀌면 못 읽을 수 있다. 그때는 "못 읽음"을 그대로 보여 준다.
//
// 화면은 두 단계다: 대화 목록 → 대화 하나. 대화 하나에서는 맡긴 일을 한 줄씩(계보는 들여쓰기로) 보여 주고,
// 시킨 말·돌려받은 말 원문(팀원끼리는 영어로 주고받는 일이 많다)은 눌렀을 때만 편다.

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import {
  findClaudeProjectDirs,
  listClaudeSessions,
  readClaudeAgentSteps,
  readClaudeSession,
  readCodexJournal,
  sameProject,
  type SessionFile,
} from '@/lib/journal/read';
import { buildLineage, pickTitle, type ActivitySession, type LineageNode } from '@/lib/journal/activity';
import { summarizeRoles, type AgentStep, type Delegation, type JournalSession, type JournalTool } from '@/lib/journal/types';
import type { DirLike } from '@/lib/workspace/fs';
import { fetchActivity, isLocal, localDir, localInfo, subscribeLocal } from '@/lib/local/client';
import { fmtCompact, fmtDuration, fmtTime } from '@/pages/team/format';
import { ExpandableText, TOOL_LABEL, ToolLogo } from '@/pages/team/parts';
import { pickFolder, recallFolder, recalledName } from '@/store/useWorkspace';
import type { AgentCard } from '@/types';

const TOOLS: JournalTool[] = ['claude-code', 'codex-cli'];

interface Loaded {
  tool: JournalTool;
  /** 읽은 기록 폴더 (다시 읽을 때 쓴다) */
  root?: DirLike;
  /** Claude Code: 세션 파일 목록 (열 때 하나씩 읽는다) */
  claudeDir?: DirLike;
  claudeFiles?: SessionFile[];
  /** Codex: 이미 묶은 세션 */
  codex?: JournalSession[];
  note?: string;
}

/** 활동 탭이 업무 일지의 대화 하나를 바로 열 때 쓰는 주소: #/journal?open=<도구>:<id> */
function readOpenParam(): { tool: JournalTool; id: string } | null {
  const query = window.location.hash.split('?')[1];
  const value = query ? new URLSearchParams(query).get('open') : null;
  if (!value) return null;
  const at = value.indexOf(':');
  const tool = value.slice(0, at) as JournalTool;
  return TOOLS.includes(tool) ? { tool, id: value.slice(at + 1) } : null;
}

function clearOpenParam() {
  if (window.location.hash.includes('?')) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/journal`);
}

// ───────────────────────── 대화 하나 ─────────────────────────

const STATUS: Record<Delegation['status'], { label: string; dot: string }> = {
  done: { label: '완료', dot: 'bg-emerald-600' },
  failed: { label: '실패', dot: 'bg-primary' },
  unknown: { label: '결과 기록 없음', dot: 'bg-muted-foreground/40' },
};

/** 계보 나무를 위에서부터 차례로 펼친다 (자식은 부모 바로 아래, 깊이와 함께) */
function flatten(nodes: LineageNode[], depth = 0, out: { id: string; depth: number }[] = []) {
  for (const node of nodes) {
    out.push({ id: node.id, depth });
    flatten(node.children, depth + 1, out);
  }
  return out;
}

function DelegationRow({
  item,
  depth,
  known,
  askedBy,
  loadSteps,
}: {
  item: Delegation;
  depth: number;
  known: boolean;
  /** 이 일을 맡긴 팀원 (메인 AI가 직접 맡겼으면 없음) */
  askedBy?: string;
  loadSteps?: () => Promise<AgentStep[] | null>;
}) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<AgentStep[] | null | undefined>(undefined);
  const status = STATUS[item.status];
  const edited = item.edited ? Object.keys(item.edited).length : null;
  const meta = [
    status.label,
    ...(item.startedAt ? [fmtTime(item.startedAt)] : []),
    fmtDuration(item.durationMs),
    `토큰 ${fmtCompact(item.tokens)}`,
    ...(item.toolCount !== undefined ? [`도구 ${item.toolCount}번`] : []),
    ...(edited !== null ? [`고친 파일 ${edited}개`] : []),
  ];
  return (
    <li style={{ marginLeft: `${Math.min(depth, 3) * 1.5}rem` }}>
      <article className={cn('rounded-xl border bg-card transition-colors', open && 'border-foreground/30')}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
          <span className={cn('mt-2 size-2 shrink-0 rounded-full', status.dot)} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {depth > 0 ? <span className="text-muted-foreground">↳</span> : null}
              <span className="font-heading text-lg font-extrabold">{item.role}</span>
              {item.title ? <span className="min-w-0 truncate text-sm text-muted-foreground">{item.title}</span> : null}
              {!known ? <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">지금 팀에 없는 이름</span> : null}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
              {askedBy ? `맡긴 팀원: ${askedBy} · ` : ''}
              {meta.join(' · ')}
            </span>
          </span>
          <ChevronDown aria-hidden className={cn('mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open ? (
          <div className="flex flex-col gap-3 border-t px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold text-primary">시킨 말 (원문)</p>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <ExpandableText text={item.instruction} lines={4} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold text-primary">돌려받은 말 (원문)</p>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <ExpandableText text={item.result ?? ''} lines={4} empty={item.status === 'unknown' ? '(기록이 끊겼거나 진행 중이었어요)' : '(기록에 없음)'} />
                </div>
              </div>
            </div>
            {loadSteps ? (
              steps === undefined ? (
                <div>
                  <Button size="sm" variant="ghost" onClick={async () => setSteps(await loadSteps())}>
                    <ChevronRight aria-hidden />이 팀원이 일한 과정 보기
                  </Button>
                </div>
              ) : steps === null ? (
                <p className="text-xs text-muted-foreground">이 팀원의 세부 기록 파일을 찾지 못했어요 (지워졌을 수 있어요).</p>
              ) : (
                <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border px-3 py-2 text-sm">
                  {steps.map((step, at) => (
                    <li key={at} className={cn('flex gap-2', step.kind === 'tool' && 'text-muted-foreground')}>
                      <span className="w-8 shrink-0 text-xs">{step.kind === 'tool' ? '도구' : '말'}</span>
                      <span className={cn('min-w-0 break-words whitespace-pre-wrap', step.kind === 'tool' && 'font-mono text-xs')}>
                        {step.kind === 'say' ? step.text.slice(0, 600) : step.text}
                      </span>
                    </li>
                  ))}
                </ol>
              )
            ) : null}
          </div>
        ) : null}
      </article>
    </li>
  );
}

function SessionView({
  session,
  cards,
  claudeDir,
  onBack,
}: {
  session: JournalSession;
  cards: AgentCard[];
  claudeDir?: DirLike;
  onBack: () => void;
}) {
  const names = new Set(cards.map((card) => card.name));
  const byId = new Map(session.delegations.map((item) => [item.id, item]));
  const order = flatten(buildLineage(session));
  const roles = summarizeRoles(session);
  const activity = session.activity;
  const chips = activity
    ? [
        `내가 한 말 ${activity.turns}번`,
        `메인 AI 도구 ${Object.values(activity.toolCounts).reduce((sum, value) => sum + value, 0)}번`,
        `메인 AI가 고친 파일 ${Object.keys(activity.edits).length}개`,
        `팀원에게 맡긴 일 ${session.delegations.length}건`,
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={onBack} className="bg-foreground text-background hover:bg-foreground/85">
          <ArrowLeft aria-hidden />
          대화 목록으로
        </Button>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ToolLogo tool={session.tool} className="size-3.5" />
          {TOOL_LABEL[session.tool]} · {fmtTime(session.startedAt)}
        </span>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
        <p className="text-xs font-bold text-primary">내가 시킨 일</p>
        <ExpandableText text={session.firstPrompt} lines={3} empty="(첫 메시지를 찾지 못했어요)" className="[&>p]:text-base" />
        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li key={chip} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground tabular-nums">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {session.delegations.length === 0 ? (
        <Notice tone="info">이 대화에서는 팀원에게 맡긴 일이 없어요. 메인 AI 혼자 일했어요.</Notice>
      ) : (
        <section className="flex flex-col gap-3" aria-label="팀원에게 맡긴 일">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-xl font-extrabold">
              팀원에게 맡긴 일 <span className="text-base font-bold text-muted-foreground">{session.delegations.length}건</span>
            </h3>
            <p className="text-xs text-muted-foreground">줄을 누르면 시킨 말과 돌려받은 말 원문이 펼쳐져요</p>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="팀원별 합계">
            {roles.map((row) => (
              <li key={row.role} className="rounded-full border bg-card px-3 py-1 text-xs tabular-nums">
                <b className="font-heading">{row.role}</b>
                <span className="text-muted-foreground">
                  {' '}
                  {row.count}건 · {fmtDuration(row.durationMs)} · 토큰 {fmtCompact(row.tokens)}
                </span>
              </li>
            ))}
          </ul>
          <ol className="flex flex-col gap-2">
            {order.map(({ id, depth }) => {
              const item = byId.get(id)!;
              return (
                <DelegationRow
                  key={id}
                  item={item}
                  depth={depth}
                  known={names.has(item.role)}
                  askedBy={item.parentId ? byId.get(item.parentId)?.role : undefined}
                  loadSteps={session.tool === 'claude-code' && claudeDir && item.agentId ? () => readClaudeAgentSteps(claudeDir, session.id, item.agentId!) : undefined}
                />
              );
            })}
          </ol>
        </section>
      )}

      {session.finalAnswer ? (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold text-primary">메인 AI의 마지막 보고</p>
          <ExpandableText text={session.finalAnswer} lines={6} />
        </section>
      ) : null}
      {session.skippedLines > 0 ? <p className="text-xs text-muted-foreground">읽지 못하고 건너뛴 줄이 {session.skippedLines}개 있어요.</p> : null}

      <div>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden />
          대화 목록으로
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── 대화 목록 ─────────────────────────

function SessionButton({
  tool,
  title,
  meta,
  delegations,
  onClick,
}: {
  tool: JournalTool;
  title: string;
  meta: string;
  delegations?: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/60">
        <ToolLogo tool={tool} className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">{meta}</span>
        </span>
        {delegations ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">팀원 {delegations}</span> : null}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}

export function JournalTab({ projectName, projectPath, cards }: { projectName: string; projectPath?: string; cards: AgentCard[] }) {
  const local = isLocal();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<JournalSession | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [remembered, setRemembered] = useState<Record<JournalTool, string | null>>({ 'claude-code': null, 'codex-cli': null });
  /** 도우미가 만든 활동 요약에서 얻은 대화 제목 (Claude Code 대화는 열기 전에는 제목을 모른다) */
  const [titles, setTitles] = useState<Map<string, ActivitySession>>(new Map());
  // 실시간 알림 처리에서 지금 보고 있는 것을 알려고 둔다
  const current = useRef<{ loaded: Loaded | null; selected: JournalSession | null; claudeDirNames: string[] }>({ loaded: null, selected: null, claudeDirNames: [] });
  current.current.loaded = loaded;
  current.current.selected = selected;

  useEffect(() => {
    if (local) return;
    void Promise.all([recalledName('claude-logs'), recalledName('codex-logs')]).then(([claude, codex]) =>
      setRemembered({ 'claude-code': claude, 'codex-cli': codex }),
    );
  }, [local]);

  // 대화를 열거나 닫으면 화면 맨 위로
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [selected?.id]);

  /** 기록 폴더에서 대화 목록을 읽는다. quiet면 실시간 갱신이라 보고 있던 대화를 닫지 않는다. */
  const loadFrom = async (tool: JournalTool, dir: DirLike, quiet = false): Promise<Loaded | null> => {
    if (!quiet) {
      setError('');
      setSelected(null);
      setBusy(true);
    }
    try {
      let next: Loaded | null = null;
      if (tool === 'claude-code') {
        const dirs = await findClaudeProjectDirs(dir, projectName, projectPath);
        current.current.claudeDirNames = dirs.map((item) => item.name);
        if (dirs.length === 0) {
          if (!quiet) {
            setError(
              local
                ? `"${projectName}"에서 한 Claude Code 대화 기록이 아직 없어요.`
                : `고른 폴더에서 "${projectName}"의 Claude Code 기록을 찾지 못했어요. 사용자 폴더의 .claude/projects를 골라 주세요.`,
            );
          }
        } else {
          const files = (await Promise.all(dirs.map(listClaudeSessions))).flat().sort((a, b) => b.lastModified - a.lastModified);
          next = { tool, root: dir, claudeDir: dirs[0], claudeFiles: files.slice(0, 40) };
        }
      } else {
        const journal = await readCodexJournal(dir);
        const mine = journal.sessions.filter((session) => sameProject(session.cwd, projectName, projectPath));
        next = {
          tool,
          root: dir,
          codex: mine,
          note: `최근 기록 ${journal.read}개 가운데 이 폴더에서 한 대화 ${mine.length}개${
            journal.compressed > 0 ? ` · 압축된 옛 기록 ${journal.compressed}개는 브라우저에서 읽지 못해요` : ''
          }`,
        };
      }
      if (next) {
        setLoaded(next);
        setUpdatedAt(Date.now());
        // 보고 있던 대화가 있으면 새 내용으로 바꿔 끼운다
        const open = current.current.selected;
        if (quiet && open) {
          if (next.tool === 'claude-code') {
            const file = next.claudeFiles?.find((item) => item.id === open.id);
            if (file) setSelected(await readClaudeSession(file));
          } else {
            const session = next.codex?.find((item) => item.id === open.id);
            if (session) setSelected(session);
          }
        }
      }
      return next;
    } catch (caught) {
      if (!quiet) setError(`기록을 읽지 못했어요: ${(caught as Error).message}`);
      return null;
    } finally {
      if (!quiet) setBusy(false);
    }
  };

  const load = async (tool: JournalTool, again: boolean): Promise<Loaded | null> => {
    if (local) return loadFrom(tool, localDir(tool === 'claude-code' ? 'claude-logs' : 'codex-logs'));
    const key = tool === 'claude-code' ? 'claude-logs' : 'codex-logs';
    const dir = again ? await recallFolder(key, 'read', true) : await pickFolder(key, 'read');
    return dir ? loadFrom(tool, dir) : null;
  };

  const openClaude = async (file: SessionFile) => {
    setBusy(true);
    try {
      setSelected(await readClaudeSession(file));
    } catch (caught) {
      setError(`기록을 읽지 못했어요: ${(caught as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // 도우미로 열었으면: 처음에 기록을 바로 읽고(활동 탭에서 고른 대화가 있으면 그것을 열고), 기록 파일이 늘어나면 저절로 다시 읽는다
  useEffect(() => {
    if (!local) return;
    const info = localInfo();
    const wanted = readOpenParam();
    void (async () => {
      const next = await load(wanted?.tool ?? (info?.claude.exists || !info?.codex.exists ? 'claude-code' : 'codex-cli'), false);
      if (wanted && next) {
        if (next.tool === 'claude-code') {
          const file = next.claudeFiles?.find((item) => item.id === wanted.id);
          if (file) await openClaude(file);
        } else {
          const session = next.codex?.find((item) => item.id === wanted.id);
          if (session) setSelected(session);
        }
      }
      clearOpenParam();
    })();
    void fetchActivity()
      .then((summary) => setTitles(new Map(summary.sessions.map((item) => [item.id, item]))))
      .catch(() => {
        // 제목이 없어도 날짜로 목록을 보여 준다
      });
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = subscribeLocal((event) => {
      const now = current.current.loaded;
      if (!now?.root) return;
      const mine =
        now.tool === 'claude-code'
          ? event.root === 'claude-logs' && event.files.some((file) => current.current.claudeDirNames.includes(file.split('/')[0]))
          : event.root === 'codex-logs';
      if (!mine) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadFrom(now.tool, now.root!, true), 1200);
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, projectPath]);

  if (selected) {
    return <SessionView session={selected} cards={cards} claudeDir={loaded?.claudeDir} onBack={() => setSelected(null)} />;
  }

  const info = localInfo();
  const hasLogs = (tool: JournalTool) => (tool === 'claude-code' ? info?.claude.exists : info?.codex.exists) ?? false;
  const count = loaded?.tool === 'claude-code' ? loaded.claudeFiles?.length : loaded?.codex?.length;

  return (
    <div className="flex flex-col gap-4">
      {local ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border bg-card p-1" role="tablist" aria-label="어느 도구의 기록">
              {TOOLS.map((tool) => {
                const active = loaded?.tool === tool;
                return (
                  <button
                    key={tool}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={busy || !hasLogs(tool)}
                    onClick={() => !active && void load(tool, false)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-colors disabled:opacity-40',
                      active ? 'bg-foreground font-semibold text-background' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <ToolLogo tool={tool} className="size-3.5" />
                    {TOOL_LABEL[tool]}
                    {active && count !== undefined ? <span className="text-xs opacity-70 tabular-nums">{count}</span> : null}
                  </button>
                );
              })}
            </div>
            {loaded ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <span className="size-2 rounded-full bg-emerald-600" aria-hidden />
                지켜보는 중{updatedAt ? ` · ${new Date(updatedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })} 갱신` : ''}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {TOOLS.map((tool) => (
            <div key={tool} className={cn('flex flex-col gap-2 rounded-xl border bg-card p-4', loaded?.tool === tool && 'border-foreground')}>
              <p className="flex items-center gap-2 font-heading text-lg font-extrabold">
                <ToolLogo tool={tool} />
                {TOOL_LABEL[tool]} 기록
              </p>
              <p className="text-xs text-muted-foreground">
                사용자 폴더의 <code>{tool === 'claude-code' ? '.claude/projects' : '.codex/sessions'}</code>를 골라 주세요. 숨김 폴더가 안 보이면 고르기 창의 주소
                칸에 <code>%USERPROFILE%\{tool === 'claude-code' ? '.claude\\projects' : '.codex\\sessions'}</code>를 붙여 넣으세요.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void load(tool, false)}>
                  <FolderOpen aria-hidden />
                  기록 폴더 고르기
                </Button>
                {remembered[tool] ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void load(tool, true)}>
                    다시 열기: {remembered[tool]}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {busy ? (
        <p className="text-sm text-muted-foreground" role="status">
          기록을 읽는 중이에요…
        </p>
      ) : null}

      {loaded ? (
        <section className="overflow-hidden rounded-2xl border bg-card" aria-label="대화 목록">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
            <h3 className="font-heading text-lg font-extrabold">대화</h3>
            <span className="text-xs text-muted-foreground">최근 것부터 · 누르면 열려요</span>
          </div>
          <ul className="flex flex-col divide-y border-t">
            {loaded.tool === 'claude-code'
              ? loaded.claudeFiles?.map((file) => {
                  const known = titles.get(file.id);
                  const at = known?.startedAt ?? new Date(file.lastModified).toISOString();
                  return (
                    <SessionButton
                      key={file.id}
                      tool="claude-code"
                      title={known?.title || `${fmtTime(new Date(file.lastModified).toISOString())}에 끝난 대화`}
                      meta={
                        known
                          ? `${fmtTime(at)} · 내 말 ${known.turns}번 · 고친 파일 ${known.editedFiles}개`
                          : `${fmtTime(at)} · ${(file.size / 1_000_000).toFixed(1)}MB`
                      }
                      delegations={known?.delegations}
                      onClick={() => void openClaude(file)}
                    />
                  );
                })
              : loaded.codex?.map((session) => (
                  <SessionButton
                    key={session.id}
                    tool="codex-cli"
                    title={pickTitle(session.activity?.prompts ?? [], session.firstPrompt) || '(첫 메시지 없음)'}
                    meta={`${fmtTime(session.startedAt)}${session.activity ? ` · 내 말 ${session.activity.turns}번` : ''}`}
                    delegations={session.delegations.length}
                    onClick={() => setSelected(session)}
                  />
                ))}
          </ul>
          {count === 0 ? <p className="px-5 py-6 text-center text-sm text-muted-foreground">이 폴더에서 한 대화를 찾지 못했어요.</p> : null}
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {loaded?.note ? `${loaded.note}. ` : ''}
        {local ? (
          <>
            읽는 곳 <code className="break-all">{loaded?.tool === 'codex-cli' ? info?.codex.path : info?.claude.path}</code> · 기록 파일만 읽기만 하고 저장하거나 보내지 않아요.
          </>
        ) : (
          '대화 기록 파일(.jsonl)만 읽기만 하고, 인증·설정 파일은 열지 않아요. 내용은 이 화면에만 보이고 저장하거나 보내지 않아요.'
        )}
      </p>
    </div>
  );
}
