// 실습 기록 화면들이 같이 쓰는 작은 부품.
// 사용자가 적은 글과 가져온 자료는 모두 글자로만 그린다 (HTML로 해석하지 않는다).

import { useRef, useState, type ReactNode } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common';
import { downloadBytes } from '@/lib/download';
import { RUN_STYLE_LABELS, runStyle } from '@/lib/practice/model';
import { STATUS_LABELS } from '@/lib/practice/rubric';
import type { SaveResult } from '@/lib/practice/storage';
import { FULL_EXPORT, type ExportOptions } from '@/lib/practice/transfer';
import type { PracticeRun } from '@/lib/practice/types';
import { usePractice } from '@/store/usePractice';

const pill = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap';

const STATUS_STYLE: Record<PracticeRun['status'], string> = {
  ready: 'bg-card text-muted-foreground',
  recording: 'border-amber-300 bg-amber-50 text-amber-900',
  done: 'border-foreground/30 bg-card text-foreground',
  stopped: 'border-dashed bg-card text-muted-foreground',
};

/** 방식·상태·데모·가져옴·보관 표시 */
export function RunBadges({ run }: { run: PracticeRun }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={cn(pill, 'bg-card')}>{RUN_STYLE_LABELS[runStyle(run)]}</span>
      <span className={cn(pill, STATUS_STYLE[run.status])}>{STATUS_LABELS[run.status]}</span>
      {run.demo ? <span className={cn(pill, 'border-sky-300 bg-sky-50 text-sky-900')}>합성 데모</span> : null}
      {run.importedAt ? <span className={cn(pill, 'bg-card text-muted-foreground')}>가져온 기록</span> : null}
      {run.archived ? <span className={cn(pill, 'bg-muted text-muted-foreground')}>보관됨</span> : null}
    </span>
  );
}

export function DemoNotice() {
  return (
    <Notice tone="info">
      <strong>합성 데모</strong>예요. 실제로 수행하지 않은 예시 기록이라, 실제 성능 비교의 근거로 쓰면 안 됩니다.
    </Notice>
  );
}

/** 저장 실패 안내. 실패한 내용은 저장되지 않았다는 것과, 지금 기록을 파일로 받아 둘 수 있다는 것을 알린다. */
export function SaveErrorNotice() {
  const saveError = usePractice((state) => state.saveError);
  if (!saveError) return null;
  const backup = () => {
    const { version, tasks, runs, comparisons, unreadable } = usePractice.getState();
    const text = JSON.stringify({ version, tasks, runs, comparisons, unreadable }, null, 2);
    downloadBytes(new TextEncoder().encode(text), 'teamcook-실습기록-백업.json', 'application/json');
  };
  return (
    <Notice tone="error" className="flex flex-wrap items-center justify-between gap-2">
      <span role="alert">{saveError}</span>
      <Button size="sm" variant="outline" onClick={backup}>
        <Download aria-hidden />
        저장된 기록을 파일로 받아 두기
      </Button>
    </Notice>
  );
}

/** 저장 결과를 버튼 옆에 짧게 알린다. 실패하면 성공 문구를 띄우지 않는다. */
export function useSaveStatus() {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const report = (result: SaveResult, okText = '저장했어요') => {
    setStatus(result.ok ? { ok: true, text: okText } : { ok: false, text: result.message });
    return result.ok;
  };
  const view = status ? (
    <span role="status" className={cn('text-sm', status.ok ? 'text-emerald-800' : 'font-medium text-rose-800')}>
      {status.text}
    </span>
  ) : null;
  return { report, view, clear: () => setStatus(null) };
}

/** http(s) 주소만 링크로 만든다. 누르기 전에는 방문하지 않는다. 다른 것은 글자로만. */
export function SafeUrl({ value }: { value: string }) {
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    return <span className="break-all">{value}</span>;
  }
  return (
    <a
      href={url.href}
      target="_blank"
      rel="noreferrer noopener nofollow"
      className="break-all text-primary underline-offset-2 hover:underline"
    >
      {value}
    </a>
  );
}

/** 여러 줄 글을 그대로 보여 준다 (Markdown·HTML로 해석하지 않음) */
export function PlainText({ value, empty = '적지 않았어요', className }: { value: string; empty?: string; className?: string }) {
  if (!value.trim()) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <p className={cn('text-sm leading-relaxed break-words whitespace-pre-wrap', className)}>{value}</p>;
}

/** 탭처럼 생긴 단계 이동 (편집 화면과 같은 모양) */
export function SectionTabs<T extends string>({
  items,
  current,
  onChange,
  label,
}: {
  items: { id: T; label: string; note?: string }[];
  current: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <nav className="flex flex-wrap gap-x-1 border-b" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={item.id === current ? 'step' : undefined}
          onClick={() => onChange(item.id)}
          className={cn(
            '-mb-px flex items-baseline gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
            item.id === current
              ? 'border-primary font-semibold text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
          {item.note ? <span className="text-xs font-normal text-muted-foreground">{item.note}</span> : null}
        </button>
      ))}
    </nav>
  );
}

/**
 * 내보내기 창: 무엇을 넣을지(결과 본문, 발췌, 환경 정보) 고르고, 파일 내용을 미리 본 뒤 내려받는다.
 * build는 고른 옵션으로 파일을 만든다.
 */
export function PracticeExportButton({
  label,
  title,
  build,
  variant = 'outline',
}: {
  label: string;
  title: string;
  build: (options: ExportOptions) => { fileName: string; text: string; type: string };
  variant?: 'outline' | 'default';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ExportOptions>(FULL_EXPORT);
  const file = open ? build(options) : null;
  const toggle = (key: keyof ExportOptions) => setOptions((old) => ({ ...old, [key]: !old[key] }));
  const choices: [keyof ExportOptions, string][] = [
    ['body', '결과 본문'],
    ['excerpts', '증거 발췌와 성공 조건 근거'],
    ['environment', '환경과 도구 버전'],
  ];
  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <Download aria-hidden />
        {label}
      </Button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={title}
        className="m-auto max-h-[92vh] w-[min(44rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border bg-background p-0 text-foreground backdrop:bg-black/45"
      >
        {file ? (
          <div className="flex flex-col gap-4 p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-extrabold">{title}</h2>
              <Button size="icon-sm" variant="ghost" aria-label="닫기" onClick={() => dialog.current?.close()}>
                <X />
              </Button>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium">파일에 넣을 것</legend>
              {choices.map(([key, text]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options[key]} onChange={() => toggle(key)} />
                  {text}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                다른 사람에게 보내기 전에 개인 정보나 회사 자료가 들어 있지 않은지 아래에서 확인하세요. 이 파일은 서버로
                올라가지 않고 내 컴퓨터에 저장됩니다.
              </p>
            </fieldset>
            <pre
              className="max-h-80 overflow-auto rounded-lg border bg-card p-3 font-mono text-xs whitespace-pre-wrap"
              tabIndex={0}
              aria-label="파일 내용 미리보기"
            >
              {file.text.length > 20000 ? `${file.text.slice(0, 20000)}\n…(뒷부분 생략, 파일에는 모두 들어갑니다)` : file.text}
            </pre>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="text-xs text-muted-foreground">{file.fileName}</code>
              <Button
                onClick={() => {
                  downloadBytes(new TextEncoder().encode(file.text), file.fileName, file.type);
                }}
              >
                <Download aria-hidden />
                내려받기
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

export function SectionCard({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** 파일 이름에 쓸 수 없는 글자를 뺀다 */
export function safeFileName(title: string): string {
  return title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'teamcook';
}

