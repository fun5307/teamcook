// '활동' 탭: 이 프로젝트 폴더에서 AI가 한 일. Claude Code·Codex가 남긴 대화 기록에서
// 대화 수, 내가 한 말, 고친 파일, 팀원별 일한 양을 모아 보여 준다. 팀원이 없는 폴더에서도 볼 것이 생긴다.
// 읽기 전용이다. 기록은 내 컴퓨터 도우미가 읽어 요약만 보내 주고, 이 화면은 요약을 저장하지 않는다.
// AI로 요약하지 않는다: 기록에 적힌 것만 세고, 없는 값은 0이 아니라 '모름'으로 둔다. 금액은 계산하지 않는다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { checkPermissions, type ActivitySession, type ActivitySummary } from '@/lib/journal/activity';
import type { JournalTool } from '@/lib/journal/types';
import { fetchActivity, subscribeLocal } from '@/lib/local/client';
import { fmtDay, fmtDuration, fmtTime, fmtTokens } from '@/pages/team/format';
import type { AgentCard } from '@/types';

const TOOL_LABEL: Record<JournalTool, string> = { 'claude-code': 'Claude Code', 'codex-cli': 'Codex' };

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-extrabold tabular-nums">{value}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** 토큰은 도구마다 뜻이 달라(Claude Code는 출력 토큰, Codex는 도구가 낸 합계) 더하지 않고 따로 적는다 */
function TokenTile({ claude, codex }: { claude: number; codex: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">기록된 토큰</p>
      <p className="font-heading text-lg font-extrabold tabular-nums">Claude 출력 {fmtTokens(claude)}</p>
      <p className="font-heading text-lg font-extrabold tabular-nums">Codex 합계 {fmtTokens(codex)}</p>
      <p className="text-xs text-muted-foreground">뜻이 달라 더하지 않았어요</p>
    </div>
  );
}

