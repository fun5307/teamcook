// 실습 기록 상세: 당시 설계 / 실제 결과 / 협업 근거 / 평가 / 시간·사용량.
// - 기록 상태는 사용자가 바꾼다. '기록 중'은 적는 중이라는 뜻이지 AI가 돌고 있다는 뜻이 아니다.
// - 기록을 시작하면 입력·레시피·평가 기준은 잠기고, 바꾸려면 새 기록을 파생한다.
// - 완료한 기록의 결과·평가·사건·측정을 고치려면 정정 이유를 적는다 (시각과 함께 남는다).
// - 이 화면의 저장은 레시피의 '실제 실행 확인' 기록을 바꾸지 않는다.

import { useState, type ReactNode } from 'react';
import { Archive, ArchiveRestore, ArrowRight, Copy, GitBranch, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, NativeSelect, Notice, PageHeader } from '@/components/common';
import {
  DemoNotice,
  PlainText,
  PracticeExportButton,
  RunBadges,
  SafeUrl,
  SaveErrorNotice,
  SectionCard,
  SectionTabs,
  safeFileName,
  useSaveStatus,
} from '@/components/practice/PracticeParts';
import { FlowList } from '@/components/RecipeOverview';
import { StyleChip } from '@/components/RouteInfo';
import { newId } from '@/lib/id';
import { navigate } from '@/lib/router';
import {
  conditionsLocked,
  elapsedMinutesFromTimes,
  measureProblems,
  measureValueText,
  participantName,
  singleMeasureProblems,
  STATUS_ORDER,
} from '@/lib/practice/model';
import { eventRoute } from '@/lib/practice/compare';
import {
  CHECK_LABELS,
  EVENT_LABELS,
  EVIDENCE_LABELS,
  isNotApplicable,
  METRIC_HINTS,
  METRIC_LABELS,
  METRIC_UNITS,
  ORIGIN_LABELS,
  scoreLabel,
  STATUS_LABELS,
} from '@/lib/practice/rubric';
import { formatLocal, fromLocalInput, nowIso, toLocalInput } from '@/lib/practice/time';
import { buildExport } from '@/lib/practice/transfer';
import type {
  CheckState,
  CollabEvent,
  EventType,
  Evidence,
  EvidenceKind,
  Measure,
  MetricKind,
  PracticeRun,
  RunInput,
  RunResult,
  RunStatus,
  Score,
  ScoreValue,
} from '@/lib/practice/types';
import { deriveAndSave, setArchived, updateRun, usePractice } from '@/store/usePractice';

type Tab = 'design' | 'result' | 'collab' | 'eval' | 'measure';

