// 비교 화면. 저장할 때 복사해 둔 기록(스냅샷)을 보여 준다. 원본 기록을 고쳐도 이 화면은 조용히 바뀌지 않고,
// "최신 값으로 갱신"을 눌렀을 때만 바뀐다.
// 조건이 다르거나 확인되지 않은 것은 맨 위에 보이고, 점수를 더하거나 순위·승자를 만들지 않는다.

import { useState, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice, PageHeader } from '@/components/common';
import {
  DemoNotice,
  PlainText,
  PracticeExportButton,
  RunBadges,
  SaveErrorNotice,
  SectionCard,
  safeFileName,
  useSaveStatus,
} from '@/components/practice/PracticeParts';
import {
  CONDITION_LABELS,
  comparisonScopeLine,
  compareConditions,
  eventRoute,
  measureRows,
  staleRunIds,
  VARIABLE_CONDITIONS,
} from '@/lib/practice/compare';
import { elapsedMinutesFromTimes, measureValueText } from '@/lib/practice/model';
import { comparisonMarkdown } from '@/lib/practice/report';
import { CHECK_LABELS, effectiveScore, EVENT_LABELS, METRIC_LABELS, scoreLabel } from '@/lib/practice/rubric';
import { formatLocal } from '@/lib/practice/time';
import { buildExport } from '@/lib/practice/transfer';
import type { CheckState, PracticeRun } from '@/lib/practice/types';
import { refreshComparison, updateComparison, usePractice } from '@/store/usePractice';

const letter = (index: number) => `기록 ${String.fromCharCode(65 + index)}`;

