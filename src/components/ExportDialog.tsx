// '내보내기' 창. 맨 위에 "받을 수 있는지"와 내려받기 버튼을 두고, 나머지(채우면 좋은 것, 파일 미리 보기)는 접어 둔다.
// 점검과 파일은 한 번에 만든 묶음(buildExportBundle) 하나에서 나온다. 레시피를 고치면 묶음도 새로 만들어지므로
// 미리 본 내용과 다른 옛 파일이 내려받아지지 않는다.

import { useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Download, PackageCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { engineName } from '@/components/RouteInfo';
import { COLLABORATIONS, collaborationOf } from '@/data/collaboration';
import { providerData } from '@/data/providers';
import { downloadBytes } from '@/lib/download';
import type { ExportIssue, IssueLevel } from '@/lib/exportCheck';
import { ExportBlockedError, buildExportBundle, zipBundle, zipFileName } from '@/lib/exportZip';
import { effectiveEngine } from '@/lib/support';
import type { Collaboration, Recipe, UserPlans } from '@/types';

/** 내려받은 다음에 할 일 (자세한 내용은 zip 안의 RECIPE.md) */
const NEXT_STEPS: Record<Collaboration, string[]> = {
  subagents: [
    'zip을 풀고, 안의 .codex 폴더와 .claude 폴더를 내 프로젝트 폴더 맨 위에 복사합니다.',
    '그 폴더에서 codex 또는 claude를 실행합니다.',
    'RECIPE.md의 "첫 프롬프트 예시"를 붙여 넣고 "할 일"만 바꿔 보냅니다.',
  ],
  'agent-team': [
    'zip을 풀고, 안의 .claude 폴더를 내 프로젝트 폴더 맨 위에 복사합니다.',
    'Claude Code를 새로 시작합니다.',
    'RECIPE.md의 "첫 프롬프트 (팀원 소개)"를 붙여 넣고 "할 일"만 바꿔 보냅니다.',
  ],
  debate: [
    'zip을 풀고 debate-prompt.txt를 엽니다. 설치할 것은 없습니다.',
    '내용을 통째로 복사해 쓰는 AI 채팅에 붙여 넣습니다.',
    '"주제:" 줄만 바꿔 보냅니다.',
  ],
};

/** 무엇이 들어가는지 한 줄로 */
function targetLine(recipe: Recipe, style: Collaboration, codexBridge: boolean): string {
  if (style === 'debate') return '토론형이라 설정 파일 없이 프롬프트만 들어갑니다.';
  const who = recipe.cards
    .map((card) => `${card.displayName || card.name}는 ${engineName(effectiveEngine(card, style))}`)
    .join(', ');
  if (style === 'agent-team') return `${who}에서 돕니다. Claude Code용 파일만 들어갑니다.`;
  return `${who}에서 돕니다. 어느 도구에서든 쓸 수 있게 Codex와 Claude Code 두 형식을 함께 넣습니다.${
    codexBridge ? ' Codex 담당 역할은 Claude Code에서 자동으로 불러오게 했습니다.' : ''
  }`;
}

function IssueList({
  issues,
  onPick,
}: {
  issues: ExportIssue[];
  onPick?: (issue: ExportIssue) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue) => (
        <li key={`${issue.code}-${issue.target.id ?? ''}-${issue.target.field}`} data-code={issue.code} className="text-sm">
          {onPick ? (
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left underline-offset-2 hover:bg-black/5 hover:underline"
              onClick={() => onPick(issue)}
            >
              {issue.message}
            </button>
          ) : (
            <span className="block px-2 py-1.5">{issue.message}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ExportPrepButton({
  recipe,
  plans,
  codexBridge = false,
  onGoto,
}: {
  recipe: Recipe;
  plans: UserPlans;
  /** Claude Code가 Codex 담당 카드를 codex exec로 부르게 내보낼지 (실험적) */
  codexBridge?: boolean;
  /** 점검 항목을 눌렀을 때 그 입력 칸으로 옮겨 가는 함수 (편집 화면에서만 준다) */
  onGoto?: (issue: ExportIssue) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  // 창이 열려 있는 동안에는 레시피가 바뀔 때마다 점검과 파일을 함께 다시 만든다
  const bundle = useMemo(
    () => (open ? buildExportBundle(recipe, providerData, { plans, codexBridge }) : null),
    [open, recipe, plans, codexBridge],
  );

  const show = () => {
    setOpen(true);
    setFailure('');
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const pick = onGoto
    ? (issue: ExportIssue) => {
        close();
        onGoto(issue);
      }
    : undefined;

  const style = collaborationOf(recipe);
  const of = (level: IssueLevel) => bundle?.issues.filter((issue) => issue.level === level) ?? [];
  const errors = of('error');
  const tips = of('warn');
  const notes = of('info');
  const file =
    bundle?.files.find((item) => item.path === selected) ??
    bundle?.files.find((item) => item.path === 'RECIPE.md') ??
    bundle?.files[0];
  const mergeFiles = bundle?.files.filter((item) => item.mergeNeeded) ?? [];

  const onDownload = async () => {
    if (!bundle) return;
    setBusy(true);
    setFailure('');
    try {
      downloadBytes(await zipBundle(bundle), zipFileName(recipe), 'application/zip');
    } catch (error) {
      setFailure(error instanceof ExportBlockedError ? error.message : 'zip을 만들지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={show}>
        <PackageCheck aria-hidden />
        내보내기
      </Button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="export-title"
        className="m-auto max-h-[92vh] w-[min(46rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border bg-background p-0 text-foreground backdrop:bg-black/45"
      >
        {bundle ? (
          <div className="flex flex-col gap-5 p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="export-title" className="text-2xl font-extrabold">
                  내보내기
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recipe.title} · {COLLABORATIONS[style].label}
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="닫기" onClick={close}>
                <X />
              </Button>
            </div>

            {bundle.blocked ? (
              <section className="flex flex-col gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950">
                <p className="flex items-center gap-2 font-semibold">
                  <CircleAlert className="size-5 shrink-0" aria-hidden />
                  {errors.length}곳만 고치면 받을 수 있어요
                </p>
                <IssueList issues={errors} onPick={pick} />
                {!onGoto ? (
                  <p className="text-sm">이 창을 닫고 "내 레시피로 가져오기"를 누르면 고칠 수 있어요.</p>
                ) : null}
              </section>
            ) : (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
                <p className="flex items-center gap-2 font-semibold">
                  <CircleCheck className="size-5 shrink-0" aria-hidden />
                  바로 받을 수 있어요
                </p>
                <Button onClick={onDownload} disabled={busy}>
                  <Download aria-hidden />
                  zip 내려받기
                </Button>
              </section>
            )}
            {failure ? (
              <p className="text-sm font-medium text-rose-800" role="alert">
                {failure}
              </p>
            ) : null}

            <p className="text-sm text-muted-foreground">{targetLine(recipe, style, codexBridge)}</p>

            {tips.length > 0 ? (
              <details className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  채우면 더 좋아요 {tips.length}가지{' '}
                  <span className="font-normal text-muted-foreground">안 채워도 받을 수 있어요</span>
                </summary>
                <div className="mt-2">
                  <IssueList issues={tips} onPick={pick} />
                </div>
              </details>
            ) : null}

            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">
                들어 있는 파일 {bundle.files.length}개 미리 보기
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="파일 목록">
                  {bundle.files.map((item) => (
                    <li key={item.path}>
                      <button
                        type="button"
                        aria-pressed={item.path === file?.path}
                        onClick={() => setSelected(item.path)}
                        className={cn(
                          'flex w-full flex-col rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                          item.path === file?.path ? 'border-foreground' : 'hover:bg-muted',
                        )}
                      >
                        <code className="text-xs break-all">{item.path}</code>
                        <span className="text-xs text-muted-foreground">{item.purpose}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <pre
                  className="max-h-72 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs whitespace-pre-wrap"
                  aria-label={file ? `${file.path} 미리보기` : '파일 미리보기'}
                  tabIndex={0}
                >
                  {file?.content ?? ''}
                </pre>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">여기 보이는 내용이 그대로 zip에 담깁니다.</p>
            </details>

            <section className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold">받은 다음에는</h3>
              <ol className="list-decimal pl-5 text-sm leading-relaxed">
                {NEXT_STEPS[style].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                {mergeFiles.length > 0
                  ? `${mergeFiles.map((item) => item.path).join(', ')} 파일이 이미 있다면 덮어쓰지 말고 합쳐 주세요. `
                  : ''}
                자세한 순서와 문제가 생겼을 때 볼 것은 zip 안의 RECIPE.md에 있습니다.
              </p>
            </section>

            {notes.length > 0 ? (
              <p className="border-t pt-3 text-xs text-muted-foreground" data-notes>
                알아 두세요: {notes.map((issue) => issue.message).join(' ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
