// 화면 C — 작업 설계: 한 층의 순서 있는 작업 카드. 작업과 역할은 따로다 (작업을 더해도 에이전트가 생기지 않는다).
// 지우기·나누기·합치기·산출물 지우기는 끊기는 참조를 먼저 보여 주고 확인을 받는다.

import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, GitMerge, Plus, Scissors, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect, Notice } from '@/components/common';
import { LineListEditor } from '@/components/SpecEditors';
import { newId } from '@/lib/id';
import {
  blankWork,
  brokenRefs,
  commonConditions,
  mergeImpact,
  mergeWork,
  moveWork,
  outputRemovalImpact,
  overrideConflicts,
  parallelCandidates,
  removeOutput,
  removeWork,
  splitWork,
  workRemovalImpact,
} from '@/lib/order/ops';
import { ROLE_LABELS } from '@/lib/roles';
import type { Dependency, WorkItem } from '@/lib/order/types';
import type { RoleTag } from '@/types';
import { Chip, QuestionsPanel, StateButtons } from '@/pages/order/parts';
import type { StepProps } from '@/pages/order/OrderPage';

type Pending =
  | { kind: 'remove'; workId: string }
  | { kind: 'output'; workId: string; outputId: string }
  | { kind: 'merge'; workId: string; otherId: string }
  | { kind: 'split'; workId: string; title: string; outputIds: string[] }
  | null;

