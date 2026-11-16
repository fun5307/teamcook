// 여러 화면에서 같이 쓰는 작은 부품들.

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

/** 브라우저 기본 선택 상자를 입력칸과 같은 모양으로 꾸민 것 */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/** 식품 라벨의 표처럼 줄로 나눈 "이름 | 값" 목록. 굵은 줄이 있는 제목(label-rule) 바로 아래에 둔다. */
export function FactTable({ rows, className }: { rows: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('border-b-4 text-sm', className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-3 border-t py-1.5 first:border-t-0">
          <dt className="w-24 shrink-0 font-bold">{label}</dt>
          <dd className="min-w-0 flex-1 text-pretty">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 이름표 + 입력칸 + 도움말 한 묶음 */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const NOTICE_STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

/** 색이 있는 안내 상자 */
export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_STYLES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-sm', NOTICE_STYLES[tone], className)}>
      {children}
    </div>
  );
}

/** 페이지 제목 줄 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
