// 레시피 편집기. 한 화면에 한 가지 일만 하도록 세 단계로 나눈다: ① 팀 소개 ② 역할 ③ 흐름과 시작.
// 꼭 필요한 칸만 먼저 보이고, 선택 항목은 접어 둔다 (2026-11-17 사용자 요청: 길고 복잡한 화면 줄이기).
// 고치는 즉시 스토어(→ localStorage)에 저장된다.

import { useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  FlaskConical,
  FolderOpen,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Field, NativeSelect, Notice, PageHeader } from '@/components/common';
import { FlowSection } from '@/components/FlowSection';
import { ExportPrepButton } from '@/components/ExportDialog';
import { StartOrderButton } from '@/pages/order/OrdersPage';
import { ShareButton, cloneRecipe } from '@/components/RecipeActions';
import {
  DeliverableEditor,
  LineListEditor,
  PermissionNote,
  VerificationEditor,
} from '@/components/SpecEditors';
import { RunPromptBox, roleLabel } from '@/components/RecipeOverview';
import {
  CardRoute,
  LockBadge,
  PathBadge,
  PlanBadges,
  RecipeRunSummary,
  engineName,
} from '@/components/RouteInfo';
import { COLLABORATIONS, COLLABORATION_IDS, collaborationOf } from '@/data/collaboration';
import { CARD_TEMPLATES, cardFromTemplate } from '@/data/cardTemplates';
import { providerData } from '@/data/providers';
import { TIPS, cardWarnings, recipeWarnings } from '@/data/tips';
import { needsCodexBridge } from '@/lib/bridge';
import { type ExportIssue, fieldDomId, handoffDeliverables, hasCycle } from '@/lib/exportCheck';
import { FLOW_NOTE, PLAN_FIT_NOTE, previewInstructions } from '@/lib/support';
import { newId } from '@/lib/id';
import { applyOptimization, optimizeRecipe } from '@/lib/optimize';
import { importFile } from '@/lib/importFiles';
import { PERMISSION_LABELS } from '@/lib/recipeMd';
import { requiredPlans } from '@/lib/requiredPlans';
import { type PathResolution, bestAccess, effectiveRoute, resolveRecipe } from '@/lib/resolvePath';
import { ROLE_LABELS, ROLE_TAGS } from '@/lib/roles';
import { navigate } from '@/lib/router';
import { useStore } from '@/store/useStore';
import type { AgentCard, Collaboration, EngineId, Handoff, Permission, Recipe, RoleTag } from '@/types';

/** 카드에서 고를 수 있는 엔진 (api·manual 같은 내부용은 뺀다) */
const SELECTABLE_ENGINES = (Object.keys(providerData.engines) as EngineId[]).filter(
  (id) => providerData.engines[id].status !== 'builtin',
);

const MODEL_HINTS: Partial<Record<EngineId, string>> = {
  'codex-cli': '예: gpt-6.1-sol, gpt-6-luna',
  'claude-code': '예: sonnet, opus, haiku',
  'antigravity-cli': '예: inherit, flash, pro',
};

