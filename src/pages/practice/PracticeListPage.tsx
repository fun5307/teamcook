// 실습 기록 목록: 기록과 비교 묶음, 필터, 비교에 추가, JSON 가져오기·내보내기, 예제 불러오기.

import { useMemo, useRef, useState } from 'react';
import { BookOpen, FileUp, GitCompareArrows, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, Notice, PageHeader } from '@/components/common';
import {
  PracticeExportButton,
  RunBadges,
  SaveErrorNotice,
  useSaveStatus,
} from '@/components/practice/PracticeParts';
import { navigate } from '@/lib/router';
import { RUN_STYLE_LABELS, runStyle, STATUS_ORDER, type RunStyle } from '@/lib/practice/model';
import { STATUS_LABELS } from '@/lib/practice/rubric';
import { formatLocal } from '@/lib/practice/time';
import { buildExport, IMPORT_SIZE_LIMIT, previewImport, type ImportPlan } from '@/lib/practice/transfer';
import type { RunStatus } from '@/lib/practice/types';
import { importPlan, loadDemo, saveComparison, usePractice } from '@/store/usePractice';

const MAX_COMPARE = 4;

export function PracticeListPage() {
  const tasks = usePractice((state) => state.tasks);
  const runs = usePractice((state) => state.runs);
  const comparisons = usePractice((state) => state.comparisons);
  const unreadable = usePractice((state) => state.unreadable);
  const [status, setStatus] = useState<RunStatus | 'all'>('all');
  const [style, setStyle] = useState<RunStyle | 'all'>('all');
  const [taskId, setTaskId] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState<{ fileName: string; plan: ImportPlan } | null>(null);
  const [importError, setImportError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const save = useSaveStatus();

  const taskTitle = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);
  const visible = runs.filter(
    (run) =>
      run.archived === showArchived &&
      (status === 'all' || run.status === status) &&
      (style === 'all' || runStyle(run) === style) &&
      (taskId === 'all' || run.taskId === taskId),
  );
  const archivedCount = runs.filter((run) => run.archived).length;
  const toggle = (id: string) =>
    setSelected((old) => (old.includes(id) ? old.filter((item) => item !== id) : [...old, id]));
  const chosen = runs.filter((run) => selected.includes(run.id));

  const onCompare = () => {
    const title = chosen.map((run) => run.title).join(' · ').slice(0, 120);
    const { result, id } = saveComparison(title, chosen);
    if (save.report(result)) navigate(`/compare/${id}`);
  };

  const onFile = async (file: File | undefined) => {
    setImportError('');
    setImporting(null);
    if (!file) return;
    if (file.size > IMPORT_SIZE_LIMIT) {
      setImportError(`파일이 너무 커요. ${IMPORT_SIZE_LIMIT / 1000_000}MB까지 가져올 수 있어요.`);
      return;
    }
    const preview = previewImport(await file.text(), usePractice.getState());
    if (preview.ok) setImporting({ fileName: file.name, plan: preview.plan });
    else setImportError(preview.error);
  };

  const empty = runs.length === 0 && comparisons.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="실습 기록"
        description="레시피로 밖에서 실습한 결과를 적어 두고, 같은 과제의 다른 방식과 견주어 봐요. 이 사이트는 AI를 실행하지 않아요."
        actions={
          <>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <FileUp aria-hidden />
              가져오기
            </Button>
            {runs.length > 0 ? (
              <PracticeExportButton
                label="모두 내보내기"
                title="실습 기록 내보내기 (JSON)"
                build={(options) => ({
                  fileName: 'teamcook-실습기록.json',
                  type: 'application/json',
                  text: JSON.stringify(buildExport(usePractice.getState(), { runs, comparisons }, options), null, 2),
                })}
              />
            ) : null}
            <Button asChild>
              <a href="#/runs/new">
                <Plus aria-hidden />새 기록
              </a>
            </Button>
          </>
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <SaveErrorNotice />
      {unreadable.length > 0 ? (
        <Notice tone="warn">
          이 버전이 읽지 못한 실습 기록이 {unreadable.length}개 있어요. 지우지 않고 그대로 보관하고 있습니다.
        </Notice>
      ) : null}
      {importError ? (
        <Notice tone="error">
          <span role="alert">가져오지 않았어요. {importError}</span> 기존 기록은 그대로입니다.
        </Notice>
      ) : null}
      {importing ? (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label="가져오기 확인">
          <p className="font-medium">
            {importing.fileName}: 기록 {importing.plan.runs.length}개, 비교 {importing.plan.comparisons.length}개, 과제{' '}
            {importing.plan.tasks.length}개
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {importing.plan.renamed > 0 ? (
              <li>이미 있는 것과 id가 겹치는 {importing.plan.renamed}개는 새 id로 복사해요. 기존 기록은 바뀌지 않아요.</li>
            ) : null}
            {importing.plan.omitted.length > 0 ? <li>보낸 쪽에서 뺀 항목: {importing.plan.omitted.join(', ')}</li> : null}
            {importing.plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
            <li>가져온 기록의 사건·측정 출처는 "가져온 자료"로 표시돼요.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (save.report(importPlan(importing.plan), '가져왔어요')) setImporting(null);
              }}
            >
              가져오기
            </Button>
            <Button variant="outline" onClick={() => setImporting(null)}>
              취소
            </Button>
          </div>
        </section>
      ) : null}
      {save.view}

      {empty ? (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-bold">아직 기록이 없어요</h2>
          <ol className="list-decimal pl-5 text-sm leading-relaxed">
            <li>
              레시피를 하나 고릅니다. 처음이라면{' '}
              <a className="text-primary underline-offset-2 hover:underline" href="#/recipe/builtin-graphrag-feasibility">
                GraphRAG 주제 3개 타당성 검토
              </a>
              를 추천해요.
            </li>
            <li>그 레시피 화면에서 오른쪽 위 "실습 기록"을 열고 "이 레시피로 기록 만들기"를 누른 뒤, 넣을 과제와 쓰는 도구를 적습니다.</li>
            <li>Claude Code 같은 도구에서 실제로 실습한 뒤, 결과와 협업 과정(이견, 재조사 등)을 적습니다.</li>
            <li>같은 과제를 AI 하나에게 그냥 시켜 본 기록도 만들어 두면 나란히 견줄 수 있어요.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => save.report(loadDemo(), '예제를 불러왔어요')}>
              <BookOpen aria-hidden />
              예제 불러오기 (합성 데모)
            </Button>
            <span className="text-xs text-muted-foreground">
              실제로 수행하지 않은 예시 기록 3개와 비교 1개예요. "합성 데모"로 표시됩니다.
            </span>
          </div>
        </section>
      ) : null}

      {comparisons.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">비교</h2>
          <ul className="flex flex-col gap-2">
            {comparisons.map((comparison) => (
              <li key={comparison.id}>
                <a
                  href={`#/compare/${encodeURIComponent(comparison.id)}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 hover:border-foreground/40"
                >
                  <span className="font-medium">{comparison.title}</span>
                  <span className="text-xs text-muted-foreground">
                    기록 {comparison.runs.length}개 · {formatLocal(comparison.snapshotAt)}
                    {comparison.demo ? ' · 합성 데모' : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {runs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-bold">{showArchived ? '보관한 기록' : '기록'}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect aria-label="상태" className="w-auto" value={status} onChange={(event) => setStatus(event.target.value as RunStatus | 'all')}>
                <option value="all">모든 상태</option>
                {STATUS_ORDER.map((item) => (
                  <option key={item} value={item}>
                    {STATUS_LABELS[item]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="방식" className="w-auto" value={style} onChange={(event) => setStyle(event.target.value as RunStyle | 'all')}>
                <option value="all">모든 방식</option>
                {(Object.keys(RUN_STYLE_LABELS) as RunStyle[]).map((item) => (
                  <option key={item} value={item}>
                    {RUN_STYLE_LABELS[item]}
                  </option>
                ))}
              </NativeSelect>
              {tasks.length > 1 ? (
                <NativeSelect aria-label="비교 과제" className="w-auto max-w-56" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
                  <option value="all">모든 과제</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}
              {archivedCount > 0 || showArchived ? (
                <Button size="sm" variant="ghost" onClick={() => setShowArchived((old) => !old)}>
                  {showArchived ? '기록으로 돌아가기' : `보관함 ${archivedCount}`}
                </Button>
              ) : null}
            </div>
          </div>

          {visible.length === 0 ? <p className="text-sm text-muted-foreground">조건에 맞는 기록이 없어요.</p> : null}
          <ul className="flex flex-col gap-2">
            {visible.map((run) => (
              <li key={run.id} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1.5 size-4"
                  aria-label={`${run.title} 비교에 추가`}
                  checked={selected.includes(run.id)}
                  onChange={() => toggle(run.id)}
                />
                <a href={`#/run/${encodeURIComponent(run.id)}`} className="flex min-w-0 flex-1 flex-col gap-1 hover:underline-offset-2">
                  <span className="font-medium hover:underline">{run.title}</span>
                  <RunBadges run={run} />
                  <span className="text-xs text-muted-foreground">
                    {run.taskId ? `과제: ${taskTitle.get(run.taskId) ?? '알 수 없음'} · ` : ''}
                    {formatLocal(run.updatedAt)} 수정
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selected.length > 0 ? (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background px-4 py-3 shadow-lg">
          <span className="text-sm">
            {selected.length}개 선택
            {selected.length < 2 ? ' · 2개 이상 고르면 비교할 수 있어요' : ''}
            {selected.length > MAX_COMPARE
              ? ` · 한 번에 ${MAX_COMPARE}개까지 비교해요. 나머지는 비교를 하나 더 만들어 주세요.`
              : ''}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              선택 해제
            </Button>
            <Button size="sm" disabled={selected.length < 2 || selected.length > MAX_COMPARE} onClick={onCompare}>
              <GitCompareArrows aria-hidden />
              비교 만들기
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
