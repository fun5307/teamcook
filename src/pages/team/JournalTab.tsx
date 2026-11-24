// '업무 일지' 탭: Claude Code·Codex가 남긴 대화 기록에서 "누구에게 무엇을 시켰고 무엇을 돌려받았는지"를 보여 준다.
// 읽기 전용이다. 기록 폴더는 사용자가 직접 골라야 열리고, 그 안의 대화 기록(.jsonl)만 읽는다.
// 내 컴퓨터 도우미(teamcook open)로 열었으면 고르지 않아도 정해진 기록 폴더를 읽고, 기록이 늘어나면 저절로 다시 읽는다.
// 기록 형식은 공식 문서에 없어서 도구가 바뀌면 못 읽을 수 있다. 그때는 "못 읽음"을 그대로 보여 준다.

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { PlainText } from '@/components/practice/PracticeParts';
import {
  findClaudeProjectDirs,
  listClaudeSessions,
  readClaudeAgentSteps,
  readClaudeSession,
  readCodexJournal,
  sameProject,
  type SessionFile,
} from '@/lib/journal/read';
import { buildLineage, type LineageNode } from '@/lib/journal/activity';
import { summarizeRoles, type AgentStep, type Delegation, type JournalSession, type JournalTool } from '@/lib/journal/types';
import type { DirLike } from '@/lib/workspace/fs';
import { isLocal, localDir, localInfo, subscribeLocal } from '@/lib/local/client';
import { fmtDuration, fmtTime, fmtTokens } from '@/pages/team/format';
import { pickFolder, recallFolder, recalledName } from '@/store/useWorkspace';
import type { AgentCard } from '@/types';

const TOOL_LABEL: Record<JournalTool, string> = { 'claude-code': 'Claude Code', 'codex-cli': 'Codex' };

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

