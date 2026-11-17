// 실습 기록 만들기: 방식(레시피 또는 단일 AI) → 넣을 과제 → 쓰는 도구 → 평가 기준 → 만들기.
// 같은 과제로 다시 기록할 때(?task=)는 과제의 입력·자료 조건·평가 기준을 그대로 쓰고 고칠 수 없다.

import { useState } from 'react';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, NativeSelect, Notice, PageHeader } from '@/components/common';
import { SaveErrorNotice, useSaveStatus } from '@/components/practice/PracticeParts';
import { StyleChip } from '@/components/RouteInfo';
import { builtinRecipes } from '@/data/recipes';
import { newId } from '@/lib/id';
import { navigate } from '@/lib/router';
import { createRun, createTask, EMPTY_INPUT } from '@/lib/practice/model';
import { defaultRubric } from '@/lib/practice/rubric';
import type { Criterion, RunInput } from '@/lib/practice/types';
import { saveNewRun, usePractice } from '@/store/usePractice';
import { useStore } from '@/store/useStore';

export function PracticeNewPage({ recipeId, taskId }: { recipeId?: string; taskId?: string }) {
  const myRecipes = useStore((state) => state.recipes);
  const tasks = usePractice((state) => state.tasks);
  const allRecipes = [...myRecipes, ...builtinRecipes];
  const task = taskId ? tasks.find((item) => item.id === taskId) : undefined;

  const [chosenRecipe, setChosenRecipe] = useState<string>(recipeId ?? '');
  const recipe = allRecipes.find((item) => item.id === chosenRecipe);
  const [title, setTitle] = useState('');
  const [text, setText] = useState(task?.input ?? '');
  const [materials, setMaterials] = useState(task?.materials ?? '');
  const [env, setEnv] = useState<RunInput>({ ...EMPTY_INPUT, tool: recipe ? 'Claude Code' : '' });
  const [criteria, setCriteria] = useState<Criterion[]>(() => defaultRubric().criteria);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const save = useSaveStatus();

  if (taskId && !task) {
    return <Notice tone="warn">이 과제를 찾을 수 없어요. 실습 기록 목록에서 다시 골라 주세요.</Notice>;
  }
  if (recipeId && !recipe) {
    return <Notice tone="warn">이 레시피를 찾을 수 없어요. 레시피를 지웠다면 목록에서 다른 레시피를 골라 주세요.</Notice>;
  }

  const locked = Boolean(task);
  const onCreate = () => {
    const usedTask =
      task ??
      createTask({
        title: '',
        input: text,
        materials,
        // 기본 기준을 그대로 쓰면 기본 기준 id를, 하나라도 바꾸면 '사용자 기준'으로 적는다
        rubric:
          JSON.stringify(criteria) === JSON.stringify(defaultRubric().criteria)
            ? defaultRubric()
            : { id: 'custom', version: 1, criteria },
        successCriteria: recipe?.successCriteria,
      });
    const run = createRun({ title, recipe, task: usedTask, input: env });
    if (save.report(saveNewRun(run, usedTask, !task))) navigate(`/run/${run.id}`);
  };

  const addCriterion = () => {
    if (!draftName.trim()) return;
    setCriteria((old) => [
      ...old,
      { id: newId('crit'), name: draftName.trim(), description: draftDescription.trim(), levels: ['', '', '', ''] },
    ]);
    setDraftName('');
    setDraftDescription('');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={task ? '같은 과제로 다시 기록하기' : '실습 기록 만들기'}
        description="기록을 만드는 것은 AI를 실행하는 게 아니에요. 밖에서 실습한 내용을 적을 자리를 만드는 것입니다."
      />
      <SaveErrorNotice />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold">1. 어떤 방식으로 실습하나요?</h2>
        <NativeSelect
          aria-label="실습 방식"
          value={chosenRecipe}
          onChange={(event) => {
            setChosenRecipe(event.target.value);
            setEnv((old) => ({ ...old, tool: old.tool || (event.target.value ? 'Claude Code' : '') }));
          }}
        >
          <option value="">단일 AI (레시피 없이 AI 하나에게 시킴, 비교 기준용)</option>
          {myRecipes.length > 0 ? (
            <optgroup label="내 레시피">
              {myRecipes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="기본 레시피">
            {builtinRecipes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </optgroup>
        </NativeSelect>
        {recipe ? (
          <div className="flex flex-col gap-1 text-sm">
            <p>{recipe.summary}</p>
            <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <StyleChip recipe={recipe} />
              역할 {recipe.cards.length}개: {recipe.cards.map((card) => card.displayName).join(', ')}
            </p>
            <p className="text-xs text-muted-foreground">
              만들 때의 레시피를 그대로 복사해 둡니다. 나중에 레시피를 고치거나 지워도 이 기록은 바뀌지 않아요.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            단일 AI 기록에서는 실제로 넣은 프롬프트를 아래 "넣을 과제"에 그대로 적어 주세요. 협업 기여 평가는 "해당 없음"이 됩니다.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold">2. 넣을 과제</h2>
        {locked ? (
          <Notice tone="info">
            과제 "{task!.title}"의 입력·자료 조건·평가 기준을 그대로 써요. 결과와 점수는 복사하지 않아요.
          </Notice>
        ) : null}
        <Field label="입력 원문" htmlFor="run-input" hint="AI에게 실제로 넣을(넣은) 글을 그대로 적어 주세요.">
          <Textarea id="run-input" rows={5} value={text} readOnly={locked} onChange={(event) => setText(event.target.value)} />
        </Field>
        {!locked && recipe?.sampleTask && text !== recipe.sampleTask ? (
          <div>
            <Button size="sm" variant="outline" onClick={() => setText(recipe.sampleTask!)}>
              레시피의 과제 예시로 채우기
            </Button>
            <span className="ml-2 text-xs text-muted-foreground">채운 뒤 실제로 넣을 내용과 같은지 확인해 주세요.</span>
          </div>
        ) : null}
        <Field label="자료 조건" htmlFor="run-materials" hint="예: 웹 검색 허용, 첨부 자료 없음. 비워 두면 '미확인'이에요.">
          <Input id="run-materials" className="bg-card" value={materials} readOnly={locked} onChange={(event) => setMaterials(event.target.value)} />
        </Field>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold">3. 쓰는 도구</h2>
        <p className="text-sm text-muted-foreground">모르는 칸은 비워 두세요. 빈 칸은 "미확인"으로 남고 짐작해서 채우지 않아요.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['tool', '도구', '예: Claude Code, ChatGPT'],
              ['model', '모델', '예: 화면에 표시된 모델 이름'],
              ['toolVersion', '도구 버전', '예: claude --version 결과'],
              ['environment', '환경', '예: Windows 11'],
            ] as const
          ).map(([key, label, placeholder]) => (
            <Field key={key} label={label} htmlFor={`run-${key}`}>
              <Input
                id={`run-${key}`}
                className="bg-card"
                placeholder={placeholder}
                value={env[key]}
                onChange={(event) => setEnv((old) => ({ ...old, [key]: event.target.value }))}
              />
            </Field>
          ))}
        </div>
        <Field label="기록 이름 (선택)" htmlFor="run-title">
          <Input
            id="run-title"
            className="bg-card"
            placeholder={recipe ? `${recipe.title} 실습` : '단일 AI 실습'}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
      </section>

      <details className="rounded-xl border bg-card p-5">
        <summary className="cursor-pointer text-lg font-bold">
          4. 평가 기준 <span className="text-sm font-normal text-muted-foreground">기본 {defaultRubric().criteria.length}가지, 0~3점과 확인 불가</span>
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          {locked ? <p className="text-sm text-muted-foreground">같은 과제의 평가 기준을 그대로 써요.</p> : null}
          <ul className="flex flex-col gap-2">
            {(locked ? task!.rubric.criteria : criteria).map((criterion) => (
              <li key={criterion.id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{criterion.name}</span>
                  <span className="block text-xs text-muted-foreground">{criterion.description}</span>
                </span>
                {!locked ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${criterion.name} 빼기`}
                    onClick={() => setCriteria((old) => old.filter((item) => item.id !== criterion.id))}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {!locked ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">기준 추가</p>
              <Input className="bg-card" aria-label="새 기준 이름" placeholder="기준 이름" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
              <Input className="bg-card" aria-label="새 기준 설명" placeholder="무엇을 보는지 (선택)" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} />
              <div>
                <Button size="sm" variant="outline" disabled={!draftName.trim()} onClick={addCriterion}>
                  <Plus aria-hidden />
                  추가
                </Button>
              </div>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            기록을 만든 뒤에는 이 기준이 기록에 복사돼 고정됩니다. 바꾸려면 새 기록을 만들어요.
          </p>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onCreate} disabled={!text.trim() || (!locked && criteria.length === 0)}>
          <NotebookPen aria-hidden />
          기록 만들기
        </Button>
        {!text.trim() ? <span className="text-sm text-muted-foreground">입력 원문을 적으면 만들 수 있어요.</span> : null}
        {save.view}
      </div>
    </div>
  );
}
