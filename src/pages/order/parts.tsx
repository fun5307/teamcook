// 주문 화면들이 같이 쓰는 부품: 요구 한 줄, 질문 묶음, 영수증 요약, 작은 표시들.

import { useState, type ReactNode } from 'react';
import { Check, Plus, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { includedWork } from '@/lib/order/toRecipe';
import {
  KIND_LABELS,
  SOURCE_LABELS,
  STATE_LABELS,
  STATUS_LABELS,
  type OpenQuestion,
  type OrderDraft,
  type ProposalState,
  type Requirement,
  type RequirementKind,
} from '@/lib/order/types';
import { newId } from '@/lib/id';

export const SOURCE_STYLE: Record<Requirement['source'], string> = {
  explicit: 'border-foreground/40 text-foreground',
  rule: 'border-dashed border-input text-muted-foreground',
  user: 'border-emerald-300 text-emerald-900',
  assumption: 'border-amber-300 bg-amber-50 text-amber-900',
};

export function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', className)}>{children}</span>;
}

export function StateButtons({ state, onChange }: { state: ProposalState; onChange: (state: ProposalState) => void }) {
  if (state === 'proposed') {
    return (
      <span className="flex gap-1">
        <Button size="xs" variant="outline" onClick={() => onChange('accepted')}>
          <Check aria-hidden />
          확정
        </Button>
        <Button size="xs" variant="ghost" onClick={() => onChange('excluded')}>
          <X aria-hidden />
          제외
        </Button>
      </span>
    );
  }
  return (
    <Button size="xs" variant="ghost" onClick={() => onChange('proposed')} title="제안 상태로 되돌리기">
      <Undo2 aria-hidden />
      {STATE_LABELS[state]} 취소
    </Button>
  );
}

/** 요구 한 줄: 내용, 출처, 상태, 근거 */
export function RequirementRow({
  item,
  stale,
  sourceName,
  onChange,
  onRemove,
}: {
  item: Requirement;
  stale?: string;
  sourceName: (id: string) => string;
  onChange: (next: Requirement) => void;
  onRemove: () => void;
}) {
  return (
    <li className={cn('flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5', item.state === 'excluded' && 'opacity-55', item.state === 'accepted' && 'border-foreground/50')}>
      <div className="flex flex-wrap items-start gap-2">
        <Input
          aria-label={`${KIND_LABELS[item.kind]} 내용`}
          className={cn('h-auto min-w-0 flex-1 basis-60 border-0 bg-transparent px-0 py-0.5 text-[15px] shadow-none focus-visible:ring-0', item.state === 'excluded' && 'line-through')}
          value={item.text}
          onChange={(event) => onChange({ ...item, text: event.target.value, source: item.source === 'rule' || item.source === 'explicit' ? 'user' : item.source })}
        />
        <span className="flex items-center gap-1.5">
          <Chip className={SOURCE_STYLE[item.source]}>{SOURCE_LABELS[item.source]}</Chip>
          <StateButtons state={item.state} onChange={(state) => onChange({ ...item, state })} />
          <Button size="icon-xs" variant="ghost" aria-label="이 항목 지우기" onClick={onRemove}>
            <X />
          </Button>
        </span>
      </div>
      {item.evidence ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">근거: {sourceName(item.evidence.sourceId)}</summary>
          <blockquote className="mt-1 border-l-2 pl-2 whitespace-pre-wrap">{item.evidence.excerpt}</blockquote>
        </details>
      ) : null}
      {stale ? <p className="text-xs font-medium text-amber-800">{stale} 다시 확인해 주세요.</p> : null}
    </li>
  );
}

/** 같은 종류의 요구 묶음 + 직접 더하기 */
export function RequirementGroup({
  order,
  kind,
  hint,
  staleMap,
  sourceName,
  onChange,
}: {
  order: OrderDraft;
  kind: RequirementKind;
  hint?: string;
  staleMap: Map<string, string>;
  sourceName: (id: string) => string;
  onChange: (requirements: Requirement[]) => void;
}) {
  const [value, setValue] = useState('');
  const [assumption, setAssumption] = useState(false);
  const items = order.requirements.filter((item) => item.kind === kind);
  const replace = (next: Requirement) => onChange(order.requirements.map((item) => (item.id === next.id ? next : item)));
  const add = () => {
    if (!value.trim()) return;
    onChange([...order.requirements, { id: newId('req'), kind, text: value.trim(), source: assumption ? 'assumption' : 'user', state: assumption ? 'proposed' : 'accepted' }]);
    setValue('');
  };
  return (
    <section className="flex flex-col gap-2" aria-label={KIND_LABELS[kind]}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-heading text-lg font-extrabold">{KIND_LABELS[kind]}</h3>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">아직 없어요.</p> : null}
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <RequirementRow
            key={item.id}
            item={item}
            stale={staleMap.get(item.id)}
            sourceName={sourceName}
            onChange={replace}
            onRemove={() => onChange(order.requirements.filter((entry) => entry.id !== item.id))}
          />
        ))}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Input aria-label={`${KIND_LABELS[kind]} 더하기`} className="min-w-0 flex-1 basis-60 bg-card" placeholder={`${KIND_LABELS[kind]} 직접 적기`} value={value} onChange={(event) => setValue(event.target.value)} />
        {kind === 'constraint' || kind === 'current' ? (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={assumption} onChange={(event) => setAssumption(event.target.checked)} />
            가정으로
          </label>
        ) : null}
        <Button size="sm" variant="outline" type="submit" disabled={!value.trim()}>
          <Plus aria-hidden />
          더하기
        </Button>
      </form>
    </section>
  );
}