export function CardEditor({
  card,
  recipe,
  onChange,
}: {
  card: AgentCard;
  recipe: Recipe;
  onChange: (patch: Partial<AgentCard>) => void;
}) {
  const key = card.id;
  const warnings = cardWarnings(card, recipe);
  const style = collaborationOf(recipe);
  const count = (items: string[] | undefined) => (items ?? []).filter((item) => item.trim()).length;
  const showTools =
    style !== 'debate' &&
    (style === 'agent-team' || card.preferredEngine === 'claude-code' || (card.tools?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      {warnings.map((warning) => (
        <Notice key={warning.message} tone={warning.level === 'error' ? 'error' : 'warn'}>
          {warning.message}
        </Notice>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="화면에 보이는 이름" htmlFor={`${key}-display`}>
          <Input
            id={`${key}-display`}
            value={card.displayName}
            onChange={(event) => onChange({ displayName: event.target.value })}
            placeholder="예: 교차 검토자"
          />
        </Field>
        <Field
          label="에이전트 이름 (파일 이름이 돼요)"
          htmlFor={`${key}-name`}
          hint="영문 소문자·숫자·밑줄(_). AI에게 일을 맡길 때 이 이름으로 부릅니다."
        >
          <Input
            id={`${key}-name`}
            value={card.name}
            onChange={(event) => onChange({ name: event.target.value.trim() })}
            placeholder="예: reviewer"
            spellCheck={false}
          />
        </Field>
      </div>

      <Field
        label="맡을 일"
        htmlFor={`${key}-role`}
        hint="AI는 이 설명을 보고 언제 이 역할에게 맡길지 정해요. 구체적일수록 좋아요."
      >
        <Textarea
          id={`${key}-role`}
          rows={2}
          value={card.role}
          onChange={(event) => onChange({ role: event.target.value })}
        />
      </Field>

      {style === 'agent-team' ? (
        <p className="text-xs text-muted-foreground">
          에이전트 팀에서는 모든 팀원이 Claude Code에서 돌아요. 아래 '돌릴 도구'는 조리법을 서브에이전트로 바꿨을
          때만 쓰입니다.
        </p>
      ) : null}
      {style === 'debate' ? (
        <p className="text-xs text-muted-foreground">
          토론형에서는 카드가 프롬프트 안의 한 역할이 돼요. 역할 설명과 지시문만 프롬프트에 들어가고, 도구·권한·모델은
          쓰이지 않습니다.
        </p>
      ) : null}
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', style === 'debate' && 'hidden')}>
        <Field label="역할 종류" htmlFor={`${key}-tag`}>
          <NativeSelect
            id={`${key}-tag`}
            value={card.tags?.[0] ?? ''}
            onChange={(event) =>
              onChange({ tags: event.target.value ? [event.target.value] : undefined })
            }
          >
            <option value="">정하지 않음</option>
            {ROLE_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {ROLE_LABELS[tag]}
              </option>
            ))}
            {card.tags?.[0] && !ROLE_TAGS.includes(card.tags[0] as RoleTag) ? (
              <option value={card.tags[0]}>{card.tags[0]}</option>
            ) : null}
          </NativeSelect>
        </Field>
        <Field label="돌릴 도구" htmlFor={`${key}-engine`}>
          <NativeSelect
            id={`${key}-engine`}
            value={card.preferredEngine}
            onChange={(event) =>
              // 도구를 바꾸면 모델 이름은 지운다 (다른 회사 모델 이름이라 쓸 수 없다)
              onChange({ preferredEngine: event.target.value as EngineId, model: undefined })
            }
          >
            {SELECTABLE_ENGINES.map((id) => (
              <option key={id} value={id}>
                {providerData.engines[id].name}
                {providerData.engines[id].status === 'preparing' ? ' (내보내기 준비 중)' : ''}
              </option>
            ))}
            {!SELECTABLE_ENGINES.includes(card.preferredEngine) ? (
              <option value={card.preferredEngine}>{engineName(card.preferredEngine)}</option>
            ) : null}
          </NativeSelect>
        </Field>
        <Field label="권한" htmlFor={`${key}-permission`}>
          <NativeSelect
            id={`${key}-permission`}
            value={card.permission}
            onChange={(event) => onChange({ permission: event.target.value as Permission })}
          >
            {(Object.keys(PERMISSION_LABELS) as Permission[]).map((permission) => (
              <option key={permission} value={permission}>
                {PERMISSION_LABELS[permission]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="모델 (선택)" htmlFor={`${key}-model`} hint={MODEL_HINTS[card.preferredEngine] ?? ''}>
          <Input
            id={`${key}-model`}
            value={card.model ?? ''}
            onChange={(event) => onChange({ model: event.target.value.trim() || undefined })}
            placeholder="비우면 기본 모델"
            spellCheck={false}
          />
        </Field>
      </div>

      <Field
        label="지시문 (이 에이전트가 따를 규칙)"
        htmlFor={`${key}-instructions`}
        hint="서브에이전트는 따로 떨어진 대화창에서 일해요. 꼭 알아야 할 맥락은 여기에 적어 주세요."
      >
        <Textarea
          id={`${key}-instructions`}
          rows={6}
          value={card.instructions}
          onChange={(event) => onChange({ instructions: event.target.value })}
        />
      </Field>

      <details className="rounded-lg border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">
          산출물과 완료 기준{' '}
          <span className="font-normal text-muted-foreground">
            {count(card.deliverables?.map((item) => item.name)) + count(card.completionCriteria) > 0
              ? `산출물 ${count(card.deliverables?.map((item) => item.name))}개, 완료 기준 ${count(card.completionCriteria)}개`
              : '적어 두면 결과가 또렷해져요 (선택)'}
          </span>
        </summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <Field label="산출물 — 끝날 때 내놓는 것">
            <DeliverableEditor
              id={`${key}-deliverables`}
              items={card.deliverables}
              onChange={(deliverables) => onChange({ deliverables })}
            />
          </Field>
          <Field label="완료 기준 — 언제 끝난 것인지">
            <LineListEditor
              id={`${key}-criteria`}
              label="완료 기준"
              items={card.completionCriteria}
              onChange={(completionCriteria) => onChange({ completionCriteria })}
              placeholder="예: 테스트를 실제로 실행했다"
              addLabel="완료 기준 추가"
            />
          </Field>
          <Field label="받을 입력 — 시작하려면 받아야 하는 것">
            <LineListEditor
              id={`${key}-inputs`}
              label="받을 입력"
              items={card.requiredInputs}
              onChange={(requiredInputs) => onChange({ requiredInputs })}
              placeholder="예: 구현할 기능 설명"
              addLabel="입력 추가"
            />
          </Field>
          <Field label="하지 않을 일">
            <LineListEditor
              id={`${key}-boundaries`}
              label="하지 않을 일"
              items={card.boundaries}
              onChange={(boundaries) => onChange({ boundaries })}
              placeholder="예: 관련 없는 파일은 고치지 않는다"
              addLabel="항목 추가"
            />
          </Field>
        </div>
      </details>

      <details className="rounded-lg border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">
          자세히 <span className="font-normal text-muted-foreground">권한이 지켜지는 방식, 파일에 들어갈 지시문, 고급 설정</span>
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {style !== 'debate' ? <PermissionNote card={card} style={style} id={`${key}-permission-note`} /> : null}
          <div>
            <p className="text-sm font-medium">파일에 들어갈 지시문</p>
            <p className="text-xs text-muted-foreground">
              내가 쓴 지시문은 그대로 두고, 산출물과 완료 기준을 뒤에 덧붙입니다.
            </p>
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">
              {previewInstructions(card, style) || '(비어 있어요)'}
            </pre>
          </div>
          {showTools ? (
            <Field
              label="Claude 도구 목록 (고급)"
              htmlFor={`${key}-tools`}
              hint="쉼표로 구분. 비우면 권한에 맞는 기본 목록을 써요."
            >
              <Input
                id={`${key}-tools`}
                value={(card.tools ?? []).join(', ')}
                onChange={(event) => {
                  const tools = event.target.value
                    .split(',')
                    .map((tool) => tool.trim())
                    .filter(Boolean);
                  onChange({ tools: tools.length > 0 ? tools : undefined });
                }}
                placeholder="예: Read, Grep, Glob, WebSearch"
                spellCheck={false}
              />
            </Field>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function CardRow({
  card,
  recipe,
  resolution,
  open,
  onToggle,
  onChange,
  onRemove,
  onMove,
}: {
  card: AgentCard;
  recipe: Recipe;
  resolution: PathResolution;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<AgentCard>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const route = effectiveRoute(resolution);
  const hasProblem = cardWarnings(card, recipe).some((warning) => warning.level === 'error');
  return (
    <article className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4', open && 'ring-2 ring-ring/40')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-base font-semibold">{card.displayName || card.name}</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{card.name}</code>
            {roleLabel(card.tags) ? (
              <span className="text-xs text-muted-foreground">{roleLabel(card.tags)}</span>
            ) : null}
            {hasProblem ? <span className="text-xs font-medium text-rose-700">고칠 점 있음</span> : null}
          </span>
          <span className="line-clamp-1 text-sm text-muted-foreground">{card.role || '역할 설명이 없어요'}</span>
        </button>
        <div className="flex items-center gap-1">
          {resolution.locked ? <LockBadge /> : null}
          <PathBadge path={route.path} short />
          <Button size="icon-sm" variant="ghost" onClick={() => onMove(-1)} aria-label="위로">
            <ChevronUp />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => onMove(1)} aria-label="아래로">
            <ChevronDown />
          </Button>
          <Button size="sm" variant={open ? 'secondary' : 'outline'} onClick={onToggle}>
            {open ? '접기' : '편집'}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label={`${card.displayName} 삭제`}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <CardRoute
        resolution={resolution}
        onApplyAlternative={
          // 도구 바꾸기는 서브에이전트 조리법에서만 뜻이 있다
          collaborationOf(recipe) === 'subagents'
            ? (engine) => onChange({ preferredEngine: engine, model: undefined })
            : undefined
        }
      />
      {open ? <CardEditor card={card} recipe={recipe} onChange={onChange} /> : null}
    </article>
  );
}

function HandoffEditor({
  recipe,
  onChange,
}: {
  recipe: Recipe;
  onChange: (handoffs: Handoff[]) => void;
}) {
  const { cards, handoffs } = recipe;
  const update = (id: string, patch: Partial<Handoff>) =>
    onChange(
      handoffs.map((handoff) => {
        if (handoff.id !== id) return handoff;
        const next = { ...handoff, ...patch };
        if (!next.label) delete next.label;
        if (!next.deliverableIds || next.deliverableIds.length === 0) delete next.deliverableIds;
        return next;
      }),
    );

  if (cards.length < 2) {
    return <p className="text-sm text-muted-foreground">카드가 2장 이상이면 흐름을 정할 수 있어요.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {handoffs.map((handoff, index) => {
        const from = cards.find((card) => card.id === handoff.from);
        const options = (from?.deliverables ?? []).filter((item) => item.name.trim());
        const { found, missing } = handoffDeliverables(recipe, handoff);
        const picked = new Set(handoff.deliverableIds ?? []);
        const empty = found.length === 0 && !handoff.label?.trim();
        return (
          <div
            key={handoff.id}
            id={`handoff-${handoff.id}`}
            tabIndex={-1}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-right text-xs text-muted-foreground">{index + 1}.</span>
              <NativeSelect
                className="w-auto min-w-32 flex-1 sm:flex-none"
                aria-label="보내는 담당자"
                value={handoff.from}
                // 보내는 쪽이 바뀌면 고른 산출물은 다른 역할의 것이므로 비운다
                onChange={(event) => update(handoff.id, { from: event.target.value, deliverableIds: undefined })}
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.displayName || card.name}
                  </option>
                ))}
              </NativeSelect>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              <NativeSelect
                className="w-auto min-w-32 flex-1 sm:flex-none"
                aria-label="받는 담당자"
                value={handoff.to}
                onChange={(event) => update(handoff.id, { to: event.target.value })}
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.displayName || card.name}
                  </option>
                ))}
              </NativeSelect>
              <Input
                className="min-w-40 flex-1"
                aria-label="추가 전달 설명"
                placeholder="추가 전달 설명. 예: 변경 내용 전달"
                value={handoff.label ?? ''}
                onChange={(event) => update(handoff.id, { label: event.target.value || undefined })}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="이 넘겨주기 삭제"
                onClick={() => onChange(handoffs.filter((item) => item.id !== handoff.id))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-7 text-sm" role="group" aria-label="넘기는 산출물">
              <span className="text-xs text-muted-foreground">넘기는 산출물</span>
              {options.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  보내는 역할에 산출물이 없어요. 역할 카드에서 먼저 적어 주세요.
                </span>
              ) : null}
              {options.map((item) => (
                <label key={item.id} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={picked.has(item.id)}
                    onChange={(event) => {
                      const ids = (handoff.deliverableIds ?? []).filter((id) => id !== item.id);
                      update(handoff.id, { deliverableIds: event.target.checked ? [...ids, item.id] : ids });
                    }}
                  />
                  {item.name}
                </label>
              ))}
              {missing.length > 0 ? (
                <span className="inline-flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                  재선택 필요: 지워진 산출물 {missing.length}개를 가리켜요
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => update(handoff.id, { deliverableIds: found.map((item) => item.id) })}
                  >
                    지우기
                  </button>
                </span>
              ) : null}
              {empty && missing.length === 0 ? (
                <span className="text-xs font-medium text-amber-800">무엇을 넘기는지 아직 적지 않았어요.</span>
              ) : null}
            </div>
          </div>
        );
      })}
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([...handoffs, { id: newId('handoff'), from: cards[0].id, to: cards[1].id }])
          }
        >
          <Plus aria-hidden />
          넘겨주기 추가
        </Button>
      </div>
    </div>
  );
}