function WorkCard({
  item,
  index,
  props,
  setPending,
}: {
  item: WorkItem;
  index: number;
  props: StepProps;
  setPending: (pending: Pending) => void;
}) {
  const { order, save } = props;
  const [output, setOutput] = useState('');
  const update = (patch: Partial<WorkItem>) => save({ ...order, work: order.work.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)) });
  const incoming = order.deps.filter((dep) => dep.to === item.id);
  const others = order.work.filter((entry) => entry.id !== item.id);
  const setDep = (depId: string, patch: Partial<Dependency>) => save({ ...order, deps: order.deps.map((dep) => (dep.id === depId ? { ...dep, ...patch } : dep)) });
  const conflicts = overrideConflicts(order, item);
  const broken = brokenRefs(order).filter((problem) => incoming.some((dep) => dep.id === problem.depId));

  return (
    <li className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5', item.state === 'excluded' && 'opacity-55', item.state === 'proposed' && 'border-dashed')}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground font-heading text-sm font-extrabold text-background tabular-nums">{index + 1}</span>
        <Input
          aria-label={`작업 ${index + 1} 할 일`}
          className="h-auto min-w-0 flex-1 basis-48 border-0 bg-transparent px-0 font-heading text-xl font-extrabold shadow-none focus-visible:ring-0"
          value={item.title}
          onChange={(event) => update({ title: event.target.value })}
        />
        <span className="flex flex-wrap items-center gap-1">
          <Chip className={item.origin === 'rule' ? 'border-dashed text-muted-foreground' : 'border-emerald-300 text-emerald-900'}>{item.origin === 'rule' ? '규칙 기반 제안' : '사용자 추가'}</Chip>
          <StateButtons state={item.state} onChange={(state) => update({ state })} />
          <Button size="icon-xs" variant="ghost" aria-label="위로" onClick={() => save(moveWork(order, item.id, -1))}>
            <ArrowUp />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="아래로" onClick={() => save(moveWork(order, item.id, 1))}>
            <ArrowDown />
          </Button>
        </span>
      </div>
      <Textarea aria-label={`작업 ${index + 1} 설명`} rows={2} className="bg-background" placeholder="무엇을 하는지" value={item.description} onChange={(event) => update({ description: event.target.value })} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-primary">제출할 결과</p>
          <ul className="flex flex-wrap gap-1.5">
            {item.outputs.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2.5 text-sm">
                <input
                  aria-label="산출물 이름"
                  className="w-auto min-w-0 bg-transparent outline-none"
                  size={Math.max(4, entry.name.length + 1)}
                  value={entry.name}
                  onChange={(event) => update({ outputs: item.outputs.map((out) => (out.id === entry.id ? { ...out, name: event.target.value } : out)) })}
                />
                <button type="button" className="rounded-full p-0.5 hover:bg-muted" aria-label={`${entry.name} 지우기`} onClick={() => setPending({ kind: 'output', workId: item.id, outputId: entry.id })}>
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!output.trim()) return;
              update({ outputs: [...item.outputs, { id: newId('out'), name: output.trim() }] });
              setOutput('');
            }}
          >
            <Input aria-label="산출물 더하기" className="h-8 bg-background" placeholder="산출물 더하기" value={output} onChange={(event) => setOutput(event.target.value)} />
            <Button size="sm" variant="outline" type="submit" disabled={!output.trim()}>
              <Plus aria-hidden />
            </Button>
          </form>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-primary">완료 기준</p>
          <LineListEditor id={`${item.id}-criteria`} label="완료 기준" items={item.criteria} onChange={(criteria) => update({ criteria: criteria ?? [] })} addLabel="기준 더하기" />
        </div>
      </div>

      <details className="rounded-lg bg-muted/60 px-3 py-2" open={broken.length > 0 || conflicts.length > 0}>
        <summary className="cursor-pointer text-sm font-medium">
          입력·선행 작업·개별 조건·확인 지점{' '}
          <span className="font-normal text-muted-foreground">
            {incoming.length > 0 ? `선행 ${incoming.length}` : '선행 없음'}
            {item.checkpoint ? ' · 확인 지점' : ''}
            {item.overrides.length > 0 ? ` · 개별 조건 ${item.overrides.length}` : ''}
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <p className="font-medium">필요한 입력·관련 자료</p>
            <LineListEditor id={`${item.id}-inputs`} label="필요한 입력" items={item.inputs} onChange={(inputs) => update({ inputs: inputs ?? [] })} addLabel="입력 더하기" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium">선행 작업과 넘겨받을 결과</p>
            {broken.map((problem) => (
              <p key={problem.depId + problem.message} className="font-medium text-rose-800">
                {problem.message}
              </p>
            ))}
            {incoming.map((dep) => {
              const from = order.work.find((entry) => entry.id === dep.from);
              return (
                <div key={dep.id} className="flex flex-col gap-1.5 rounded-lg border bg-background p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <NativeSelect aria-label="선행 작업" className="w-auto" value={dep.from} onChange={(event) => setDep(dep.id, { from: event.target.value, outputIds: order.work.find((entry) => entry.id === event.target.value)?.outputs.map((out) => out.id) ?? [] })}>
                      {others.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.title}
                        </option>
                      ))}
                      {!from ? <option value={dep.from}>(지워진 작업)</option> : null}
                    </NativeSelect>
                    <span className="text-muted-foreground">에서 받기</span>
                    <Button size="xs" variant="ghost" onClick={() => save({ ...order, deps: order.deps.filter((entry) => entry.id !== dep.id) })}>
                      연결 끊기
                    </Button>
                  </div>
                  {from && from.outputs.length > 0 ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {from.outputs.map((out) => (
                        <label key={out.id} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={dep.outputIds.includes(out.id)}
                            onChange={() => setDep(dep.id, { outputIds: dep.outputIds.includes(out.id) ? dep.outputIds.filter((id) => id !== out.id) : [...dep.outputIds, out.id] })}
                          />
                          {out.name}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <Input aria-label="전달 설명" className="h-8" placeholder="전달 설명 (선택)" value={dep.note} onChange={(event) => setDep(dep.id, { note: event.target.value })} />
                </div>
              );
            })}
            {others.length > 0 ? (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const from = others.find((entry) => !incoming.some((dep) => dep.from === entry.id)) ?? others[0];
                    save({ ...order, deps: [...order.deps, { id: newId('dep'), from: from.id, to: item.id, outputIds: from.outputs.map((out) => out.id), note: '' }] });
                  }}
                >
                  <Plus aria-hidden />
                  선행 작업 더하기
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-medium">이 작업만의 조건 <span className="font-normal text-muted-foreground">공통 조건은 그대로 물려받아요. 여기에는 다른 점만 적어요.</span></p>
            <LineListEditor id={`${item.id}-overrides`} label="개별 조건" items={item.overrides} onChange={(overrides) => update({ overrides: overrides ?? [] })} addLabel="개별 조건 더하기" />
            {conflicts.map((message) => (
              <p key={message} className="font-medium text-amber-800">
                {message}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={item.checkpoint} onChange={(event) => update({ checkpoint: event.target.checked })} />
              끝나면 사용자 확인 후 다음으로 (프롬프트로 전하는 안내예요)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={item.required} onChange={(event) => update({ required: event.target.checked })} />
              필수 작업
            </label>
            <label className="flex items-center gap-1.5">
              작업 성격
              <NativeSelect aria-label="작업 성격" className="w-auto" value={item.type} onChange={(event) => update({ type: event.target.value as RoleTag })}>
                {(Object.keys(ROLE_LABELS) as RoleTag[]).map((tag) => (
                  <option key={tag} value={tag}>
                    {ROLE_LABELS[tag]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          {item.evidence ? <p className="text-xs text-muted-foreground">근거: {item.evidence.excerpt}</p> : null}
        </div>
      </details>

      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" variant="ghost" onClick={() => setPending({ kind: 'split', workId: item.id, title: `${item.title} (나눔)`, outputIds: [] })}>
          <Scissors aria-hidden />
          나누기
        </Button>
        {others.length > 0 ? (
          <Button size="xs" variant="ghost" onClick={() => setPending({ kind: 'merge', workId: item.id, otherId: others[0].id })}>
            <GitMerge aria-hidden />
            다른 작업과 합치기
          </Button>
        ) : null}
        <Button size="xs" variant="ghost" onClick={() => setPending({ kind: 'remove', workId: item.id })}>
          <Trash2 aria-hidden />
          지우기
        </Button>
      </div>
    </li>
  );
}

/** 지우기·합치기·나누기 전에 영향 확인 */
function PendingPanel({ pending, setPending, props }: { pending: Pending; setPending: (pending: Pending) => void; props: StepProps }) {
  const { order, save } = props;
  if (!pending) return null;
  const work = order.work.find((item) => item.id === pending.workId);
  if (!work) return null;
  const titleOf = (id: string) => order.work.find((item) => item.id === id)?.title ?? '(지워진 작업)';
  const done = (next: typeof order) => {
    save(next);
    setPending(null);
  };
  let body: ReactNode = null;
  let confirm: (() => void) | null = null;
  if (pending.kind === 'remove') {
    const impact = workRemovalImpact(order, work.id);
    body = (
      <>
        <p className="font-medium">"{work.title}"을(를) 지우면</p>
        <ul className="list-disc pl-5">
          {impact.deps.map((dep) => (
            <li key={dep.id}>전달 "{titleOf(dep.from)} → {titleOf(dep.to)}"이 끊겨요</li>
          ))}
          {impact.assignments > 0 ? <li>담당 배정 {impact.assignments}건이 없어져요</li> : null}
          {impact.questions.map((text) => (
            <li key={text}>질문 "{text}"과의 연결이 없어져요</li>
          ))}
          {impact.deps.length + impact.assignments + impact.questions.length === 0 ? <li>끊기는 연결은 없어요</li> : null}
        </ul>
      </>
    );
    confirm = () => done(removeWork(order, work.id));
  }
  if (pending.kind === 'output') {
    const name = work.outputs.find((out) => out.id === pending.outputId)?.name;
    const deps = outputRemovalImpact(order, work.id, pending.outputId);
    body = (
      <>
        <p className="font-medium">산출물 "{name}"을(를) 지우면</p>
        <ul className="list-disc pl-5">
          {deps.map((dep) => (
            <li key={dep.id}>"{titleOf(dep.to)}"이(가) 이 결과를 더 받지 못해요</li>
          ))}
          {deps.length === 0 ? <li>이 결과를 받는 작업은 없어요</li> : null}
        </ul>
      </>
    );
    confirm = () => done(removeOutput(order, work.id, pending.outputId));
  }
  if (pending.kind === 'merge') {
    const impact = mergeImpact(order, work.id, pending.otherId);
    body = (
      <>
        <p className="font-medium">"{work.title}"에 다른 작업을 합쳐요</p>
        <NativeSelect aria-label="합칠 작업" value={pending.otherId} onChange={(event) => setPending({ ...pending, otherId: event.target.value })}>
          {order.work.filter((item) => item.id !== work.id).map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </NativeSelect>
        <ul className="list-disc pl-5">
          <li>산출물·완료 기준·입력·개별 조건이 하나로 모여요</li>
          {impact.redirected.map((dep) => (
            <li key={dep.id}>전달 "{titleOf(dep.from)} → {titleOf(dep.to)}"이 합친 작업으로 옮겨져요</li>
          ))}
          {impact.dropped.map((dep) => (
            <li key={dep.id}>두 작업 사이의 전달 "{titleOf(dep.from)} → {titleOf(dep.to)}"은 없어져요</li>
          ))}
        </ul>
      </>
    );
    confirm = () => done(mergeWork(order, work.id, pending.otherId));
  }
  if (pending.kind === 'split') {
    body = (
      <>
        <p className="font-medium">"{work.title}"을(를) 둘로 나눠요. 새 작업은 바로 뒤에 생기고, 원래 작업의 결과를 받아요.</p>
        <Input aria-label="새 작업 이름" value={pending.title} onChange={(event) => setPending({ ...pending, title: event.target.value })} />
        {work.outputs.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span>새 작업으로 옮길 산출물 (그 산출물을 받던 전달도 새 작업에서 나가요)</span>
            {work.outputs.map((out) => (
              <label key={out.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={pending.outputIds.includes(out.id)}
                  onChange={() => setPending({ ...pending, outputIds: pending.outputIds.includes(out.id) ? pending.outputIds.filter((id) => id !== out.id) : [...pending.outputIds, out.id] })}
                />
                {out.name}
              </label>
            ))}
          </div>
        ) : null}
      </>
    );
    confirm = () => done(splitWork(order, work.id, pending.title, pending.outputIds).order);
  }
  return (
    <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border-2 border-foreground bg-background p-4 text-sm shadow-lg" role="dialog" aria-label="바꾸기 전 확인">
      {body}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => confirm?.()}>
          <Check aria-hidden />
          이대로 하기
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
          취소
        </Button>
      </div>
    </div>
  );
}

export function WorkStep(props: StepProps) {
  const { order, save, go } = props;
  const [pending, setPending] = useState<Pending>(null);
  const common = commonConditions(order);
  const proposed = order.work.filter((item) => item.state === 'proposed');
  const parallel = parallelCandidates(order).slice(0, 3);
  const titleOf = (id: string) => order.work.find((item) => item.id === id)?.title ?? '';

  return (
    <div className="flex flex-col gap-5">
      <QuestionsPanel order={order} onChange={(questions) => save({ ...order, questions })} />
      <section className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-sm" aria-label="공통 조건">
        <p className="font-heading text-lg font-extrabold">모든 작업에 적용되는 조건</p>
        {common.length === 0 ? (
          <p className="text-muted-foreground">확정한 조건·제외 범위가 없어요. 주문 정리의 "더 적기"에서 정할 수 있어요.</p>
        ) : (
          <ul className="list-disc pl-5">
            {common.map((item) => (
              <li key={item.id}>
                {item.kind === 'exclusion' ? '하지 않을 것: ' : ''}
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {proposed.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm">
          <span>규칙이 제안한 작업 {proposed.length}개 (점선 카드). 확정한 작업만 레시피에 들어가요.</span>
          <Button size="sm" variant="outline" onClick={() => save({ ...order, work: order.work.map((item) => (item.state === 'proposed' ? { ...item, state: 'accepted' } : item)) })}>
            <Check aria-hidden />
            제안 작업 모두 확정
          </Button>
        </div>
      ) : null}

      {order.work.length === 0 ? (
        <Notice tone="info">아직 작업이 없어요. 아래 "작업 더하기"로 직접 만들어 주세요. 원문은 주문 정리에 그대로 있어요.</Notice>
      ) : null}
      <ol className="flex flex-col gap-3">
        {order.work.map((item, index) => (
          <WorkCard key={item.id} item={item} index={index} props={props} setPending={setPending} />
        ))}
      </ol>
      <PendingPanel pending={pending} setPending={setPending} props={props} />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => save({ ...order, work: [...order.work, blankWork()] })}>
          <Plus aria-hidden />
          작업 더하기
        </Button>
        <span className="text-xs text-muted-foreground">작업을 더해도 에이전트가 생기지 않아요. 누가 맡을지는 다음 단계에서 정해요.</span>
      </div>

      {parallel.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          동시에 해도 되는 후보 (제안): {parallel.map(([a, b]) => `"${titleOf(a)}"와 "${titleOf(b)}"`).join(', ')}. 서로 결과를 주고받지 않아요.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        다시 검토가 필요한 흐름(검토 → 고치기 → 다시 검토)은 자동 반복으로 만들지 않아요. 작업 설명에 "검토 의견을 반영해 한 번 더 확인받는다"처럼 적어 주세요.
      </p>
      <div>
        <Button onClick={() => go('team')}>다음: 팀 제안</Button>
      </div>
    </div>
  );
}