function PermissionCheck({ summary, cards }: { summary: ActivitySummary; cards: AgentCard[] }) {
  const check = checkPermissions(summary.roleEdits, cards);
  if (check.readOnlyRoles.length === 0) return null;
  const caveat = '지금 역할 파일 기준이고, 셸 명령으로 바꾼 파일은 기록만으로는 볼 수 없어요.';
  if (check.issues.length === 0) {
    return (
      <Notice tone="success">
        <p className="font-medium">읽기 전용 팀원({check.readOnlyRoles.join(', ')})이 파일을 고친 기록은 없어요.</p>
        <p className="text-xs">{caveat}</p>
      </Notice>
    );
  }
  return (
    <Notice tone="warn">
      <p className="font-medium">읽기 전용으로 적힌 팀원이 파일을 고친 기록이 있어요.</p>
      <ul className="mt-1 flex flex-col gap-1">
        {check.issues.map((issue) => (
          <li key={issue.role}>
            <span className="font-heading font-extrabold">{issue.role}</span> — 맡은 일 {issue.times}건에서 파일을 고쳤어요
            {issue.lastAt ? ` (마지막 ${fmtTime(issue.lastAt)})` : ''} · {issue.tools.map((tool) => TOOL_LABEL[tool]).join(', ')}
            <br />
            <span className="text-xs">
              <code>{issue.files.join(', ')}</code>
              {issue.files.length >= 6 ? ' …' : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs">
        {check.issues.some((issue) => issue.tools.includes('codex-cli'))
          ? 'Codex는 읽기 전용을 지시문 문장으로만 안내해서 지켜지지 않을 수 있어요. 역할 파일의 지시문을 확인해 보세요. '
          : ''}
        {check.issues.some((issue) => issue.tools.includes('claude-code'))
          ? 'Claude Code는 역할 파일의 도구 목록(tools)으로 막아요. 목록에 Edit·Write가 없는지, 그 뒤에 파일을 고치지 않았는지 확인해 보세요. '
          : ''}
        {caveat}
      </p>
    </Notice>
  );
}

function SessionRow({ item }: { item: ActivitySession }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
      <p className="line-clamp-2 font-medium">{item.title || '(첫 메시지를 찾지 못했어요)'}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {TOOL_LABEL[item.tool]} · {fmtTime(item.startedAt)} · 내가 한 말 {item.turns}번
        {item.delegations > 0 ? ` · 팀원에게 맡긴 일 ${item.delegations}건` : ''}
        {` · 고친 파일 ${item.editedFiles}개`}
        {item.tokens ? ` · ${item.tokens.kind === 'output' ? '출력 토큰' : '토큰(도구 기록 합계)'} ${fmtTokens(item.tokens.value)}` : ''}
      </p>
      {item.topFiles.length > 0 ? (
        <p className="text-xs break-all text-muted-foreground">
          많이 고친 파일: <code>{item.topFiles.join(', ')}</code>
        </p>
      ) : null}
      {item.finalAnswer ? <p className="line-clamp-2 text-sm text-muted-foreground">마지막 말: {item.finalAnswer}</p> : null}
    </li>
  );
}

export function ActivityTab({ projectName, cards }: { projectName: string; cards: AgentCard[] }) {
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
      if (event.root === 'project') return;
      if (timer) return;
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-extrabold">이 폴더에서 AI가 한 일</h2>
          <p className="text-sm text-muted-foreground">
            {projectName}에서 한 Claude Code·Codex 대화 기록을 모았어요.
            {totals?.firstAt ? ` ${fmtDay(totals.firstAt)} ~ ${fmtDay(totals.lastAt)}` : ''}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void load(false)}>
          <RefreshCw aria-hidden />
          다시 읽기
        </Button>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {busy && !summary ? (
        <p className="text-sm text-muted-foreground" role="status">
          기록을 훑는 중이에요. 처음에는 기록이 크면 몇 초 걸려요…
        </p>
      ) : null}

      {summary && totals ? (
        totals.sessions === 0 ? (
          <Notice tone="info">
            이 폴더에서 한 Claude Code·Codex 대화 기록을 찾지 못했어요. Claude Code는 기본으로 30일이 지난 기록을 지워요.
          </Notice>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="대화" value={`${totals.sessions}개`} note={`Claude Code ${totals.claude} · Codex ${totals.codex}`} />
              <Tile label="내가 한 말" value={`${totals.turns}번`} />
              <Tile label="파일 고침" value={`${totals.editCount}번`} note={`서로 다른 파일 ${totals.editedFiles}개`} />
              <TokenTile claude={totals.claudeOutputTokens} codex={totals.codexTokens} />
            </div>

            <PermissionCheck summary={summary} cards={cards} />

            {summary.roles.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="px-4 pt-3 text-left font-heading text-lg font-extrabold">팀원별로 얼마나 일했나</caption>
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">팀원</th>
                      <th className="px-4 py-2 font-medium">맡은 횟수</th>
                      <th className="px-4 py-2 font-medium">걸린 시간</th>
                      <th className="px-4 py-2 font-medium">토큰</th>
                      <th className="px-4 py-2 font-medium">고친 파일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.roles.map((row) => (
                      <tr key={row.role} className="border-b last:border-b-0">
                        <th className="px-4 py-2 font-medium">{row.role}</th>
                        <td className="px-4 py-2 tabular-nums">{row.count}</td>
                        <td className="px-4 py-2 tabular-nums">{fmtDuration(row.durationMs)}</td>
                        <td className="px-4 py-2 tabular-nums">{fmtTokens(row.tokens)}</td>
                        <td className="px-4 py-2 tabular-nums">{row.editedFiles === null ? '모름' : `${row.editedFiles}개`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-4 pb-3 text-xs text-muted-foreground">
                  기록에 적힌 값만 더했어요. 하나라도 기록에 없으면 합계 대신 "모름"으로 보여요. 금액은 계산하지 않아요.
                </p>
              </div>
            ) : null}

            {summary.topFiles.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <caption className="px-4 pt-3 text-left font-heading text-lg font-extrabold">많이 고친 파일</caption>
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">파일</th>
                      <th className="px-4 py-2 font-medium">고친 횟수</th>
                      <th className="px-4 py-2 font-medium">대화 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topFiles.map((file) => (
                      <tr key={file.path} className="border-b last:border-b-0">
                        <td className="px-4 py-2 font-mono text-xs break-all">{file.path}</td>
                        <td className="px-4 py-2 tabular-nums">{file.edits}</td>
                        <td className="px-4 py-2 tabular-nums">{file.sessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-4 pb-3 text-xs text-muted-foreground">
                  AI의 파일 고침 도구로 남은 기록만 세요. 셸 명령(예: 파일 이동·덮어쓰기)으로 바뀐 것은 빠져 있어요.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <h3 className="font-heading text-lg font-extrabold">최근 대화</h3>
              <ul className="flex flex-col gap-2">
                {summary.sessions.map((item) => (
                  <SessionRow key={`${item.tool}-${item.id}`} item={item} />
                ))}
              </ul>
              {summary.sessions.length < totals.sessions ? (
                <p className="text-xs text-muted-foreground">최근 {summary.sessions.length}개만 보여 드려요. 위의 숫자는 {totals.sessions}개 전체를 센 거예요.</p>
              ) : null}
              <p className="text-xs text-muted-foreground">대화마다 누가 누구에게 맡겼는지와 자세한 내용은 "업무 일지"에서 볼 수 있어요.</p>
            </div>

            {summary.uncheckedDelegations > 0 ? (
              <p className="text-xs text-muted-foreground">
                팀원의 세부 기록을 찾지 못해 파일을 고쳤는지 모르는 맡긴 일이 {summary.uncheckedDelegations}건 있어요.
              </p>
            ) : null}
            {summary.notes.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {summary.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </>
        )
      ) : null}

      <p className="text-xs text-muted-foreground">
        읽기만 해요. 대화 기록 파일(.jsonl)만 열고, 요약은 이 화면에만 보이며 저장하거나 보내지 않아요. 기록 형식은 공식 문서에 없어서 도구가
        바뀌면 못 읽을 수 있어요.{summary?.tookMs !== undefined ? ` (읽는 데 ${(summary.tookMs / 1000).toFixed(1)}초)` : ''}
      </p>
    </div>
  );
}
