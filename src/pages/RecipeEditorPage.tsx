// 레시피 편집기: 제목·요약 + 카드 목록 + 카드 편집 폼 + 넘겨주기 흐름.
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
import { ExportZipButton, ShareButton, cloneRecipe } from '@/components/RecipeActions';
import { RunPromptBox, roleLabel } from '@/components/RecipeOverview';
import {
  CardRoute,
  LockBadge,
  PathBadge,
  PlanBadges,
  RecipeRunSummary,
  VerifiedBadge,
  engineName,
} from '@/components/RouteInfo';
import { COLLABORATIONS, COLLABORATION_IDS, collaborationOf, today } from '@/data/collaboration';
import { CARD_TEMPLATES, cardFromTemplate } from '@/data/cardTemplates';
import { providerData } from '@/data/providers';
import { TIPS, cardWarnings, recipeWarnings } from '@/data/tips';
import { needsCodexBridge } from '@/lib/bridge';
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

function CardEditor({
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
        label="역할 설명 (언제 이 에이전트에게 맡길지)"
        htmlFor={`${key}-role`}
        hint='AI는 이 설명을 보고 일을 맡길지 정해요. "코드 검토"보다 "변경된 파일의 보안·버그를 검토할 때 사용"이 낫습니다.'
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
          rows={8}
          value={card.instructions}
          onChange={(event) => onChange({ instructions: event.target.value })}
        />
      </Field>

      {showTools ? (
        <Field
          label="Claude 도구 목록 (선택, 고급)"
          htmlFor={`${key}-tools`}
          hint="쉼표로 구분. 비우면 권한에 맞는 기본 목록을 써요 (읽기 전용: Read, Grep, Glob / 편집: + Edit, Write, Bash)."
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
    onChange(handoffs.map((handoff) => (handoff.id === id ? { ...handoff, ...patch } : handoff)));

  if (cards.length < 2) {
    return <p className="text-sm text-muted-foreground">카드가 2장 이상이면 흐름을 정할 수 있어요.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {handoffs.map((handoff, index) => (
        <div key={handoff.id} className="flex flex-wrap items-center gap-2">
          <span className="w-5 text-right text-xs text-muted-foreground">{index + 1}.</span>
          <NativeSelect
            className="w-auto min-w-32 flex-1 sm:flex-none"
            aria-label="넘겨주는 에이전트"
            value={handoff.from}
            onChange={(event) => update(handoff.id, { from: event.target.value })}
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
            aria-label="넘겨받는 에이전트"
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
            aria-label="무엇을 넘기는지"
            placeholder="무엇을 넘기나요? 예: 초안 전달"
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
      ))}
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

export function RecipeEditorPage({ id }: { id: string }) {
  const recipe = useStore((state) => state.recipes.find((item) => item.id === id));
  const plans = useStore((state) => state.plans);
  const saveRecipe = useStore((state) => state.saveRecipe);
  const removeRecipe = useStore((state) => state.removeRecipe);

  const [openCard, setOpenCard] = useState<string | null>(null);
  const [codexBridge, setCodexBridge] = useState(false);
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
            <a href="#/">갤러리로 돌아가기</a>
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
        for (const field of ['model', 'tools', 'tags'] as const) {
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
      next.push({ tone: 'success', text: `에이전트 카드 ${added.length}장을 불러왔어요.` });
    }
    setMessages(next);
    if (fileInput.current) fileInput.current.value = '';
  };

  const onDelete = () => {
    if (window.confirm(`"${recipe.title}" 레시피를 삭제할까요? 되돌릴 수 없어요.`)) {
      removeRecipe(recipe.id);
      navigate('/');
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
  const setVerified = (date: string) => {
    const { lastVerified: _old, ...rest } = recipe;
    saveRecipe(date ? { ...rest, lastVerified: date } : rest);
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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="레시피 편집"
        description="고치는 즉시 이 브라우저에 자동 저장돼요."
        actions={
          <>
            <ShareButton recipe={recipe} />
            <ExportZipButton recipe={recipe} plans={plans} codexBridge={codexBridge} />
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

      <section className="flex flex-col gap-4 border-2 bg-card p-5">
        <Field label="레시피 제목" htmlFor="recipe-title">
          <Input
            id="recipe-title"
            className="h-10 text-lg font-semibold"
            value={recipe.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder="예: Claude 작성 + Codex 교차 검토"
          />
        </Field>
        <Field label="무엇을 하는 레시피인가요? (한두 줄)" htmlFor="recipe-summary">
          <Textarea
            id="recipe-summary"
            rows={2}
            value={recipe.summary}
            onChange={(event) => update({ summary: event.target.value })}
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
          <Field label="만든 사람 (닉네임, 선택)" htmlFor="recipe-author">
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
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">조리법 — 이 팀은 어떤 방식으로 함께 일하나요?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {COLLABORATION_IDS.map((id) => {
              const info = COLLABORATIONS[id];
              const selected = style === id;
              return (
                <label
                  key={id}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 border bg-card p-3 text-sm transition-colors',
                    selected ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-muted/50',
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
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-xs font-normal text-violet-800">
                        <FlaskConical className="size-3" aria-hidden />
                        실험 기능
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{info.description}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    쓸 수 있는 곳: {info.availability}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field
          label="실제로 돌아가는지 확인한 날 (선택)"
          htmlFor="recipe-verified"
          hint="직접 돌려 보고 잘 되는 것을 확인한 날짜를 적어 주세요. 레시피에 '날짜 확인' 표시로 보여요. 도구가 자주 바뀌니, 다시 확인하면 날짜도 바꿔 주세요."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="recipe-verified"
              type="date"
              className="w-auto"
              value={recipe.lastVerified ?? ''}
              max={today()}
              onChange={(event) => setVerified(event.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => setVerified(today())}>
              오늘 확인했어요
            </Button>
            {recipe.lastVerified ? (
              <>
                <VerifiedBadge date={recipe.lastVerified} />
                <Button size="sm" variant="ghost" onClick={() => setVerified('')}>
                  지우기
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">아직 확인 날짜가 없어요.</span>
            )}
          </div>
        </Field>
        <Field
          label="실행 팁 (선택)"
          htmlFor="recipe-howto"
          hint="이 팀을 어떻게 시작하면 좋은지 적어 두면, 공유받은 사람과 RECIPE.md에 그대로 보여요."
        >
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
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">이 레시피에 필요한 플랜</span>
          <PlanBadges required={required} showDate />
          {required.details.length === 0 ? (
            <span className="text-sm text-muted-foreground">카드를 추가하면 계산돼요.</span>
          ) : null}
        </div>
        <RecipeRunSummary resolution={resolved} onSwitchStyle={setStyle} />
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
          <label className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
            <Switch
              checked={codexBridge}
              onCheckedChange={setCodexBridge}
              aria-label="Claude Code에서 Codex 자동 호출"
            />
            <span>
              <span className="font-medium">내보낼 때 'Claude Code에서 Codex 자동 호출' 넣기 (실험적)</span>
              <span className="block text-xs text-muted-foreground">
                켜면 Codex 담당 카드의 Claude Code용 파일이, 직접 일하는 대신 <code>codex exec</code> 명령으로
                Codex에게 일을 넘깁니다. Claude Code 하나만 열어 두어도 두 회사 모델이 함께 일해요. Codex CLI가
                설치·로그인돼 있어야 하고, 부를 때마다 Codex 사용량이 듭니다.
              </span>
            </span>
          </label>
        ) : null}
        {recipeWarnings(recipe).map((warning) => (
          <Notice key={warning.message} tone="warn">
            {warning.message}
          </Notice>
        ))}
        <p className="text-xs text-muted-foreground">
          실행 경로는 <a className="underline" href="#/plans">내 AI 현황</a>에 따라 바뀌어요.
        </p>
      </section>

      <section
        className="flex flex-col gap-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="label-rule text-xl font-bold">에이전트 카드</h2>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <FolderOpen aria-hidden />
            .toml · .md 파일 불러오기
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
        <div className="flex flex-col gap-2 border-2 border-dashed bg-card p-4">
          <p className="text-sm font-medium">카드 추가 — 어떤 역할인가요?</p>
          <div className="flex flex-wrap gap-2">
            {CARD_TEMPLATES.map((template) => (
              <Button key={template.tag} variant="outline" size="sm" onClick={() => addCard(template.tag)}>
                <Plus aria-hidden />
                {template.displayName}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-rule text-xl font-bold">흐름 — 누가 누구에게 무엇을 넘기나</h2>
        <p className="text-sm text-muted-foreground">
          {style === 'debate'
            ? '토론형에서는 흐름이 발언 순서가 돼요. 아래 토론 프롬프트에 바로 반영됩니다.'
            : "흐름은 설정 파일에는 담기지 않아요. 대신 아래 '첫 프롬프트'로 만들어져서, 실행할 때 AI에게 순서를 알려 줍니다. (RECIPE.md에도 들어가요.)"}
        </p>
        <FlowSection
          recipe={recipe}
          resolution={resolved}
          onConnect={(from, to) =>
            update({ handoffs: [...recipe.handoffs, { id: newId('handoff'), from, to }] })
          }
          onRemove={(handoffId) =>
            update({ handoffs: recipe.handoffs.filter((handoff) => handoff.id !== handoffId) })
          }
        />
        <HandoffEditor recipe={recipe} onChange={(handoffs) => update({ handoffs })} />
      </section>

      {recipe.cards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="label-rule text-xl font-bold">이렇게 시작해요</h2>
          <RunPromptBox recipe={recipe} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="label-rule text-xl font-bold">꿀팁</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TIPS.map((tip) => (
            <li key={tip.id} className="border bg-card p-3 text-sm">
              <p className="font-medium">{tip.title}</p>
              <p className="mt-1 text-muted-foreground">{tip.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