function DelegationCard({
  item,
  index,
  known,
  loadSteps,
  askedBy,
}: {
  item: Delegation;
  index: number;
  known: boolean;
  loadSteps?: () => Promise<AgentStep[] | null>;
  /** 이 일을 맡긴 팀원의 이름 (메인 AI가 직접 맡겼으면 없음) */
  askedBy?: string;
}) {
  const [steps, setSteps] = useState<AgentStep[] | null | undefined>(undefined);
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col items-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-foreground font-heading text-sm font-extrabold text-background tabular-nums">
          {index + 1}
        </span>
        <span className="w-0.5 flex-1 bg-border" aria-hidden />
      </div>
      <article className="mb-5 flex flex-col gap-2 rounded-xl border bg-card p-4">
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-heading text-xl font-extrabold">{item.role}</span>
          {item.title ? <span className="text-sm text-muted-foreground">{item.title}</span> : null}
          {!known ? <span className="text-xs text-amber-800">지금 팀에 없는 이름</span> : null}
          {askedBy ? <span className="text-xs text-muted-foreground">↳ 맡긴 팀원: {askedBy}</span> : null}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {fmtTime(item.startedAt)} · {fmtDuration(item.durationMs)} · 토큰 {fmtTokens(item.tokens)}
            {item.toolCount !== undefined ? ` · 도구 ${item.toolCount}번` : ''}
          </span>
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-primary">시킨 일</p>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-muted p-3">
              <PlainText value={item.instruction} empty="(기록에 없음)" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-primary">
              돌려받은 결과{' '}
              {item.status === 'failed' ? <span className="text-rose-700">실패</span> : null}
              {item.status === 'unknown' ? <span className="font-normal text-muted-foreground">(기록이 끊겼거나 진행 중이었어요)</span> : null}
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-muted p-3">
              <PlainText value={item.result ?? ''} empty="(기록에 없음)" />
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
            <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto border-t pt-2 text-sm">
              {steps.map((step, at) => (
                <li key={at} className={cn('flex gap-2', step.kind === 'tool' ? 'text-muted-foreground' : '')}>
                  <span className="w-10 shrink-0 text-xs">{step.kind === 'tool' ? '도구' : '말'}</span>
                  <span className={cn('min-w-0 break-words whitespace-pre-wrap', step.kind === 'tool' && 'font-mono text-xs')}>
                    {step.kind === 'say' ? step.text.slice(0, 600) : step.text}
                  </span>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </article>
    </li>
  );
}

/** 누가 누구에게 일을 맡겼나. 나 → 메인 AI → 팀원 → (팀원이 또 맡긴) 팀원 */
function LineageList({ nodes, byId, names }: { nodes: LineageNode[]; byId: Map<string, Delegation>; names: Set<string> }) {
  return (
    <ul className="flex flex-col gap-1 border-l pl-4">
      {nodes.map((node) => {
        const item = byId.get(node.id);
        const edited = item?.edited ? Object.keys(item.edited).length : null;
        return (
          <li key={node.id}>
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-heading font-extrabold">{node.role}</span>
              {!names.has(node.role) ? <span className="text-xs text-amber-800">지금 팀에 없는 이름</span> : null}
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtDuration(item?.durationMs)} · 토큰 {fmtTokens(item?.tokens)}
                {edited !== null ? ` · 고친 파일 ${edited}개` : ''}
              </span>
            </p>
            {node.children.length > 0 ? <LineageList nodes={node.children} byId={byId} names={names} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function SessionView({ session, cards, claudeDir }: { session: JournalSession; cards: AgentCard[]; claudeDir?: DirLike }) {
  const names = new Set(cards.map((card) => card.name));
  const roles = summarizeRoles(session);
  const byId = new Map(session.delegations.map((item) => [item.id, item]));
  const lineage = buildLineage(session);
  const nested = session.delegations.some((item) => item.parentId);
  const activity = session.activity;
  const editedCount = activity ? Object.keys(activity.edits).length : 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-xl border-2 border-foreground bg-card p-4">
        <p className="text-xs font-bold text-primary">내가 시킨 일 · {TOOL_LABEL[session.tool]} · {fmtTime(session.startedAt)}</p>
        <div className="max-h-40 overflow-y-auto">
          <PlainText value={session.firstPrompt} empty="(첫 메시지를 찾지 못했어요)" />
        </div>
        {activity ? (
          <p className="text-xs text-muted-foreground">
            내가 한 말 {activity.turns}번 · 메인 AI가 쓴 도구 {Object.values(activity.toolCounts).reduce((sum, value) => sum + value, 0)}번 · 메인 AI가 고친 파일 {editedCount}개
          </p>
        ) : null}
      </div>
      {session.delegations.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <p className="font-heading text-lg font-extrabold">누가 누구에게 맡겼나</p>
          <p className="text-sm">
            나 → <span className="font-medium">{TOOL_LABEL[session.tool]} 메인 AI</span>
          </p>
          <LineageList nodes={lineage} byId={byId} names={names} />
          {nested ? <p className="text-xs text-muted-foreground">팀원이 다른 팀원에게 다시 맡긴 일은 안쪽으로 들여 썼어요.</p> : null}
        </div>
      ) : null}
      {roles.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="px-4 pt-3 text-left font-heading text-lg font-extrabold">누가 얼마나 일했나</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">팀원</th>
                <th className="px-4 py-2 font-medium">맡은 횟수</th>
                <th className="px-4 py-2 font-medium">걸린 시간</th>
                <th className="px-4 py-2 font-medium">토큰</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((row) => (
                <tr key={row.role} className="border-b last:border-b-0">
                  <th className="px-4 py-2 font-medium">{row.role}</th>
                  <td className="px-4 py-2 tabular-nums">{row.count}</td>
                  <td className="px-4 py-2 tabular-nums">{fmtDuration(row.durationMs)}</td>
                  <td className="px-4 py-2 tabular-nums">{fmtTokens(row.tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {session.delegations.length === 0 ? (
        <Notice tone="info">이 대화에서는 팀원에게 일을 맡긴 기록이 없어요. 메인 AI 혼자 일했어요.</Notice>
      ) : (
        <ol>
          {session.delegations.map((item, index) => (
            <DelegationCard
              key={item.id}
              item={item}
              index={index}
              known={names.has(item.role)}
              askedBy={item.parentId ? byId.get(item.parentId)?.role : undefined}
              loadSteps={
                session.tool === 'claude-code' && claudeDir && item.agentId
                  ? () => readClaudeAgentSteps(claudeDir, session.id, item.agentId!)
                  : undefined
              }
            />
          ))}
        </ol>
      )}
      {session.finalAnswer ? (
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <p className="text-xs font-bold text-primary">메인 AI의 마지막 보고</p>
          <div className="max-h-60 overflow-y-auto">
            <PlainText value={session.finalAnswer} />
          </div>
        </div>
      ) : null}
      {session.skippedLines > 0 ? (
        <p className="text-xs text-muted-foreground">읽지 못하고 건너뛴 줄이 {session.skippedLines}개 있어요.</p>
      ) : null}
    </div>
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

  /** 기록 폴더에서 대화 목록을 읽는다. quiet면 실시간 갱신이라 보고 있던 대화를 닫지 않는다. */
  const loadFrom = async (tool: JournalTool, dir: DirLike, quiet = false) => {
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
          note: `최근 기록 ${journal.read}개 가운데 이 폴더("${projectName}")에서 한 대화 ${mine.length}개${
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
    } catch (caught) {
      if (!quiet) setError(`기록을 읽지 못했어요: ${(caught as Error).message}`);
    } finally {
      if (!quiet) setBusy(false);
    }
  };

  const load = async (tool: JournalTool, again: boolean) => {
    if (local) {
      await loadFrom(tool, localDir(tool === 'claude-code' ? 'claude-logs' : 'codex-logs'));
      return;
    }
    const key = tool === 'claude-code' ? 'claude-logs' : 'codex-logs';
    const dir = again ? await recallFolder(key, 'read', true) : await pickFolder(key, 'read');
    if (dir) await loadFrom(tool, dir);
  };

  // 도우미로 열었으면: 처음에 기록을 바로 읽고, 기록 파일이 늘어나면 저절로 다시 읽는다
  useEffect(() => {
    if (!local) return;
    const info = localInfo();
    void load(info?.claude.exists || !info?.codex.exists ? 'claude-code' : 'codex-cli', false);
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

  const info = localInfo();
  const hasLogs = (tool: JournalTool) => (tool === 'claude-code' ? info?.claude.exists : info?.codex.exists) ?? false;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-2">
        {(['claude-code', 'codex-cli'] as const).map((tool) => (
          <div key={tool} className={cn('flex flex-col gap-2 rounded-xl border bg-card p-4', loaded?.tool === tool && 'border-foreground')}>
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-heading text-lg font-extrabold">{TOOL_LABEL[tool]} 기록</span>
              {local && loaded?.tool === tool ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                  <span className="size-2 rounded-full bg-emerald-600" aria-hidden />
                  지켜보는 중{updatedAt ? ` · ${new Date(updatedAt).toLocaleTimeString('ko-KR')} 갱신` : ''}
                </span>
              ) : null}
            </p>
            {local ? (
              <p className="text-xs break-all text-muted-foreground">
                <code>{tool === 'claude-code' ? info?.claude.path : info?.codex.path}</code>
                {hasLogs(tool) ? '' : ' (이 컴퓨터에 없어요)'}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {tool === 'claude-code' ? (
                  <>
                    사용자 폴더의 <code>.claude/projects</code>를 골라 주세요.
                  </>
                ) : (
                  <>
                    사용자 폴더의 <code>.codex/sessions</code>를 골라 주세요.
                  </>
                )}{' '}
                숨김 폴더가 안 보이면 고르기 창의 주소 칸에 <code>%USERPROFILE%\{tool === 'claude-code' ? '.claude\\projects' : '.codex\\sessions'}</code>를
                붙여 넣으세요.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {local ? (
                <Button size="sm" variant={loaded?.tool === tool ? 'secondary' : 'outline'} disabled={busy || !hasLogs(tool)} onClick={() => void load(tool, false)}>
                  {loaded?.tool === tool ? '보는 중' : '이 기록 보기'}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void load(tool, false)}>
                    <FolderOpen aria-hidden />
                    기록 폴더 고르기
                  </Button>
                  {remembered[tool] ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void load(tool, true)}>
                      다시 열기: {remembered[tool]}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        읽기만 해요. 대화 기록 파일(.jsonl)만 열고, 인증·설정 파일은 열지 않아요. 내용은 이 화면에만 보이고 저장하거나 보내지 않아요.
        {local ? ' AI가 일하는 동안 기록이 늘어나면 저절로 다시 읽어요.' : ''} 기록 형식은 공식 문서에 없어서 도구가 바뀌면 못 읽을 수 있어요.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {busy ? <p className="text-sm text-muted-foreground" role="status">기록을 읽는 중이에요…</p> : null}

      {selected ? (
        <div className="flex flex-col gap-3">
          <div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              대화 목록으로
            </Button>
          </div>
          <SessionView session={selected} cards={cards} claudeDir={loaded?.claudeDir} />
        </div>
      ) : loaded ? (
        <div className="flex flex-col gap-2">
          {loaded.note ? <p className="text-sm text-muted-foreground">{loaded.note}</p> : null}
          <ul className="flex flex-col gap-2">
            {loaded.tool === 'claude-code'
              ? loaded.claudeFiles?.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left hover:border-foreground/40"
                      onClick={() => void openClaude(file)}
                    >
                      <span className="font-medium">{new Date(file.lastModified).toLocaleString('ko-KR')}에 끝난 대화</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {(file.size / 1_000_000).toFixed(1)}MB · 누르면 읽어요
                      </span>
                    </button>
                  </li>
                ))
              : loaded.codex?.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-1 rounded-xl border bg-card px-4 py-3 text-left hover:border-foreground/40"
                      onClick={() => setSelected(session)}
                    >
                      <span className="line-clamp-1 font-medium">{session.firstPrompt || '(첫 메시지 없음)'}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtTime(session.startedAt)} · 팀원에게 맡긴 일 {session.delegations.length}건
                      </span>
                    </button>
                  </li>
                ))}
          </ul>
          {loaded.tool === 'codex-cli' && loaded.codex?.length === 0 ? (
            <Notice tone="info">이 폴더에서 한 Codex 대화를 찾지 못했어요.</Notice>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