type Step = 'basics' | 'cards' | 'flow';

export function RecipeEditorPage({ id }: { id: string }) {
  const recipe = useStore((state) => state.recipes.find((item) => item.id === id));
  const plans = useStore((state) => state.plans);
  const saveRecipe = useStore((state) => state.saveRecipe);
  const removeRecipe = useStore((state) => state.removeRecipe);

  const [openCard, setOpenCard] = useState<string | null>(null);
  const [codexBridge, setCodexBridge] = useState(false);
  const [step, setStep] = useState<Step>('basics');
  const [messages, setMessages] = useState<{ tone: 'success' | 'error'; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!recipe) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warn">
          이 레시피를 찾을 수 없어요. 다른 브라우저에서 만들었거나 삭제된 레시피일 수 있어요. (레시피는 이
          브라우저 안에만 저장돼요.)
        </Notice>
        <div>
          <Button asChild variant="outline">
            <a href="#/recipes">레시피 책으로 돌아가기</a>
          </Button>
        </div>
      </div>
    );
  }

  const update = (patch: Partial<Recipe>) => saveRecipe({ ...recipe, ...patch });
  const updateCard = (cardId: string, patch: Partial<AgentCard>) =>
    update({
      cards: recipe.cards.map((card) => {
        if (card.id !== cardId) return card;
        const next = { ...card, ...patch };
        // undefined로 지운 선택 항목은 키 자체를 없앤다 (공유 링크·recipe.json을 깔끔하게)
        for (const field of [
          'model',
          'tools',
          'tags',
          'requiredInputs',
          'deliverables',
          'completionCriteria',
          'boundaries',
        ] as const) {
          if (next[field] === undefined) delete next[field];
        }
        return next;
      }),
    });
  const removeCard = (cardId: string) =>
    update({
      cards: recipe.cards.filter((card) => card.id !== cardId),
      handoffs: recipe.handoffs.filter((handoff) => handoff.from !== cardId && handoff.to !== cardId),
    });
  const moveCard = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= recipe.cards.length) return;
    const cards = [...recipe.cards];
    [cards[index], cards[target]] = [cards[target], cards[index]];
    update({ cards });
  };
  const addCard = (tag: RoleTag) => {
    // 새 카드는 마지막 카드와 같은 도구로 시작한다. 첫 카드라면 내 플랜으로 쓸 수 있는 도구를 고른다.
    const engine: EngineId =
      recipe.cards.at(-1)?.preferredEngine ??
      SELECTABLE_ENGINES.find(
        (id) => providerData.engines[id].status === 'ready' && bestAccess(id, plans, providerData),
      ) ??
      'codex-cli';
    const card = cardFromTemplate(tag, newId('card'), recipe.cards, engine);
    update({ cards: [...recipe.cards, card] });
    setOpenCard(card.id);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: { tone: 'success' | 'error'; text: string }[] = [];
    const added: AgentCard[] = [];
    for (const file of Array.from(files)) {
      const result = importFile(file.name, await file.text());
      if (result.kind === 'error') {
        next.push({ tone: 'error', text: `${file.name}: ${result.message}` });
      } else if (result.kind === 'card') {
        added.push(result.card);
      } else {
        // recipe.json을 편집 중인 레시피에 불러오면 그 안의 카드만 더한다
        added.push(...result.recipe.cards.map((card) => ({ ...card, id: newId('card') })));
      }
    }
    if (added.length > 0) {
      update({ cards: [...recipe.cards, ...added] });
      next.push({
        tone: 'success',
        text: `에이전트 카드 ${added.length}장을 불러왔어요. 지시문은 그대로 두었고, 파일에 없는 산출물·완료 기준은 비어 있을 수 있으니 카드를 열어 채워 주세요.`,
      });
    }
    setMessages(next);
    if (fileInput.current) fileInput.current.value = '';
  };

  const onDelete = () => {
    if (window.confirm(`"${recipe.title}" 레시피를 삭제할까요? 되돌릴 수 없어요.`)) {
      removeRecipe(recipe.id);
      navigate('/recipes');
    }
  };

  const onDuplicate = () => {
    const copy = cloneRecipe(recipe, `${recipe.title} (사본)`);
    saveRecipe(copy);
    navigate(`/edit/${copy.id}`);
  };

  const style = collaborationOf(recipe);
  const setStyle = (next: Collaboration) => {
    // 서브에이전트(기본값)는 필드를 아예 지워서 옛 형식과 똑같은 링크가 되게 한다
    const { collaboration: _old, ...rest } = recipe;
    saveRecipe(next === 'subagents' ? rest : { ...rest, collaboration: next });
  };
  /** 비우면 키를 지우는 레시피 항목 고치기 (공유 링크·recipe.json을 깔끔하게) */
  const setOptional = <K extends 'learningObjective' | 'sampleTask' | 'successCriteria' | 'prerequisites' | 'verification'>(
    key: K,
    value: Recipe[K],
  ) => {
    const next = { ...recipe, [key]: value };
    if (value === undefined || value === '') delete next[key];
    saveRecipe(next);
  };
  /** 내보내기 점검 항목이 가리키는 입력 칸으로 옮겨 가서 초점을 맞춘다 */
  const gotoIssue = (issue: ExportIssue) => {
    const { target } = issue;
    // 그 입력 칸이 있는 단계로 먼저 옮긴다
    if (target.kind === 'card') setStep('cards');
    else if (target.kind === 'handoff' || target.field === 'flow') setStep('flow');
    else setStep(target.field === 'cards' ? 'cards' : 'basics');
    if (target.kind === 'card' && target.id) setOpenCard(target.id);
    const domId = fieldDomId(target);
    // 단계가 바뀌고 카드가 펼쳐진 다음에 찾는다
    window.setTimeout(() => {
      const element = document.getElementById(domId);
      if (!element) return;
      // 접어 둔 칸 안에 있으면 펼친다
      for (let box = element.closest('details'); box; box = box.parentElement?.closest('details') ?? null) {
        box.open = true;
      }
      element.scrollIntoView({ block: 'center' });
      const focusable = element.matches('input, textarea, select, button, [tabindex]')
        ? element
        : element.querySelector<HTMLElement>('input, textarea, select, button');
      (focusable ?? element).focus();
    }, 80);
  };
  const resolved = resolveRecipe(recipe, plans, providerData);
  // 구독 최적화(도구 다시 배치)는 카드마다 도구를 고르는 서브에이전트 조리법에서만 뜻이 있다
  const optimized =
    style === 'subagents' ? optimizeRecipe(recipe, plans, providerData) : { changes: [], summary: '' };
  const cardName = (cardId: string) => {
    const card = recipe.cards.find((item) => item.id === cardId);
    return card ? card.displayName || card.name : '';
  };
  const required = requiredPlans(recipe, providerData);

  const steps: { id: Step; label: string; note: string }[] = [
    { id: 'basics', label: '팀 소개', note: COLLABORATIONS[style].label },
    { id: 'cards', label: '역할', note: `${recipe.cards.length}명` },
    { id: 'flow', label: '흐름과 시작', note: `넘겨주기 ${recipe.handoffs.length}개` },
  ];
  const stepIndex = steps.findIndex((item) => item.id === step);
  const next = steps[stepIndex + 1];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={recipe.title || '이름 없는 레시피'}
        description="고치는 즉시 이 브라우저에 자동 저장돼요."
        actions={
          <>
            <ShareButton recipe={recipe} />
            <ExportPrepButton recipe={recipe} plans={plans} codexBridge={codexBridge} onGoto={gotoIssue} />
            <StartOrderButton recipe={recipe} />
            <Button variant="ghost" onClick={onDuplicate}>
              <Copy aria-hidden />
              복제
            </Button>
            <Button variant="ghost" onClick={onDelete}>
              <Trash2 aria-hidden />
              삭제
            </Button>
          </>
        }
      />

      <nav className="flex flex-wrap gap-x-1 border-b" aria-label="편집 단계">
        {steps.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.id === step ? 'step' : undefined}
            onClick={() => setStep(item.id)}
            className={cn(
              '-mb-px flex items-baseline gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors',
              item.id === step
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="font-heading text-base font-extrabold tabular-nums">{index + 1}</span>
            {item.label}
            <span className="text-xs font-normal text-muted-foreground">{item.note}</span>
          </button>
        ))}
      </nav>

      {step === 'basics' ? (
        <section className="flex flex-col gap-5">
          <Field label="레시피 제목" htmlFor="recipe-title">
            <Input
              id="recipe-title"
              className="h-10 bg-card text-lg font-semibold"
              value={recipe.title}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="예: Claude 작성 + Codex 교차 검토"
            />
          </Field>
          <Field label="어떤 팀인가요? (한두 줄)" htmlFor="recipe-summary">
            <Textarea
              id="recipe-summary"
              className="bg-card"
              rows={2}
              value={recipe.summary}
              onChange={(event) => update({ summary: event.target.value })}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">조리법 — 어떤 방식으로 함께 일하나요?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {COLLABORATION_IDS.map((id) => {
                const info = COLLABORATIONS[id];
                const selected = style === id;
                return (
                  <label
                    key={id}
                    className={cn(
                      'flex cursor-pointer flex-col gap-0.5 rounded-lg border bg-card p-3 text-sm transition-colors',
                      selected ? 'border-foreground ring-1 ring-foreground' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      <input
                        type="radio"
                        name="recipe-collaboration"
                        className="accent-primary"
                        checked={selected}
                        onChange={() => setStyle(id)}
                      />
                      {info.label}
                      {info.experimental ? (
                        <span className="inline-flex items-center gap-1 text-xs font-normal text-primary">
                          <FlaskConical className="size-3" aria-hidden />
                          실험 기능
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{info.availability}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">{COLLABORATIONS[style].description}</p>
          </fieldset>

          <Field
            label="이 레시피로 익히는 것 (학습 목표)"
            htmlFor="recipe-objective"
            hint="한두 문장이면 됩니다. 설명서 맨 위에 들어가요."
          >
            <Textarea
              id="recipe-objective"
              className="bg-card"
              rows={2}
              value={recipe.learningObjective ?? ''}
              onChange={(event) => setOptional('learningObjective', event.target.value)}
              placeholder="예: 만드는 모델과 검토하는 모델을 다르게 두면 무엇이 달라지는지 익힌다."
            />
          </Field>

          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              더 적기{' '}
              <span className="font-normal text-muted-foreground">
                성공 조건, 과제 예시, 준비 조건, 실행 팁, 확인 기록 (모두 선택)
              </span>
            </summary>
            <div className="mt-4 flex flex-col gap-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="성공 조건 — 무엇이 되면 성공인가요?" hint="적어 두면 AI가 마지막에 하나씩 확인해 줘요.">
                  <LineListEditor
                    id="recipe-success"
                    label="성공 조건"
                    items={recipe.successCriteria}
                    onChange={(items) => setOptional('successCriteria', items)}
                    placeholder="예: 검토자가 파일을 고치지 않고 지적만 했다"
                    addLabel="성공 조건 추가"
                  />
                </Field>
                <Field label="준비 조건 — 시작 전에 갖춰야 할 것">
                  <LineListEditor
                    id="recipe-prereq"
                    label="준비 조건"
                    items={recipe.prerequisites}
                    onChange={(items) => setOptional('prerequisites', items)}
                    placeholder="예: Claude Code 설치와 로그인"
                    addLabel="준비 조건 추가"
                  />
                </Field>
              </div>
              <Field label="과제 예시 — 처음 넣어 볼 과제" htmlFor="recipe-sample">
                <Textarea
                  id="recipe-sample"
                  rows={2}
                  value={recipe.sampleTask ?? ''}
                  onChange={(event) => setOptional('sampleTask', event.target.value)}
                  placeholder='예: 할 일 목록 앱에 "완료한 항목 숨기기" 버튼을 추가해 줘.'
                />
              </Field>
              <Field label="실행 팁 — 이 팀을 어떻게 시작하면 좋은지" htmlFor="recipe-howto">
                <Textarea
                  id="recipe-howto"
                  rows={2}
                  value={recipe.howToRun ?? ''}
                  onChange={(event) => {
                    const { howToRun: _old, ...rest } = recipe;
                    saveRecipe(event.target.value ? { ...rest, howToRun: event.target.value } : rest);
                  }}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="쓰임새" htmlFor="recipe-usecase">
                  <Input
                    id="recipe-usecase"
                    value={recipe.useCase}
                    onChange={(event) => update({ useCase: event.target.value })}
                    placeholder="예: 기능 구현 후 검토"
                  />
                </Field>
                <Field label="만든 사람 (닉네임)" htmlFor="recipe-author">
                  <Input
                    id="recipe-author"
                    value={recipe.author ?? ''}
                    onChange={(event) => {
                      const { author: _old, ...rest } = recipe;
                      saveRecipe(event.target.value ? { ...rest, author: event.target.value } : rest);
                    }}
                  />
                </Field>
                <Field label="동시에 돌릴 에이전트 수" htmlFor="recipe-threads" hint="2~3개로 시작하세요.">
                  <Input
                    id="recipe-threads"
                    type="number"
                    min={1}
                    max={20}
                    value={recipe.settings.maxThreads}
                    onChange={(event) =>
                      update({
                        settings: {
                          ...recipe.settings,
                          maxThreads: Math.min(20, Math.max(1, Number(event.target.value) || 1)),
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  확인 기록 {recipe.verification?.length ?? 0}건{' '}
                  <span className="font-normal text-muted-foreground">직접 돌려 본 결과를 적어 두는 곳</span>
                </p>
                <VerificationEditor
                  records={recipe.verification}
                  onChange={(records) => setOptional('verification', records)}
                />
              </div>
            </div>
          </details>
        </section>
      ) : null}

      {step === 'cards' ? (
        <section
          className="flex flex-col gap-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void onFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="recipe-cards" tabIndex={-1} className="text-xl font-bold focus-visible:outline-none">
              역할 {recipe.cards.length}명
            </h2>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <FolderOpen aria-hidden />
              파일에서 불러오기
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".toml,.md,.json"
              className="hidden"
              onChange={(event) => void onFiles(event.target.files)}
            />
          </div>
          {messages.map((message) => (
            <Notice key={message.text} tone={message.tone}>
              {message.text}
            </Notice>
          ))}
          {recipe.cards.map((card, index) => (
            <CardRow
              key={card.id}
              card={card}
              recipe={recipe}
              resolution={resolved.perCard[card.id]}
              open={openCard === card.id}
              onToggle={() => setOpenCard(openCard === card.id ? null : card.id)}
              onChange={(patch) => updateCard(card.id, patch)}
              onRemove={() => removeCard(card.id)}
              onMove={(direction) => moveCard(index, direction)}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-card p-4">
            <p className="text-sm font-medium">역할 추가</p>
            {CARD_TEMPLATES.map((template) => (
              <Button key={template.tag} variant="outline" size="sm" onClick={() => addCard(template.tag)}>
                <Plus aria-hidden />
                {template.displayName}
              </Button>
            ))}
          </div>

          {recipe.cards.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">필요한 플랜</span>
                <PlanBadges required={required} showDate />
              </div>
              <RecipeRunSummary resolution={resolved} onSwitchStyle={setStyle} />
              <p className="text-xs text-muted-foreground">
                {PLAN_FIT_NOTE}{' '}
                <a className="underline" href="#/plans">
                  내 AI 현황 바꾸기
                </a>
              </p>
              {optimized.changes.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="size-4 text-sky-700" aria-hidden />
                    구독 최적화 제안 — {optimized.summary}
                  </p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {optimized.changes.map((change) => (
                      <li key={change.cardId}>
                        <strong className="font-medium">{cardName(change.cardId)}</strong>: {engineName(change.from)} →{' '}
                        {engineName(change.to)} <span className="text-muted-foreground">· {change.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <Button size="sm" onClick={() => saveRecipe(applyOptimization(recipe, optimized))}>
                      이대로 다시 배치
                    </Button>
                  </div>
                </div>
              ) : null}
              {style === 'subagents' && needsCodexBridge(recipe) ? (
                <label className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                  <Switch
                    checked={codexBridge}
                    onCheckedChange={setCodexBridge}
                    aria-label="Claude Code에서 Codex 자동 호출"
                  />
                  <span>
                    <span className="font-medium">Claude Code에서 Codex 자동 호출 (실험적)</span>
                    <span className="block text-xs text-muted-foreground">
                      켜고 내보내면 Claude Code 하나만 열어도 Codex 담당 역할이 <code>codex exec</code>로 넘어갑니다.
                      Codex CLI가 설치·로그인돼 있어야 해요.
                    </span>
                  </span>
                </label>
              ) : null}
              {recipeWarnings(recipe).map((warning) => (
                <Notice key={warning.message} tone="warn">
                  {warning.message}
                </Notice>
              ))}
              <details className="rounded-xl border bg-card p-4 text-sm">
                <summary className="cursor-pointer font-medium">역할을 잘 짜는 팁 {TIPS.length}가지</summary>
                <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {TIPS.map((tip) => (
                    <li key={tip.id}>
                      <p className="font-medium">{tip.title}</p>
                      <p className="text-muted-foreground">{tip.body}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'flow' ? (
        <section id="recipe-flow" tabIndex={-1} className="flex flex-col gap-4 focus-visible:outline-none">
          <div>
            <h2 className="text-xl font-bold">누가 누구에게 무엇을 넘기나요?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {FLOW_NOTE}
              {hasCycle(recipe) ? ' 되돌아가는 흐름은 프롬프트에 한 번씩만 적혀요.' : ''}
            </p>
          </div>
          <FlowSection
            recipe={recipe}
            resolution={resolved}
            onConnect={(from, to) =>
              update({ handoffs: [...recipe.handoffs, { id: newId('handoff'), from, to }] })
            }
            onRemove={(handoffId) =>
              update({ handoffs: recipe.handoffs.filter((handoff) => handoff.id !== handoffId) })
            }
            onSelect={(handoffId) =>
              gotoIssue({
                level: 'info',
                code: 'ORDER_PROMPT_ONLY',
                message: '',
                target: { kind: 'handoff', id: handoffId, field: 'handoff' },
              })
            }
          />
          <HandoffEditor recipe={recipe} onChange={(handoffs) => update({ handoffs })} />

          {recipe.cards.length > 0 ? (
            <div className="mt-2 flex flex-col gap-2">
              <h2 className="text-xl font-bold">이렇게 시작해요</h2>
              <RunPromptBox recipe={recipe} />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {next ? '칸을 다 채우지 않아도 다음으로 넘어갈 수 있어요.' : '다 됐으면 내보내기 준비를 눌러 파일을 받아 보세요.'}
        </p>
        {next ? (
          <Button variant="outline" onClick={() => setStep(next.id)}>
            다음: {next.label}
          </Button>
        ) : (
          <ExportPrepButton recipe={recipe} plans={plans} codexBridge={codexBridge} onGoto={gotoIssue} />
        )}
      </div>
    </div>
  );
}
