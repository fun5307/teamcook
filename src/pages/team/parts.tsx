// 작업실 화면(활동·업무 일지)이 함께 쓰는 작은 부품.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';
import type { JournalTool } from '@/lib/journal/types';

export const TOOL_LABEL: Record<JournalTool, string> = { 'claude-code': 'Claude Code', 'codex-cli': 'Codex' };

/** 도구의 회사 로고 (Claude Code = Anthropic, Codex = OpenAI) */
export function ToolLogo({ tool, className }: { tool: JournalTool; className?: string }) {
  return <BrandLogo provider={tool === 'claude-code' ? 'anthropic' : 'openai'} className={className} />;
}

/** 긴 글은 몇 줄만 보이고 "전체 보기"로 편다. 짧은 글은 그대로. */
export function ExpandableText({
  text,
  lines = 3,
  empty = '(기록에 없음)',
  className,
}: {
  text: string;
  lines?: 2 | 3 | 4 | 6;
  empty?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const value = text.trim();
  if (!value) return <p className="text-sm text-muted-foreground">{empty}</p>;
  // 대략 이 정도면 접힌 줄 수를 넘는다고 본다
  const long = value.length > lines * 90 || value.split('\n').length > lines;
  const clamp = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4', 6: 'line-clamp-6' }[lines];
  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <p className={cn('text-sm leading-relaxed break-words whitespace-pre-wrap', long && !open && clamp)}>{value}</p>
      {long ? (
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(!open)}>
          {open ? '접기' : '전체 보기'}
        </button>
      ) : null}
    </div>
  );
}

/** 목록의 "더 보기 · N개 더 / 접기" */
export function ShowMore({ open, hidden, onToggle }: { open: boolean; hidden: number; onToggle: () => void }) {
  if (hidden <= 0 && !open) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-center gap-1.5 border-t py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {open ? '접기' : `더 보기 · ${hidden}개 더`}
      <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
    </button>
  );
}