/** 질문 묶음: 열린 질문을 한 번에 3개까지. 미정·나중에로 넘길 수 있다. */
export function QuestionsPanel({ order, onChange }: { order: OrderDraft; onChange: (questions: OpenQuestion[]) => void }) {
  const [free, setFree] = useState<Record<string, string>>({});
  const open = order.questions.filter((item) => item.state === 'open');
  const shown = open.slice(0, 3);
  const others = order.questions.filter((item) => item.state !== 'open');
  if (order.questions.length === 0) return null;
  const set = (id: string, patch: Partial<OpenQuestion>) => onChange(order.questions.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-foreground bg-card p-4" aria-label="중요 질문">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-lg font-extrabold">먼저 정하면 좋은 것</h3>
        <span className="text-xs text-muted-foreground">답하지 않아도 다음으로 넘어갈 수 있어요{open.length > 3 ? ` · 남은 질문 ${open.length - 3}개` : ''}</span>
      </div>
      {shown.length === 0 ? <p className="text-sm text-muted-foreground">열린 질문이 없어요.</p> : null}
      {shown.map((item) => (
        <div key={item.id} className="flex flex-col gap-2 border-t pt-3 first-of-type:border-t-0 first-of-type:pt-0">
          <p className="font-medium">{item.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {item.options?.map((option) => (
              <Button key={option} size="sm" variant="outline" onClick={() => set(item.id, { answer: option, state: 'answered' })}>
                {option}
              </Button>
            ))}
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (free[item.id]?.trim()) set(item.id, { answer: free[item.id].trim(), state: 'answered' });
            }}
          >
            <Input aria-label={`${item.text} 직접 답하기`} className="min-w-0 flex-1 basis-48 bg-background" placeholder="직접 답하기" value={free[item.id] ?? ''} onChange={(event) => setFree({ ...free, [item.id]: event.target.value })} />
            <Button size="sm" type="submit" variant="outline" disabled={!free[item.id]?.trim()}>
              답하기
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => set(item.id, { state: 'undecided' })}>
              미정
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => set(item.id, { state: 'later' })}>
              나중에 답하기
            </Button>
          </form>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={item.mustDecide} onChange={(event) => set(item.id, { mustDecide: event.target.checked })} />
            확정 전에 꼭 정해야 해요 (정하지 않으면 실행 준비에서 막아요)
          </label>
        </div>
      ))}
      {others.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">답했거나 넘긴 질문 {others.length}개</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {others.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <span>{item.text}</span>
                <span className="text-muted-foreground">
                  → {item.state === 'answered' ? item.answer : item.state === 'undecided' ? '미정' : '나중에'}
                  {item.mustDecide && item.state !== 'answered' ? ' (꼭 정해야 함)' : ''}
                </span>
                <Button size="xs" variant="ghost" onClick={() => set(item.id, { state: 'open' })}>
                  다시 열기
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** 오른쪽의 영수증 모양 주문 요약 */
export function Receipt({ order, recipeTitle }: { order: OrderDraft; recipeTitle?: string }) {
  const accepted = (kind: RequirementKind) => order.requirements.filter((item) => item.kind === kind && item.state === 'accepted');
  const work = includedWork(order);
  const proposed = order.work.filter((item) => item.state === 'proposed').length;
  const open = order.questions.filter((item) => item.state !== 'answered').length;
  const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="leader" aria-hidden />
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="ticket flex flex-col gap-3 px-5 pt-7 pb-8">
      <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2">
        <span className="font-heading text-xl font-extrabold">주문 요약</span>
        <span className="text-xs text-muted-foreground">{STATUS_LABELS[order.status]}</span>
      </div>
      <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{order.request.text || '(원문 없음)'}</p>
      <div className="flex flex-col gap-1.5 border-t border-dashed border-input pt-3">
        <p className="text-xs font-bold text-primary">목표</p>
        <p className="text-sm">{accepted('goal')[0]?.text ?? <span className="text-muted-foreground">확정 전</span>}</p>
        <p className="text-xs font-bold text-primary">최종 결과물</p>
        <p className="text-sm">{accepted('deliverable').map((item) => item.text).join(', ') || <span className="text-muted-foreground">확정 전</span>}</p>
      </div>
      <div className="flex flex-col gap-1 border-t border-dashed border-input pt-3">
        <Row label="성공 조건" value={accepted('success').length} />
        <Row label="작업" value={`${work.length}${proposed > 0 ? ` (+제안 ${proposed})` : ''}`} />
        <Row label="역할" value={order.roles.length} />
        <Row label="자료" value={order.request.materials.length} />
        <Row label="정하지 않은 질문" value={open} />
      </div>
      {recipeTitle ? (
        <p className="border-t border-dashed border-input pt-3 text-xs text-muted-foreground">
          만든 레시피: <span className="font-medium text-foreground">{recipeTitle}</span>
        </p>
      ) : null}
      <p className="text-center font-mono text-[10px] tracking-wider text-muted-foreground">
        No. {order.id.slice(-8)} · 수정 {order.revision}
      </p>
    </div>
  );
}