function Grid({ runs, children, label }: { runs: PracticeRun[]; children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[36rem] text-left text-sm" aria-label={label}>
        <thead>
          <tr className="border-b bg-muted/60">
            <th className="w-36 p-2.5 font-medium">항목</th>
            {runs.map((run, index) => (
              <th key={run.id} className="p-2.5 font-medium">
                {letter(index)}
                <span className="block text-xs font-normal text-muted-foreground">{run.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ label, cells, warn }: { label: ReactNode; cells: ReactNode[]; warn?: boolean }) {
  return (
    <tr className="border-b align-top last:border-b-0">
      <th className={cn('p-2.5 font-medium', warn && 'text-amber-900')}>{label}</th>
      {cells.map((content, index) => (
        <td key={index} className="p-2.5 break-words">
          {content}
        </td>
      ))}
    </tr>
  );
}

const unknown = <span className="text-muted-foreground">미확인</span>;

export function ComparisonPage({ id }: { id: string }) {
  const comparison = usePractice((state) => state.comparisons.find((item) => item.id === id));
  const currentRuns = usePractice((state) => state.runs);
  const [conclusion, setConclusion] = useState(comparison?.conclusion ?? '');
  const [limits, setLimits] = useState(comparison?.limits ?? '');
  const status = useSaveStatus();
  const top = useSaveStatus();

  if (!comparison) {
    return <Notice tone="warn">이 비교를 찾을 수 없어요.</Notice>;
  }
  const runs = comparison.runs;
  const report = compareConditions(runs, comparison.variables);
  const stale = staleRunIds(comparison, currentRuns);
  const demo = comparison.demo || runs.some((run) => run.demo);
  const toggleVariable = (key: string) =>
    top.report(
      updateComparison(comparison.id, (item) => ({
        ...item,
        variables: item.variables.includes(key) ? item.variables.filter((value) => value !== key) : [...item.variables, key],
      })),
      '실험 변수를 바꿨어요',
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={comparison.title}
        description={comparisonScopeLine(comparison)}
        actions={
          <>
            <PracticeExportButton
              label="JSON"
              title="비교 내보내기 (JSON)"
              build={(options) => ({
                fileName: `${safeFileName(comparison.title)}.json`,
                type: 'application/json',
                text: JSON.stringify(buildExport(usePractice.getState(), { runs: [], comparisons: [comparison] }, options), null, 2),
              })}
            />
            <PracticeExportButton
              variant="default"
              label="보고서 (Markdown)"
              title="비교 보고서 내려받기"
              build={(options) => ({
                fileName: `${safeFileName(comparison.title)}.md`,
                type: 'text/markdown',
                text: comparisonMarkdown(buildExport(usePractice.getState(), { runs: [], comparisons: [comparison] }, options).comparisons[0]),
              })}
            />
          </>
        }
      />
      <SaveErrorNotice />
      {demo ? <DemoNotice /> : null}
      <p className="text-xs text-muted-foreground">
        {formatLocal(comparison.snapshotAt)}에 복사해 둔 기록으로 보여 줘요. 원본 기록을 고쳐도 여기는 그대로예요.
      </p>
      {stale.length > 0 ? (
        <Notice tone="warn" className="flex flex-wrap items-center justify-between gap-2">
          <span>복사해 둔 뒤 원본 기록 {stale.length}개가 바뀌었어요. 이 비교는 아직 예전 내용이에요.</span>
          <Button size="sm" variant="outline" onClick={() => top.report(refreshComparison(comparison.id), '최신 값으로 갱신했어요')}>
            <RefreshCw aria-hidden />
            최신 값으로 갱신
          </Button>
        </Notice>
      ) : null}
      {top.view}

      {report.problems.length > 0 ? (
        <section className="flex flex-col gap-1.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950" aria-label="조건 경고">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-5" aria-hidden />
            동일 조건 비교가 아니에요 (탐색용 비교)
          </p>
          <ul className="list-disc pl-5 text-sm">
            {report.problems.map((row) => (
              <li key={row.key}>
                {row.label}: {row.state === 'unknown' ? '적히지 않은 기록이 있어 확인할 수 없어요' : '기록마다 달라요'}
              </li>
            ))}
          </ul>
          <p className="text-xs">일부러 바꾼 조건이면 아래 "실험 변수"로 표시하세요. 입력·자료 조건·평가 기준·성공 조건은 같아야 해요.</p>
        </section>
      ) : (
        <Notice tone="success">입력·자료 조건·평가 기준이 같고, 다른 조건은 모두 실험 변수로 고른 것이에요 (동일 조건 비교).</Notice>
      )}

      <SectionCard title="1. 공통 과제와 비교 조건">
        <PlainText value={runs[0].input.text} />
        <Grid runs={runs} label="비교 조건">
          {report.rows.map((row) => (
            <Row
              key={row.key}
              warn={report.problems.includes(row)}
              label={
                <>
                  {row.label}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {row.state === 'same' ? '같음' : row.state === 'unknown' ? '확인 불가' : row.variable ? '다름 · 실험 변수' : '다름'}
                  </span>
                </>
              }
              cells={row.values.map((value) => (value ? <span className="line-clamp-4 whitespace-pre-wrap">{value}</span> : unknown))}
            />
          ))}
        </Grid>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">실험 변수 (일부러 바꾼 조건)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {VARIABLE_CONDITIONS.map((key) => (
              <label key={key} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={comparison.variables.includes(key)} onChange={() => toggleVariable(key)} />
                {CONDITION_LABELS[key]}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">실험 변수로 골라도 차이는 표에 그대로 보여요.</p>
        </fieldset>
      </SectionCard>

      <SectionCard title="2. 기록별 방식">
        <ul className="grid gap-3 sm:grid-cols-2">
          {runs.map((run, index) => (
            <li key={run.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
              <a className="font-medium hover:underline" href={`#/run/${encodeURIComponent(run.id)}`}>
                {letter(index)} · {run.title}
              </a>
              <RunBadges run={run} />
              {run.snapshot ? (
                <span className="text-muted-foreground">
                  레시피 "{run.snapshot.recipe.title}" · 역할 {run.snapshot.recipe.cards.length}개
                </span>
              ) : (
                <span className="text-muted-foreground">레시피 없음 (단일 AI)</span>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="3. 결과·성공 조건·평가">
        <Grid runs={runs} label="결과">
          <Row label="핵심 요약" cells={runs.map((run) => <PlainText value={run.result.summary} empty="적지 않음" />)} />
          <Row
            label="성공 조건"
            cells={runs.map((run) =>
              run.result.checks.length === 0 ? (
                <span className="text-muted-foreground">없음</span>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {(['met', 'partial', 'unmet', 'unknown'] as CheckState[]).map((state) => {
                    const count = run.result.checks.filter((check) => check.state === state).length;
                    return count > 0 ? (
                      <li key={state}>
                        {CHECK_LABELS[state]} {count}
                      </li>
                    ) : null;
                  })}
                </ul>
              ),
            )}
          />
          <Row label="미해결 사항" cells={runs.map((run) => <PlainText value={run.result.unresolved} empty="적지 않음" />)} />
          <Row label="근거 출처" cells={runs.map((run) => `${run.result.sources.length}개`)} />
        </Grid>
        <h3 className="mt-2 text-base font-bold">항목별 평가</h3>
        {report.rubricComparable ? (
          <Grid runs={runs} label="항목별 평가">
            {runs[0].rubric.criteria.map((criterion) => (
              <Row
                key={criterion.id}
                label={criterion.name}
                cells={runs.map((run) => {
                  const score = effectiveScore(run, criterion);
                  return (
                    <>
                      <span className="font-medium">{scoreLabel(score?.value)}</span>
                      {score && 'rationale' in score && score.rationale ? (
                        <span className="block text-xs text-muted-foreground">{score.rationale}</span>
                      ) : null}
                    </>
                  );
                })}
              />
            ))}
          </Grid>
        ) : (
          <>
            <Notice tone="warn">평가 기준이 기록마다 달라 나란히 견주지 않고 각 기록의 평가를 그대로 보여 줘요.</Notice>
            {runs.map((run, index) => (
              <div key={run.id} className="text-sm">
                <p className="font-medium">{letter(index)}</p>
                <ul className="list-disc pl-5">
                  {run.rubric.criteria.map((criterion) => (
                    <li key={criterion.id}>
                      {criterion.name}: {scoreLabel(effectiveScore(run, criterion)?.value)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          점수는 더하지 않아요. 종합 점수·순위·승자는 없어요. "해당 없음"과 "확인 불가"는 0점이 아니에요.
        </p>
      </SectionCard>

      <SectionCard title="4. 협업 근거와 판단 변경">
        <Grid runs={runs} label="협업 근거">
          {(['disagreement', 'reinvestigation', 'decision-change', 'message'] as const).map((type) => (
            <Row
              key={type}
              label={EVENT_LABELS[type]}
              cells={runs.map((run) => {
                if (run.kind === 'single') return <span className="text-muted-foreground">해당 없음</span>;
                const events = run.events.filter((event) => event.type === type);
                if (events.length === 0) return <span className="text-muted-foreground">기록 없음</span>;
                return (
                  <ul className="flex flex-col gap-1">
                    {events.map((event) => (
                      <li key={event.id}>
                        <span className="text-xs text-muted-foreground">{eventRoute(run, event.from, event.to)}</span>
                        <span className="block">{event.description}</span>
                        {event.outcome ? <span className="block text-xs">→ {event.outcome}</span> : null}
                        {event.evidence.length === 0 ? <span className="text-xs text-muted-foreground">사용자 보고, 증거 미첨부</span> : null}
                      </li>
                    ))}
                  </ul>
                );
              })}
            />
          ))}
        </Grid>
        <p className="text-xs text-muted-foreground">
          사건이 기록됐다는 것과 협업이 효과적이었다는 판단은 달라요. 기록이 없다고 해서 일어나지 않았다는 뜻도 아니에요.
        </p>
      </SectionCard>

      <SectionCard title="5. 시간·사용량·사용자 개입">
        <Grid runs={runs} label="시간과 사용량">
          <Row
            label="시작~끝"
            cells={runs.map((run) => {
              const minutes = elapsedMinutesFromTimes(run);
              return minutes === null ? unknown : `${minutes}분`;
            })}
          />
          {measureRows(runs).map((row) => (
            <Row
              key={row.label}
              warn={row.incomparable}
              label={
                <>
                  {row.metric === 'other' ? row.label : METRIC_LABELS[row.metric]}
                  {row.incomparable ? <span className="block text-xs font-normal">범위·단위가 달라 직접 견주지 마세요</span> : null}
                </>
              }
              cells={row.cells.map((cell) =>
                cell.measures.length === 0 ? (
                  <span className="text-muted-foreground">적지 않음</span>
                ) : (
                  <ul>
                    {cell.measures.map((measure) => (
                      <li key={measure.id}>
                        <span className={measure.value === null ? 'text-muted-foreground' : ''}>{measureValueText(measure)}</span>
                        {measure.scope ? <span className="block text-xs text-muted-foreground">{measure.scope}</span> : null}
                      </li>
                    ))}
                  </ul>
                ),
              )}
            />
          ))}
          <Row
            label="사용자 개입"
            cells={runs.map((run) => `${run.events.filter((event) => event.type === 'user-intervention').length}건`)}
          />
        </Grid>
        <p className="text-xs text-muted-foreground">
          "미확인"은 0이 아니에요. 전체 경과 시간과 작업자 시간 합계는 다른 값이에요. 구독 사용량을 API 가격으로 바꿔 계산하지 않아요.
        </p>
      </SectionCard>

      <SectionCard title="6. 비교 결론과 한계 (직접 작성)">
        <Field
          label="결론"
          htmlFor="compare-conclusion"
          hint='"협업 때문에 좋아졌다"는 사이트가 판단하지 않아요. 근거가 된 사건이나 평가를 함께 적어 주세요.'
        >
          <Textarea id="compare-conclusion" rows={4} value={conclusion} onChange={(event) => setConclusion(event.target.value)} />
        </Field>
        <Field label="한계" htmlFor="compare-limits" hint="실행 횟수, 다른 조건, 확인하지 못한 값 등">
          <Textarea id="compare-limits" rows={3} value={limits} onChange={(event) => setLimits(event.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={() => status.report(updateComparison(comparison.id, (item) => ({ ...item, conclusion, limits })))}>결론 저장</Button>
          {status.view}
        </div>
      </SectionCard>
    </div>
  );
}