export function PracticeRunPage({ id }: { id: string }) {
  const run = usePractice((state) => state.runs.find((item) => item.id === id));
  const [tab, setTab] = useState<Tab>('result');
  const [reason, setReason] = useState('');
  const top = useSaveStatus();

  if (!run) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warn">이 기록을 찾을 수 없어요.</Notice>
        <div>
          <Button asChild variant="outline">
            <a href="#/runs">실습 기록 목록</a>
          </Button>
        </div>
      </div>
    );
  }

  const done = run.status === 'done';
  /** 결과·평가 등을 고칠 때: 완료한 기록이면 정정 이유를 함께 남긴다 */
  const saveChange = (change: (current: PracticeRun) => PracticeRun) =>
    updateRun(run.id, (current) => {
      const next = change(current);
      if (current.status !== 'done') return next;
      return {
        ...next,
        corrections: [...next.corrections, { id: newId('fix'), at: nowIso(), reason: reason.trim(), area: 'result' }],
      };
    });
  const editable = !done || reason.trim() !== '';
  const gate = done ? <CorrectionGate reason={reason} onChange={setReason} /> : null;

  const tabs: { id: Tab; label: string; note?: string }[] = [
    { id: 'design', label: '당시 설계' },
    { id: 'result', label: '실제 결과' },
    { id: 'collab', label: '협업 근거', note: run.kind === 'single' ? '해당 없음' : String(run.events.length) },
    { id: 'eval', label: '평가', note: `${run.scores.length}/${run.rubric.criteria.length}` },
    { id: 'measure', label: '시간·사용량' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={run.title}
        description={<RunBadges run={run} />}
        actions={
          <>
            {run.taskId ? (
              <Button asChild variant="outline">
                <a href={`#/runs/new?task=${encodeURIComponent(run.taskId)}`}>
                  <Copy aria-hidden />
                  같은 과제로 다시 기록
                </a>
              </Button>
            ) : null}
            <PracticeExportButton
              label="JSON"
              title="이 기록 내보내기 (JSON)"
              build={(options) => ({
                fileName: `${safeFileName(run.title)}.json`,
                type: 'application/json',
                text: JSON.stringify(buildExport(usePractice.getState(), { runs: [run], comparisons: [] }, options), null, 2),
              })}
            />
            <Button variant="outline" onClick={() => top.report(setArchived(run.id, !run.archived), run.archived ? '복원했어요' : '보관했어요')}>
              {run.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {run.archived ? '복원' : '보관'}
            </Button>
          </>
        }
      />
      <SaveErrorNotice />
      {run.demo ? <DemoNotice /> : null}
      {run.importedAt ? (
        <Notice tone="info">
          {formatLocal(run.importedAt)}에 파일에서 가져온 기록이에요. 사건·측정의 출처는 "가져온 자료"로 표시돼요.
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <label htmlFor="run-status" className="text-sm font-medium">
          기록 상태
        </label>
        <NativeSelect
          id="run-status"
          className="w-auto"
          value={run.status}
          onChange={(event) => top.report(updateRun(run.id, (current) => ({ ...current, status: event.target.value as RunStatus })), '상태를 바꿨어요')}
        >
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">
          직접 바꾸는 표시예요. "기록 중"은 AI가 돌고 있다는 뜻이 아니에요. 기록을 시작하면 입력과 평가 기준이 고정돼요.
        </span>
        {top.view}
      </div>

      <SectionTabs label="기록 내용" items={tabs} current={tab} onChange={setTab} />

      {tab === 'design' ? <DesignTab run={run} /> : null}
      {tab === 'result' ? (
        <ResultTab run={run} gate={gate} editable={editable} save={saveChange} />
      ) : null}
      {tab === 'collab' ? <CollabTab run={run} gate={gate} editable={editable} save={saveChange} /> : null}
      {tab === 'eval' ? <EvalTab run={run} gate={gate} editable={editable} save={saveChange} /> : null}
      {tab === 'measure' ? <MeasureTab run={run} gate={gate} editable={editable} save={saveChange} /> : null}
    </div>
  );
}

interface TabProps {
  run: PracticeRun;
  gate: ReactNode;
  editable: boolean;
  save: (change: (current: PracticeRun) => PracticeRun) => ReturnType<typeof updateRun>;
}

function CorrectionGate({ reason, onChange }: { reason: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <label htmlFor="correction-reason" className="text-sm font-medium">
        완료한 기록이에요. 고치려면 정정 이유를 적어 주세요.
      </label>
      <Input
        id="correction-reason"
        className="bg-card"
        placeholder="예: 출처 링크를 잘못 적어 바로잡음"
        value={reason}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-xs">저장할 때마다 이유와 시각이 "정정 기록"에 남아요.</p>
    </div>
  );
}

// ───────────────────────── 당시 설계 ─────────────────────────

function DesignTab({ run }: { run: PracticeRun }) {
  const locked = conditionsLocked(run);
  const [input, setInput] = useState<RunInput>(run.input);
  const [note, setNote] = useState('');
  const status = useSaveStatus();
  const recipe = run.snapshot?.recipe;

  const onDerive = () => {
    const { result, id } = deriveAndSave(run);
    if (status.report(result)) navigate(`/run/${id}`);
  };

  return (
    <div className="flex flex-col gap-5">
      {recipe ? (
        <SectionCard title="당시 레시피">
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{recipe.title}</span>
            <StyleChip recipe={recipe} />
            <span className="text-xs text-muted-foreground">{formatLocal(run.createdAt)}에 복사해 둔 내용</span>
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {recipe.cards.map((card) => (
              <li key={card.id}>
                <span className="font-medium">{card.displayName}</span> — {card.role}
                {card.deliverables?.length ? (
                  <span className="text-muted-foreground"> · 내놓는 것: {card.deliverables.map((item) => item.name).join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <FlowList recipe={recipe} />
        </SectionCard>
      ) : (
        <SectionCard title="단일 AI">
          <p className="text-sm text-muted-foreground">레시피 없이 AI 하나에게 시킨 기록이에요. 아래 입력이 실제로 넣은 프롬프트입니다.</p>
        </SectionCard>
      )}

      <SectionCard title="입력과 조건">
        {locked ? (
          <>
            <PlainText value={run.input.text} />
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {(
                [
                  ['자료 조건', run.input.materials],
                  ['도구', run.input.tool],
                  ['모델', run.input.model],
                  ['도구 버전', run.input.toolVersion],
                  ['환경', run.input.environment],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={value ? '' : 'text-muted-foreground'}>{value || '미확인'}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button size="sm" variant="outline" onClick={onDerive}>
                <GitBranch aria-hidden />
                조건을 바꿔 새 기록 만들기
              </Button>
              <span className="text-xs text-muted-foreground">기록을 시작해 입력·레시피·평가 기준이 고정됐어요. 이 기록은 그대로 둡니다.</span>
              {status.view}
            </div>
          </>
        ) : (
          <>
            <Field label="입력 원문" htmlFor="design-input">
              <Textarea id="design-input" rows={5} value={input.text} onChange={(event) => setInput({ ...input, text: event.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['materials', '자료 조건'],
                  ['tool', '도구'],
                  ['model', '모델'],
                  ['toolVersion', '도구 버전'],
                  ['environment', '환경'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} htmlFor={`design-${key}`}>
                  <Input id={`design-${key}`} className="bg-card" placeholder="비워 두면 미확인" value={input[key]} onChange={(event) => setInput({ ...input, [key]: event.target.value })} />
                </Field>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => status.report(updateRun(run.id, (current) => ({ ...current, input })))}>
                저장
              </Button>
              {status.view}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title={`평가 기준 (v${run.rubric.version})`}>
        <ul className="flex flex-col gap-1 text-sm">
          {run.rubric.criteria.map((criterion) => (
            <li key={criterion.id}>
              <span className="font-medium">{criterion.name}</span>
              <span className="text-muted-foreground"> — {criterion.description}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="정정 기록">
        {run.corrections.length === 0 ? <p className="text-sm text-muted-foreground">없어요.</p> : null}
        <ul className="flex flex-col gap-1 text-sm">
          {run.corrections.map((item) => (
            <li key={item.id}>
              <span className="text-muted-foreground">{formatLocal(item.at)} · {item.area === 'note' ? '메모' : '결과·평가 정정'}</span> — {item.reason}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xl flex-1 bg-card"
            aria-label="정정 메모"
            placeholder="입력·조건에 대한 정정 메모 (예: 실제로는 첨부 파일 1개를 넣었음)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!note.trim()}
            onClick={() => {
              const ok = status.report(
                updateRun(run.id, (current) => ({
                  ...current,
                  corrections: [...current.corrections, { id: newId('fix'), at: nowIso(), reason: note.trim(), area: 'note' }],
                })),
                '메모를 남겼어요',
              );
              if (ok) setNote('');
            }}
          >
            메모 남기기
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// ───────────────────────── 실제 결과 ─────────────────────────

function ResultTab({ run, gate, editable, save }: TabProps) {
  const [draft, setDraft] = useState<RunResult>(run.result);
  const status = useSaveStatus();
  const cards = run.snapshot?.recipe.cards ?? [];
  const set = (patch: Partial<RunResult>) => setDraft((old) => ({ ...old, ...patch }));

  return (
    <div className="flex flex-col gap-5">
      {gate}
      <SectionCard title="결과">
        <Field label="핵심 요약" htmlFor="result-summary">
          <Textarea id="result-summary" rows={2} readOnly={!editable} value={draft.summary} onChange={(event) => set({ summary: event.target.value })} />
        </Field>
        <Field label="결과 본문" htmlFor="result-body" hint="AI가 내놓은 결과를 붙여 넣으세요. 글자 그대로 보관하고, 링크나 HTML로 바꾸지 않아요.">
          <Textarea id="result-body" rows={8} className="font-mono text-xs" readOnly={!editable} value={draft.body} onChange={(event) => set({ body: event.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard title="근거 출처">
        <ul className="flex flex-col gap-2">
          {draft.sources.map((source, index) => (
            <li key={source.id} className="grid gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
              <Input className="bg-card" aria-label={`출처 ${index + 1} 설명`} placeholder="출처 설명" readOnly={!editable} value={source.label} onChange={(event) => set({ sources: draft.sources.map((item) => (item.id === source.id ? { ...item, label: event.target.value } : item)) })} />
              <Input className="bg-card" aria-label={`출처 ${index + 1} 주소`} placeholder="https://… (선택)" readOnly={!editable} value={source.url ?? ''} onChange={(event) => set({ sources: draft.sources.map((item) => (item.id === source.id ? { ...item, url: event.target.value || undefined } : item)) })} />
              <Button size="icon-sm" variant="ghost" aria-label={`출처 ${index + 1} 삭제`} disabled={!editable} onClick={() => set({ sources: draft.sources.filter((item) => item.id !== source.id) })}>
                <Trash2 />
              </Button>
              {source.url ? (
                <span className="text-xs sm:col-span-3">
                  <SafeUrl value={source.url} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <div>
          <Button size="sm" variant="outline" disabled={!editable} onClick={() => set({ sources: [...draft.sources, { id: newId('src'), label: '' }] })}>
            <Plus aria-hidden />
            출처 추가
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="성공 조건 확인">
        {draft.checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">이 기록에는 성공 조건이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {draft.checks.map((check, index) => (
              <li key={check.id} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{check.text}</p>
                <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr]">
                  <NativeSelect aria-label={`성공 조건 ${index + 1} 상태`} disabled={!editable} value={check.state} onChange={(event) => set({ checks: draft.checks.map((item) => (item.id === check.id ? { ...item, state: event.target.value as CheckState } : item)) })}>
                    {(Object.keys(CHECK_LABELS) as CheckState[]).map((state) => (
                      <option key={state} value={state}>
                        {CHECK_LABELS[state]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input className="bg-card" aria-label={`성공 조건 ${index + 1} 근거`} placeholder="근거 (어디서 확인했는지)" readOnly={!editable} value={check.evidence} onChange={(event) => set({ checks: draft.checks.map((item) => (item.id === check.id ? { ...item, evidence: event.target.value } : item)) })} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">"확인 불가"는 "미충족"이 아니에요. 확인할 방법이 없었을 때 고르세요.</p>
      </SectionCard>

      <SectionCard title="실제 진행">
        {cards.length > 0 ? (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">실제로 참여한 역할</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {cards.map((card) => {
                const list = draft.participants ?? [];
                return (
                  <label key={card.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={list.includes(card.id)}
                      onChange={() => set({ participants: list.includes(card.id) ? list.filter((item) => item !== card.id) : [...list, card.id] })}
                    />
                    {card.displayName}
                  </label>
                );
              })}
            </div>
            {draft.participants === undefined ? <p className="text-xs text-muted-foreground">아직 적지 않았어요 (미확인).</p> : null}
          </fieldset>
        ) : null}
        <Field label="예정과 달랐던 수행 내용" htmlFor="result-deviations">
          <Textarea id="result-deviations" rows={2} readOnly={!editable} value={draft.deviations} onChange={(event) => set({ deviations: event.target.value })} />
        </Field>
        <Field label="미해결 사항" htmlFor="result-unresolved">
          <Textarea id="result-unresolved" rows={2} readOnly={!editable} value={draft.unresolved} onChange={(event) => set({ unresolved: event.target.value })} />
        </Field>
      </SectionCard>

      <div className="flex items-center gap-3">
        <Button disabled={!editable} onClick={() => status.report(save((current) => ({ ...current, result: { ...draft, sources: draft.sources.filter((item) => item.label.trim() || item.url?.trim()) } })))}>
          결과 저장
        </Button>
        {status.view}
      </div>
    </div>
  );
}

// ───────────────────────── 협업 근거 ─────────────────────────

const EMPTY_EVENT = { type: 'message' as EventType, from: '', to: '', description: '', addedEvidence: '', outcome: '', at: '' };

function CollabTab({ run, gate, editable, save }: TabProps) {
  const [draft, setDraft] = useState(EMPTY_EVENT);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const status = useSaveStatus();
  const recipe = run.snapshot?.recipe;

  if (run.kind === 'single' || !recipe) {
    return (
      <SectionCard title="협업 근거">
        <p className="text-sm text-muted-foreground">단일 AI 기록이라 역할 사이의 협업이 없어요. 사용자가 끼어든 일은 "시간·사용량"의 메모나 결과의 "예정과 달랐던 내용"에 적어 주세요.</p>
      </SectionCard>
    );
  }

  const people = [
    { id: 'main', name: '메인 AI' },
    { id: 'user', name: '사용자' },
    ...recipe.cards.map((card) => ({ id: card.id, name: card.displayName || card.name })),
  ];

  const onAdd = () => {
    const event: CollabEvent = {
      id: newId('event'),
      type: draft.type,
      description: draft.description.trim(),
      evidence: evidence.filter((item) => item.text.trim()),
      origin: 'user',
    };
    if (draft.from) event.from = draft.from;
    if (draft.to) event.to = draft.to;
    if (draft.addedEvidence.trim()) event.addedEvidence = draft.addedEvidence.trim();
    if (draft.outcome.trim()) event.outcome = draft.outcome.trim();
    const at = fromLocalInput(draft.at);
    if (at) event.at = at;
    if (status.report(save((current) => ({ ...current, events: [...current.events, event] })), '사건을 더했어요')) {
      setDraft(EMPTY_EVENT);
      setEvidence([]);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {gate}
      <SectionCard title="예정한 흐름과 기록된 사건">
        <p className="text-xs text-muted-foreground">
          레시피에 적힌 전달 흐름마다 그 사이의 사건이 기록됐는지 보여 줘요. 기록이 없다고 해서 일어나지 않았다는 뜻은 아니에요.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {recipe.handoffs.map((handoff) => {
            const count = run.events.filter((event) => event.from === handoff.from && event.to === handoff.to).length;
            return (
              <li key={handoff.id} className="flex flex-wrap items-center gap-2">
                <span>{participantName(run, handoff.from)}</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                <span>{participantName(run, handoff.to)}</span>
                <span className={count > 0 ? 'text-emerald-800' : 'text-muted-foreground'}>
                  {count > 0 ? `기록된 사건 ${count}개` : '기록 없음'}
                </span>
              </li>
            );
          })}
          {recipe.handoffs.length === 0 ? <li className="text-muted-foreground">레시피에 정해진 흐름이 없어요.</li> : null}
        </ul>
      </SectionCard>

      <SectionCard title={`기록된 사건 ${run.events.length}개`}>
        <p className="text-xs text-muted-foreground">
          무슨 일이 있었는지만 적어요. 협업이 결과를 실제로 좋게 했는지는 "평가"의 협업 기여에서 따로 판단해요.
        </p>
        <ol className="flex flex-col gap-3">
          {run.events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{EVENT_LABELS[event.type]}</span>
                  <span className="text-muted-foreground">{eventRoute(run, event.from, event.to)}</span>
                  {event.at ? <span className="text-xs text-muted-foreground">{formatLocal(event.at)}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {ORIGIN_LABELS[event.origin]}
                    {event.evidence.length === 0 ? ', 증거 미첨부' : ''}
                  </span>
                  <Button size="icon-xs" variant="ghost" aria-label="이 사건 삭제" disabled={!editable} onClick={() => status.report(save((current) => ({ ...current, events: current.events.filter((item) => item.id !== event.id) })), '지웠어요')}>
                    <Trash2 />
                  </Button>
                </span>
              </div>
              <PlainText value={event.description} empty="(내용 없음)" />
              {event.addedEvidence ? <p className="text-muted-foreground">더해진 근거: {event.addedEvidence}</p> : null}
              {event.outcome ? <p className="text-muted-foreground">결과에 준 변화: {event.outcome}</p> : null}
              {event.evidence.length > 0 ? (
                <ul className="flex flex-col gap-0.5 text-xs">
                  {event.evidence.map((item) => (
                    <li key={item.id}>
                      <span className="text-muted-foreground">{EVIDENCE_LABELS[item.kind]}: </span>
                      {item.kind === 'url' ? <SafeUrl value={item.text} /> : <span className="whitespace-pre-wrap">{item.text}</span>}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="사건 추가">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="종류" htmlFor="event-type">
            <NativeSelect id="event-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as EventType })}>
              {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => (
                <option key={type} value={type}>
                  {EVENT_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {(['from', 'to'] as const).map((key) => (
            <Field key={key} label={key === 'from' ? '누가' : '누구에게'} htmlFor={`event-${key}`}>
              <NativeSelect id={`event-${key}`} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}>
                <option value="">(적지 않음)</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ))}
        </div>
        <Field label="무엇을 전달했나요 / 무슨 일이 있었나요" htmlFor="event-description">
          <Textarea id="event-description" rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="더해진 근거 (선택)" htmlFor="event-added">
            <Input id="event-added" className="bg-card" value={draft.addedEvidence} onChange={(event) => setDraft({ ...draft, addedEvidence: event.target.value })} />
          </Field>
          <Field label="결과가 어떻게 달라졌나요 (선택)" htmlFor="event-outcome">
            <Input id="event-outcome" className="bg-card" value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })} />
          </Field>
        </div>
        <Field label="언제 (선택)" htmlFor="event-at">
          <Input id="event-at" type="datetime-local" className="w-auto bg-card" value={draft.at} onChange={(event) => setDraft({ ...draft, at: event.target.value })} />
        </Field>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">증거 (짧은 발췌, 출처 주소, 메모)</legend>
          {evidence.map((item, index) => (
            <div key={item.id} className="grid gap-1.5 sm:grid-cols-[8rem_1fr_auto]">
              <NativeSelect aria-label={`증거 ${index + 1} 종류`} value={item.kind} onChange={(event) => setEvidence(evidence.map((old) => (old.id === item.id ? { ...old, kind: event.target.value as EvidenceKind } : old)))}>
                {(Object.keys(EVIDENCE_LABELS) as EvidenceKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {EVIDENCE_LABELS[kind]}
                  </option>
                ))}
              </NativeSelect>
              <Input className="bg-card" aria-label={`증거 ${index + 1} 내용`} value={item.text} onChange={(event) => setEvidence(evidence.map((old) => (old.id === item.id ? { ...old, text: event.target.value } : old)))} />
              <Button size="icon-sm" variant="ghost" aria-label={`증거 ${index + 1} 삭제`} onClick={() => setEvidence(evidence.filter((old) => old.id !== item.id))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <div>
            <Button size="sm" variant="outline" onClick={() => setEvidence([...evidence, { id: newId('ev'), kind: 'excerpt', text: '' }])}>
              <Plus aria-hidden />
              증거 추가
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">증거 없이 더하면 "사용자 기록, 증거 미첨부"로 표시돼요.</p>
        </fieldset>
        <div className="flex items-center gap-3">
          <Button disabled={!editable || !draft.description.trim()} onClick={onAdd}>
            사건 더하기
          </Button>
          {status.view}
        </div>
      </SectionCard>
    </div>
  );
}

// ───────────────────────── 평가 ─────────────────────────

type DraftScore = { value: ScoreValue | null; rationale: string };

function EvalTab({ run, gate, editable, save }: TabProps) {
  const [evaluator, setEvaluator] = useState(() => run.scores[0]?.evaluator ?? '');
  const [draft, setDraft] = useState<Record<string, DraftScore>>(() =>
    Object.fromEntries(
      run.rubric.criteria.map((criterion) => {
        const score = run.scores.find((item) => item.criterionId === criterion.id);
        return [criterion.id, { value: score?.value ?? null, rationale: score?.rationale ?? '' }];
      }),
    ),
  );
  const status = useSaveStatus();

  const onSave = () => {
    const now = nowIso();
    status.report(
      save((current) => {
        const scores: Score[] = [];
        for (const criterion of current.rubric.criteria) {
          const item = draft[criterion.id];
          const value: ScoreValue | null = isNotApplicable(current, criterion) ? 'na' : (item?.value ?? null);
          if (value === null) continue;
          const old = current.scores.find((score) => score.criterionId === criterion.id);
          const unchanged = old && old.value === value && old.rationale === item.rationale && old.evaluator === evaluator.trim();
          scores.push(unchanged ? old : { criterionId: criterion.id, value, rationale: item.rationale, evaluator: evaluator.trim(), evaluatedAt: now });
        }
        return { ...current, scores };
      }),
    );
  };

  const choices: { value: ScoreValue; label: string }[] = [
    { value: 0, label: '0' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 'unknown', label: '확인 불가' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {gate}
      <Notice tone="info">
        점수는 사람이 매겨요. 출처가 붙어 있다는 것만으로 정확성을 높게 주지 마세요. 점수를 더한 종합 점수나 승자는 만들지 않아요.
      </Notice>
      <Field label="평가자" htmlFor="evaluator" className="max-w-sm">
        <Input id="evaluator" className="bg-card" placeholder="이름이나 닉네임" readOnly={!editable} value={evaluator} onChange={(event) => setEvaluator(event.target.value)} />
      </Field>
      {run.rubric.criteria.map((criterion) => {
        const na = isNotApplicable(run, criterion);
        const item = draft[criterion.id] ?? { value: null, rationale: '' };
        const saved = run.scores.find((score) => score.criterionId === criterion.id);
        return (
          <SectionCard key={criterion.id} title={criterion.name}>
            <p className="text-sm text-muted-foreground">{criterion.description}</p>
            {na ? (
              <p className="text-sm font-medium">해당 없음 — 단일 AI 기록이라 협업을 평가하지 않아요. 0점으로 치지 않아요.</p>
            ) : (
              <>
                <fieldset className="flex flex-col gap-1">
                  <legend className="sr-only">{criterion.name} 점수</legend>
                  {choices.map((choice) => (
                    <label key={String(choice.value)} className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        className="mt-1"
                        name={`score-${criterion.id}`}
                        disabled={!editable}
                        checked={item.value === choice.value}
                        onChange={() => setDraft({ ...draft, [criterion.id]: { ...item, value: choice.value } })}
                      />
                      <span>
                        <span className="font-medium">{choice.label === '확인 불가' ? choice.label : `${choice.label}점`}</span>
                        {typeof choice.value === 'number' && criterion.levels[choice.value] ? (
                          <span className="text-muted-foreground"> — {criterion.levels[choice.value]}</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                  {item.value !== null ? (
                    <div>
                      <Button size="xs" variant="ghost" disabled={!editable} onClick={() => setDraft({ ...draft, [criterion.id]: { ...item, value: null } })}>
                        평가 지우기
                      </Button>
                    </div>
                  ) : null}
                </fieldset>
                <Textarea aria-label={`${criterion.name} 근거`} rows={2} placeholder="그렇게 판단한 근거" readOnly={!editable} value={item.rationale} onChange={(event) => setDraft({ ...draft, [criterion.id]: { ...item, rationale: event.target.value } })} />
                {saved ? (
                  <p className="text-xs text-muted-foreground">
                    저장된 평가: {scoreLabel(saved.value)} · {saved.evaluator || '평가자 미기록'} · {formatLocal(saved.evaluatedAt)}
                  </p>
                ) : null}
              </>
            )}
          </SectionCard>
        );
      })}
      <div className="flex items-center gap-3">
        <Button disabled={!editable} onClick={onSave}>
          평가 저장
        </Button>
        {status.view}
      </div>
    </div>
  );
}

// ───────────────────────── 시간·사용량 ─────────────────────────

const NEW_MEASURE = (): Measure => ({ id: newId('measure'), metric: 'elapsed', value: null, unit: '분', scope: '', source: '', origin: 'user' });

function MeasureTab({ run, gate, editable, save }: TabProps) {
  const [startedAt, setStartedAt] = useState(toLocalInput(run.startedAt));
  const [endedAt, setEndedAt] = useState(toLocalInput(run.endedAt));
  const [draft, setDraft] = useState<Measure>(NEW_MEASURE);
  const [valueText, setValueText] = useState('');
  const status = useSaveStatus();
  const timeProblems = measureProblems({ measures: [], startedAt: fromLocalInput(startedAt), endedAt: fromLocalInput(endedAt) });
  const minutes = elapsedMinutesFromTimes({ startedAt: fromLocalInput(startedAt), endedAt: fromLocalInput(endedAt) });

  const parsedValue = valueText.trim() === '' ? null : Number(valueText);
  const candidate: Measure = { ...draft, value: parsedValue };
  const problems = valueText.trim() !== '' && Number.isNaN(parsedValue) ? ['값이 숫자가 아니에요.'] : singleMeasureProblems(candidate);

  const onMetric = (metric: MetricKind) => setDraft({ ...draft, metric, unit: METRIC_UNITS[metric][0] ?? '' });

  return (
    <div className="flex flex-col gap-5">
      {gate}
      <SectionCard title="시작과 끝">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="시작" htmlFor="started-at">
            <Input id="started-at" type="datetime-local" className="bg-card" readOnly={!editable} value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
          </Field>
          <Field label="끝" htmlFor="ended-at">
            <Input id="ended-at" type="datetime-local" className="bg-card" readOnly={!editable} value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
          </Field>
          <Button
            disabled={!editable || timeProblems.length > 0}
            onClick={() => status.report(save((current) => ({ ...current, startedAt: fromLocalInput(startedAt), endedAt: fromLocalInput(endedAt) })))}
          >
            저장
          </Button>
        </div>
        {timeProblems.map((problem) => (
          <p key={problem.message} className="text-sm font-medium text-rose-800">
            {problem.message}
          </p>
        ))}
        <p className="text-sm text-muted-foreground">
          {minutes === null ? '시작과 끝을 모두 적으면 그 사이 시간을 보여 드려요. 하나라도 비면 "미확인"이에요.' : `시작부터 끝까지 ${minutes}분 (전체 경과 시간)`}
        </p>
        {status.view}
      </SectionCard>

      <SectionCard title="측정값">
        {run.measures.length === 0 ? <p className="text-sm text-muted-foreground">적은 측정값이 없어요.</p> : null}
        <ul className="flex flex-col gap-2">
          {run.measures.map((measure) => (
            <li key={measure.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{measure.metric === 'other' ? measure.label : METRIC_LABELS[measure.metric]}</span>{' '}
                <span className={measure.value === null ? 'text-muted-foreground' : ''}>{measureValueText(measure)}</span>
                {measure.scope ? <span className="text-muted-foreground"> · 범위: {measure.scope}</span> : null}
                {measure.source ? <span className="text-muted-foreground"> · 출처: {measure.source}</span> : null}
                <span className="text-xs text-muted-foreground"> · {ORIGIN_LABELS[measure.origin]}</span>
              </span>
              <Button size="icon-xs" variant="ghost" aria-label="이 측정값 삭제" disabled={!editable} onClick={() => status.report(save((current) => ({ ...current, measures: current.measures.filter((item) => item.id !== measure.id) })), '지웠어요')}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="측정값 추가">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="지표" htmlFor="measure-metric">
            <NativeSelect id="measure-metric" value={draft.metric} onChange={(event) => onMetric(event.target.value as MetricKind)}>
              {(Object.keys(METRIC_LABELS) as MetricKind[]).map((metric) => (
                <option key={metric} value={metric}>
                  {METRIC_LABELS[metric]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="값 (모르면 비워 두기)" htmlFor="measure-value">
            <Input id="measure-value" inputMode="decimal" className="bg-card" placeholder="미확인" value={valueText} onChange={(event) => setValueText(event.target.value)} />
          </Field>
          <Field label="단위" htmlFor="measure-unit">
            {METRIC_UNITS[draft.metric].length > 0 ? (
              <NativeSelect id="measure-unit" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })}>
                {METRIC_UNITS[draft.metric].map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input id="measure-unit" className="bg-card" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} />
            )}
          </Field>
        </div>
        {draft.metric === 'other' ? (
          <Field label="지표 이름" htmlFor="measure-label">
            <Input id="measure-label" className="bg-card" value={draft.label ?? ''} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          </Field>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="범위 (무엇을 센 값인지)" htmlFor="measure-scope">
            <Input id="measure-scope" className="bg-card" placeholder="예: Claude Code · 입력+출력" value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} />
          </Field>
          <Field label="출처 (어디서 본 값인지)" htmlFor="measure-source">
            <Input id="measure-source" className="bg-card" placeholder="예: /cost 화면" value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} />
          </Field>
        </div>
        {METRIC_HINTS[draft.metric] ? <p className="text-xs text-muted-foreground">{METRIC_HINTS[draft.metric]}</p> : null}
        {problems.map((problem) => (
          <p key={problem} className="text-sm font-medium text-rose-800">
            {problem}
          </p>
        ))}
        <div className="flex items-center gap-3">
          <Button
            disabled={!editable || problems.length > 0}
            onClick={() => {
              const measure = { ...candidate, scope: candidate.scope.trim(), source: candidate.source.trim() };
              if (status.report(save((current) => ({ ...current, measures: [...current.measures, measure] })), '더했어요')) {
                setDraft(NEW_MEASURE());
                setValueText('');
              }
            }}
          >
            측정값 더하기
          </Button>
          <span className="text-xs text-muted-foreground">값을 비워 두면 "미확인"으로 남아요. 0과 다릅니다.</span>
        </div>
      </SectionCard>
    </div>
  );
}
