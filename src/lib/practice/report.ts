// 비교 보고서 (Markdown). 이 파일 하나만 읽어도 과제·조건·결과·평가·근거·측정·결론·한계를 알 수 있게 쓴다.
// 사용자가 적은 글은 코드 블록이나 인용으로 감싸, 제목이나 표를 깨뜨리지 못하게 한다.

import {
  comparisonScopeLine,
  compareConditions,
  eventRoute,
  measureRows,
  type ConditionReport,
} from './compare';
import { measureValueText, participantName, runStyle, RUN_STYLE_LABELS } from './model';
import {
  CHECK_LABELS,
  effectiveScore,
  EVENT_LABELS,
  EVIDENCE_LABELS,
  METRIC_LABELS,
  ORIGIN_LABELS,
  scoreLabel,
  STATUS_LABELS,
} from './rubric';
import { elapsedMinutesFromTimes } from './model';
import { formatLocal } from './time';
import type { CollabEvent, Comparison, PracticeRun } from './types';

/** 표 칸에 들어갈 글: 줄바꿈과 | 를 바꾼다 */
export function cell(value: string): string {
  const clean = value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
  return clean || '미확인';
}

/** 여러 줄 글을 코드 블록으로. 글 안에 ``` 가 있어도 깨지지 않게 울타리를 더 길게 한다. */
export function block(value: string): string {
  if (!value.trim()) return '_(적지 않음)_';
  const longest = Math.max(2, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${value}\n${fence}`;
}

/** 한 줄 글: 맨 앞의 Markdown 기호(#, >, -, 숫자.)가 제목·목록으로 바뀌지 않게 막는다 */
export function inline(value: string): string {
  const clean = value.replace(/\r?\n/g, ' ').trim();
  if (!clean) return '_(적지 않음)_';
  return clean.replace(/[\\`*_[\]<>#|]/g, (char) => `\\${char}`);
}

function runName(_run: PracticeRun, index: number): string {
  return `기록 ${String.fromCharCode(65 + index)}`;
}

function eventLine(run: PracticeRun, event: CollabEvent): string[] {
  const route = eventRoute(run, event.from, event.to);
  const lines = [
    `- **${EVENT_LABELS[event.type]}**${route ? ` (${inline(route)})` : ''} · ${ORIGIN_LABELS[event.origin]}${
      event.evidence.length === 0 ? ', 증거 미첨부' : ''
    }${event.at ? ` · ${formatLocal(event.at)}` : ''}`,
    `  - 내용: ${inline(event.description)}`,
  ];
  if (event.addedEvidence) lines.push(`  - 더해진 근거: ${inline(event.addedEvidence)}`);
  if (event.outcome) lines.push(`  - 결과에 준 변화: ${inline(event.outcome)}`);
  for (const evidence of event.evidence) lines.push(`  - ${EVIDENCE_LABELS[evidence.kind]}: ${inline(evidence.text)}`);
  return lines;
}

function conditionTable(runs: PracticeRun[], report: ConditionReport): string[] {
  const header = `| 조건 | ${runs.map((run, index) => runName(run, index)).join(' | ')} | 판정 |`;
  const lines = [header, `|${' --- |'.repeat(runs.length + 2)}`];
  for (const row of report.rows) {
    const state =
      row.state === 'same' ? '같음' : row.state === 'unknown' ? '확인 불가' : row.variable ? '다름 (실험 변수)' : '다름';
    lines.push(`| ${row.label} | ${row.values.map((value) => cell(value.slice(0, 120))).join(' | ')} | ${state} |`);
  }
  return lines;
}

export function comparisonMarkdown(comparison: Comparison): string {
  const runs = comparison.runs;
  const report = compareConditions(runs, comparison.variables);
  const out: string[] = [];
  out.push(`# 비교 보고서: ${inline(comparison.title)}`, '');
  if (comparison.demo || runs.some((run) => run.demo)) {
    out.push(
      '> **합성 데모입니다.** 실제로 수행하지 않은 예시 기록이며, 실제 성능 비교의 근거가 아닙니다.',
      '',
    );
  }
  out.push(
    `- 스냅샷 시각: ${formatLocal(comparison.snapshotAt)} (이 보고서는 이 시각의 기록 내용입니다)`,
    `- ${comparisonScopeLine(comparison)}`,
    '- 이 사이트는 AI를 실행하지 않습니다. 아래 결과·사건·측정은 사용자가 밖에서 실습하고 적은 기록입니다.',
    '',
  );

  out.push('## 1. 과제와 비교 조건', '');
  out.push('### 공통 입력 (기록 A 기준)', '', block(runs[0].input.text), '');
  if (report.problems.length > 0) {
    out.push('### 조건 경고', '');
    for (const row of report.problems) {
      out.push(
        `- ${row.label}: ${row.state === 'unknown' ? '확인 불가 (적히지 않은 기록이 있음)' : '기록마다 다름'}`,
      );
    }
    out.push('');
  }
  if (comparison.variables.length > 0) {
    out.push(`실험 변수로 고른 조건: ${comparison.variables.map((key) => report.rows.find((row) => row.key === key)?.label ?? key).join(', ')}. 차이는 그대로 아래 표에 있습니다.`, '');
  }
  out.push(...conditionTable(runs, report), '');

  out.push('## 2. 기록별 방식·입력·환경', '');
  runs.forEach((run, index) => {
    out.push(`### ${runName(run, index)}: ${inline(run.title)}`, '');
    out.push(
      `- 방식: ${RUN_STYLE_LABELS[runStyle(run)]}${run.snapshot ? ` · 레시피 "${inline(run.snapshot.recipe.title)}" (역할 ${run.snapshot.recipe.cards.length}개)` : ''}`,
      `- 기록 상태: ${STATUS_LABELS[run.status]}${run.demo ? ' · 합성 데모' : ''}${run.importedAt ? ' · 가져온 기록' : ''}`,
      `- 도구 ${inline(run.input.tool || '미확인')} · 모델 ${inline(run.input.model || '미확인')} · 버전 ${inline(run.input.toolVersion || '미확인')} · 환경 ${inline(run.input.environment || '미확인')}`,
      `- 자료 조건: ${inline(run.input.materials || '미확인')}`,
    );
    if (run.input.text.trim() !== runs[0].input.text.trim()) out.push('', '입력 원문 (기록 A와 다름):', '', block(run.input.text));
    out.push('');
  });

  out.push('## 3. 결과·성공 조건·평가', '');
  runs.forEach((run, index) => {
    out.push(`### ${runName(run, index)} 결과`, '', `요약: ${inline(run.result.summary)}`, '');
    if (run.result.body.trim()) out.push(block(run.result.body), '');
    if (run.result.sources.length > 0) {
      out.push('근거 출처:', ...run.result.sources.map((source) => `- ${inline(source.label)}${source.url ? ` <${source.url.replace(/[<>\s]/g, '')}>` : ''}`), '');
    }
    if (run.result.checks.length > 0) {
      out.push('성공 조건:', ...run.result.checks.map((check) => `- ${CHECK_LABELS[check.state]}: ${inline(check.text)}${check.evidence ? ` — 근거: ${inline(check.evidence)}` : ''}`), '');
    }
    if (run.result.deviations.trim()) out.push(`예정과 달랐던 점: ${inline(run.result.deviations)}`, '');
    if (run.result.unresolved.trim()) out.push(`미해결 사항: ${inline(run.result.unresolved)}`, '');
  });

  out.push('### 항목별 평가', '');
  if (report.rubricComparable) {
    out.push(`| 기준 | ${runs.map((run, index) => runName(run, index)).join(' | ')} |`, `|${' --- |'.repeat(runs.length + 1)}`);
    for (const criterion of runs[0].rubric.criteria) {
      const cells = runs.map((run) => {
        const score = effectiveScore(run, criterion);
        return cell(scoreLabel(score?.value));
      });
      out.push(`| ${cell(criterion.name)} | ${cells.join(' | ')} |`);
    }
    out.push('', '점수는 더하지 않았고, 종합 점수나 순위는 없습니다. "해당 없음"과 "확인 불가"는 0점이 아닙니다.', '');
  } else {
    out.push('평가 기준이 기록마다 달라 나란히 비교하지 않고 원문을 그대로 적습니다.', '');
  }
  runs.forEach((run, index) => {
    const rows = run.rubric.criteria.map((criterion) => {
      const score = effectiveScore(run, criterion);
      const detail = score && 'rationale' in score ? ` — ${inline(score.rationale || '근거 없음')} (평가자 ${inline(score.evaluator || '미확인')}, ${formatLocal(score.evaluatedAt)})` : '';
      return `- ${inline(criterion.name)}: ${scoreLabel(score?.value)}${detail}`;
    });
    out.push(`${runName(run, index)} 평가 근거:`, ...rows, '');
  });

  out.push('## 4. 협업 근거와 판단 변경', '');
  out.push('메시지가 오갔다는 기록과 협업이 효과적이었다는 판단은 다릅니다. 판단은 위 "협업 기여" 평가에 있습니다.', '');
  runs.forEach((run, index) => {
    out.push(`### ${runName(run, index)}`, '');
    if (run.kind === 'single') out.push('단일 AI 기록이라 협업 사건이 없습니다.', '');
    else if (run.events.length === 0) out.push('기록된 협업 사건이 없습니다. (기록이 없다는 것이 일어나지 않았다는 뜻은 아닙니다.)', '');
    else out.push(...run.events.flatMap((event) => eventLine(run, event)), '');
    if (run.result.participants) {
      out.push(`실제 참여 역할: ${run.result.participants.map((id) => participantName(run, id)).join(', ') || '없음'}`, '');
    }
  });

  out.push('## 5. 시간·사용량·사용자 개입', '');
  const rows = measureRows(runs);
  out.push(`| 지표 | ${runs.map((run, index) => runName(run, index)).join(' | ')} |`, `|${' --- |'.repeat(runs.length + 1)}`);
  out.push(
    `| 시작~끝 (적힌 시각으로 계산) | ${runs.map((run) => { const minutes = elapsedMinutesFromTimes(run); return minutes === null ? '미확인' : `${minutes}분`; }).join(' | ')} |`,
  );
  for (const row of rows) {
    const label = row.metric === 'other' ? row.label : METRIC_LABELS[row.metric];
    const cells = row.cells.map((item) =>
      item.measures.length === 0
        ? '적지 않음'
        : cell(item.measures.map((measure) => `${measureValueText(measure)}${measure.scope ? ` (${measure.scope})` : ''}`).join('; ')),
    );
    out.push(`| ${cell(label)}${row.incomparable ? ' ⚠ 범위·단위 다름' : ''} | ${cells.join(' | ')} |`);
  }
  out.push(
    `| 사용자 개입 (사건 수) | ${runs.map((run) => String(run.events.filter((event) => event.type === 'user-intervention').length)).join(' | ')} |`,
    '',
    '"미확인"은 0이 아닙니다. 전체 경과 시간과 작업자 시간 합계는 다른 값입니다. 토큰과 금액은 도구마다 세는 범위가 다릅니다.',
    '',
  );

  out.push('## 6. 비교 결론 (사용자 작성)', '', block(comparison.conclusion), '');
  out.push('## 한계', '', block(comparison.limits), '');
  out.push(
    '- 결론은 사용자의 판단입니다. "협업 때문에 좋아졌다"는 이 사이트가 추론한 것이 아닙니다.',
    `- 기록 ${runs.length}개, 각 1회 실행입니다. 반복 실행이나 통계 검정은 하지 않았습니다.`,
    '',
  );
  return out.join('\n');
}
