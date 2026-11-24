// '내 팀' (#/team): 내 프로젝트 폴더에 실제로 있는 팀을 보고, 고치고, 그 파일에 바로 저장한다.
// 숨김 폴더(.codex/agents, .claude/agents) 속 역할 파일을 팀원 카드로 꺼내 보여 주는 것이 이 서비스의 중심이다.
// 이 화면은 아무것도 실행하지 않는다. 읽고 쓰는 것은 사용자가 고른 폴더 안의 역할 파일뿐이다.

import { useEffect, useState } from 'react';
import { FolderOpen, Plus, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NativeSelect, Notice } from '@/components/common';
import { SectionTabs } from '@/components/practice/PracticeParts';
import { CARD_TEMPLATES, cardFromTemplate } from '@/data/cardTemplates';
import { providerData } from '@/data/providers';
import { builtinRecipes } from '@/data/recipes';
import { newId } from '@/lib/id';
import { PERMISSION_LABELS } from '@/lib/recipeMd';
import { ROLE_LABELS } from '@/lib/roles';
import { applyChanges, planHire, TEAM_DIRS, type FileChange, type HirePlan, type Member } from '@/lib/workspace/team';
import { CardEditor } from '@/pages/RecipeEditorPage';
import { JournalTab } from '@/pages/team/JournalTab';
import { LocalProjects } from '@/pages/team/LocalProjects';
import { StartGuide } from '@/pages/team/StartGuide';
import { isLocal, localInfo, subscribeLocal } from '@/lib/local/client';
import { useStore } from '@/store/useStore';
import { folderAccessSupported, openProject, recalledName, reopenProject, useWorkspace } from '@/store/useWorkspace';
import type { AgentCard, Recipe, RoleTag } from '@/types';

type Tab = 'members' | 'journal';

const KIND_LABELS: Record<FileChange['kind'], string> = { create: '새로 만듦', update: '고침', delete: '지움' };

/** 폴더를 열기 전 화면 (첫 화면에서도 쓴다) */
export function OpenProjectPanel({ compact = false }: { compact?: boolean }) {
  const busy = useWorkspace((state) => state.busy);
  const error = useWorkspace((state) => state.error);
  const [last, setLast] = useState<string | null>(null);
  const [failed, setFailed] = useState('');
  const supported = folderAccessSupported();
  useEffect(() => {
    void recalledName('project').then(setLast);
  }, []);

  const go = async (action: () => Promise<boolean>) => {
    setFailed('');
    if (await action()) window.location.hash = '/team';
    else if (!useWorkspace.getState().error) setFailed('');
  };

  if (isLocal()) {
    return (
      <div className="flex flex-col gap-3">
        <LocalProjects compact={compact} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {supported ? (
        <>
          <Button size="lg" className="h-12 text-base" disabled={busy} onClick={() => void go(openProject)}>
            <FolderOpen aria-hidden />내 프로젝트 폴더 열기
          </Button>
          {last ? (
            <Button variant="outline" disabled={busy} onClick={() => void go(reopenProject)}>
              지난번 폴더 다시 열기: {last}
            </Button>
          ) : null}
        </>
      ) : (
        <Notice tone="warn">
          이 브라우저는 폴더 열기를 지원하지 않아요. Chrome이나 Edge에서 열어 주세요. 다른 브라우저에서는{' '}
          <a className="underline" href="#/recipes">
            레시피 책
          </a>
          에서 zip으로 받아 쓸 수 있어요.
        </Notice>
      )}
      {error || failed ? <Notice tone="error">{error || failed}</Notice> : null}
      {!compact ? (
        <ul className="list-disc pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            폴더 안의 <code>.codex/agents</code>와 <code>.claude/agents</code>를 읽어 팀원 카드로 보여 줘요.
          </li>
          <li>고친 내용은 "파일에 저장"을 눌렀을 때만, 고친 팀원의 파일에만 써요.</li>
          <li>파일은 내 컴퓨터 안에서만 읽고 써요. 어디로도 올라가지 않아요.</li>
        </ul>
      ) : null}
    </div>
  );
}

function ChangeList({ changes }: { changes: FileChange[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {changes.map((change) => (
        <li key={`${change.kind}-${change.path}`} className="rounded-lg border bg-card">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs font-medium',
                  change.kind === 'delete' ? 'bg-rose-100 text-rose-900' : change.kind === 'create' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900',
                )}
              >
                {KIND_LABELS[change.kind]}
              </span>
              <code className="text-xs break-all">{change.path}</code>
              <span className="text-xs text-muted-foreground">{change.who}</span>
            </summary>
            <div className="grid gap-2 border-t p-3 md:grid-cols-2">
              {change.before !== null ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">지금 파일</p>
                  <pre className="max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{change.before}</pre>
                </div>
              ) : null}
              {change.after !== null ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">저장하면</p>
                  <pre className="max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{change.after}</pre>
                </div>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

function MemberRow({
  card,
  member,
  team,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  card: AgentCard;
  member: Member | undefined;
  team: Recipe;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<AgentCard>) => void;
  onRemove: () => void;
}) {
  const changed = member ? JSON.stringify(member.card) !== JSON.stringify(card) : true;
  const tag = (card.tags ?? [])[0] as RoleTag | undefined;
  return (
    <article className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-5', open && 'ring-2 ring-ring/40')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-heading text-2xl font-extrabold">{card.displayName || card.name}</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{card.name}</code>
            {tag && ROLE_LABELS[tag] ? <span className="text-xs text-muted-foreground">{ROLE_LABELS[tag]}</span> : null}
            {!member ? <span className="text-xs font-medium text-emerald-800">새 팀원 (아직 파일 없음)</span> : null}
            {member && changed ? <span className="text-xs font-medium text-amber-800">고친 내용 있음</span> : null}
          </p>
          <p className="text-base text-pretty">{card.role || '맡은 일이 적혀 있지 않아요.'}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{PERMISSION_LABELS[card.permission]}</span>
            {member?.files.map((file) => (
              <span key={file.path}>
                {TEAM_DIRS[file.engine].label} <code className="break-all">{file.path}</code>
              </span>
            ))}
          </p>
          {member?.diverged ? (
            <p className="text-xs font-medium text-amber-800">
              Codex 파일과 Claude Code 파일의 내용이 서로 달라요. 여기 보이는 것은 이 역할이 원래 쓰는 도구의 파일이에요. 고쳐서
              저장하면 둘이 같아져요.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={open ? 'secondary' : 'outline'} onClick={onToggle}>
            {open ? '접기' : '지시 고치기'}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`${card.displayName || card.name} 팀에서 빼기`} onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>
      {!open && card.instructions.trim() ? (
        <p className="line-clamp-2 border-t pt-2 text-sm whitespace-pre-wrap text-muted-foreground">{card.instructions.trim()}</p>
      ) : null}
      {open ? <CardEditor card={card} recipe={team} onChange={onChange} /> : null}
    </article>
  );
}

function HireSection() {
  const root = useWorkspace((state) => state.root);
  const rescan = useWorkspace((state) => state.rescan);
  const myRecipes = useStore((state) => state.recipes);
  const [recipeId, setRecipeId] = useState('');
  const [plan, setPlan] = useState<HirePlan | null>(null);
  const [done, setDone] = useState('');
  // 방금 들인 레시피. 있으면 아래에 "시작하기" 안내를 보여 준다.
  const [hired, setHired] = useState<{ recipe: Recipe; settingsSkipped: boolean } | null>(null);
  const recipes = [...myRecipes, ...builtinRecipes];
  const recipe = recipes.find((item) => item.id === recipeId);
  if (!root) return null;

  const onPick = async (id: string) => {
    setRecipeId(id);
    setDone('');
    setHired(null);
    const picked = recipes.find((item) => item.id === id);
    setPlan(picked ? await planHire(root, picked, providerData) : null);
  };
  const onHire = async () => {
    if (!plan || !recipe) return;
    const result = await applyChanges(root, plan.changes);
    setDone(`파일 ${result.written.length}개를 만들었어요.${result.conflicts.length > 0 ? ` ${result.conflicts.length}개는 그 사이 생겨서 건너뛰었어요.` : ''}`);
    // 하나도 만들지 못했으면(전부 그 사이 생김) 시작 안내는 띄우지 않는다
    setHired(result.written.length > 0 ? { recipe, settingsSkipped: plan.skipped.some((item) => item.path === '.claude/settings.json') } : null);
    setPlan(null);
    setRecipeId('');
    await rescan();
  };

  return (
    <details className="rounded-2xl border bg-card p-5">
      <summary className="cursor-pointer font-heading text-lg font-extrabold">
        레시피로 팀원 들이기 <span className="font-sans text-sm font-normal text-muted-foreground">레시피 책의 팀을 이 폴더에 넣어요</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <NativeSelect aria-label="들일 레시피" value={recipeId} onChange={(event) => void onPick(event.target.value)}>
          <option value="">레시피 고르기</option>
          {recipes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} ({item.cards.length}명)
            </option>
          ))}
        </NativeSelect>
        {plan && recipe ? (
          <>
            {plan.changes.length > 0 ? <ChangeList changes={plan.changes} /> : <p className="text-sm text-muted-foreground">새로 만들 파일이 없어요.</p>}
            {plan.skipped.length > 0 ? (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {plan.skipped.map((item) => (
                  <li key={item.path}>
                    <code>{item.path}</code>: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            <div>
              <Button disabled={plan.changes.length === 0} onClick={() => void onHire()}>
                <UserPlus aria-hidden />이 폴더에 넣기 (파일 {plan.changes.length}개)
              </Button>
            </div>
          </>
        ) : null}
        {done ? <p className="text-sm text-emerald-800" role="status">{done}</p> : null}
        {hired ? <StartGuide recipe={hired.recipe} projectPath={localInfo()?.project?.path ?? null} settingsSkipped={hired.settingsSkipped} /> : null}
      </div>
    </details>
  );
}

/**
 * view를 주면(작업실의 메뉴가 고른 화면) 안쪽 탭을 감춘다. 웹의 맛보기에서는 안쪽 탭으로 오간다.
 */
export function TeamPage({ view }: { view?: Tab } = {}) {
  const root = useWorkspace((state) => state.root);
  const snapshot = useWorkspace((state) => state.snapshot);
  const cards = useWorkspace((state) => state.cards);
  const setCards = useWorkspace((state) => state.setCards);
  const busy = useWorkspace((state) => state.busy);
  const error = useWorkspace((state) => state.error);
  const rescan = useWorkspace((state) => state.rescan);
  const save = useWorkspace((state) => state.save);
  const [tabState, setTab] = useState<Tab>('members');
  const tab = view ?? tabState;
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warn'; text: string } | null>(null);
  const [outside, setOutside] = useState(false);

  // 내 컴퓨터 도우미: 역할 파일이 밖에서(Claude Code·사람) 바뀌면 바로 다시 읽는다.
  // 화면에서 고치던 것이 있으면 덮어쓰지 않고 알리기만 한다.
  useEffect(() => {
    if (!root) return;
    return subscribeLocal((event) => {
      if (event.root !== 'project') return;
      const state = useWorkspace.getState();
      if (state.changes().changes.length === 0) void state.rescan();
      else setOutside(true);
    });
  }, [root]);

  if (!root || !snapshot) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-5 py-8">
        <h1 className="text-4xl font-extrabold">{isLocal() ? '어느 프로젝트를 볼까요?' : '내 팀'}</h1>
        <p className="text-base text-muted-foreground">
          {isLocal()
            ? '고르면 그 프로젝트의 팀원과 업무 일지를 보여 드려요.'
            : '프로젝트 폴더를 열면, 그 안에 숨어 있는 역할 파일을 팀원 카드로 꺼내 보여 드려요.'}
        </p>
        <OpenProjectPanel />
      </div>
    );
  }

  const plan = useWorkspace.getState().changes();
  const byId = new Map(snapshot.members.map((member) => [member.card.id, member]));
  const team: Recipe = {
    schemaVersion: 2,
    id: 'workspace',
    title: snapshot.folderName,
    summary: '',
    useCase: '',
    cards,
    handoffs: [],
    settings: { maxThreads: snapshot.codexMaxThreads ?? 3, maxDepth: 1 },
  };
  const update = (id: string, patch: Partial<AgentCard>) =>
    setCards(cards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  const onAdd = (tag: RoleTag) => {
    const engine = snapshot.hasDir['claude-code'] || !snapshot.hasDir['codex-cli'] ? 'claude-code' : 'codex-cli';
    const card = cardFromTemplate(tag, newId('card'), cards, engine);
    setCards([...cards, card]);
    setOpenId(card.id);
  };
  const onSave = async () => {
    setNotice(null);
    setOutside(false);
    const result = await save();
    if (!result) return;
    setOpenId(null);
    setNotice(
      result.conflicts.length > 0
        ? {
            tone: 'warn',
            text: `${result.written.length > 0 ? `파일 ${result.written.length}개를 저장했어요. ` : ''}${result.conflicts.join(', ')}은(는) 이 화면에서 읽은 뒤에 밖에서 바뀌어 덮어쓰지 않았어요. 고치던 내용 대신 폴더의 최신 내용을 다시 불러왔어요.`,
          }
        : { tone: 'success', text: `파일 ${result.written.length}개를 저장했어요. Claude Code와 Codex를 새로 시작하면 반영돼요.` },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            내 프로젝트 폴더{isLocal() ? <> · <code className="text-xs">{localInfo()?.project?.path}</code></> : null}
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{snapshot.folderName}의 팀</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void rescan()}>
            <RefreshCw aria-hidden />
            폴더 다시 읽기
          </Button>
          <Button variant="ghost" onClick={() => (isLocal() ? useWorkspace.getState().close() : void openProject())}>
            <FolderOpen aria-hidden />
            다른 폴더
          </Button>
        </div>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {outside ? (
        <Notice tone="warn" className="flex flex-wrap items-center justify-between gap-2">
          <span>고치는 동안 폴더의 역할 파일이 밖에서 바뀌었어요. 저장하면 바뀐 파일은 덮어쓰지 않고 건너뛰어요.</span>
          <Button size="sm" variant="outline" onClick={() => { setOutside(false); void rescan(); }}>
            고친 것 버리고 다시 읽기
          </Button>
        </Notice>
      ) : null}

      {view ? null : (
        <SectionTabs
          label="내 팀 보기"
          current={tab}
          onChange={setTab}
          items={[
            { id: 'members', label: '팀원', note: String(cards.length) },
            { id: 'journal', label: '업무 일지', note: '누가 무슨 일을 했나' },
          ]}
        />
      )}

      {tab === 'journal' ? <JournalTab projectName={snapshot.folderName} projectPath={localInfo()?.project?.path} cards={cards} /> : null}

      {tab === 'members' ? (
        <>
          {cards.length === 0 ? (
            <Notice tone="info">
              이 폴더에는 아직 팀원이 없어요 (<code>.codex/agents</code>, <code>.claude/agents</code>에 역할 파일이 없음). 아래에서
              팀원을 더하거나 레시피로 한 번에 들일 수 있어요.
            </Notice>
          ) : null}
          <div className="flex flex-col gap-3">
            {cards.map((card) => (
              <MemberRow
                key={card.id}
                card={card}
                member={byId.get(card.id)}
                team={team}
                open={openId === card.id}
                onToggle={() => setOpenId(openId === card.id ? null : card.id)}
                onChange={(patch) => update(card.id, patch)}
                onRemove={() => setCards(cards.filter((item) => item.id !== card.id))}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">팀원 더하기</span>
            {CARD_TEMPLATES.map((template) => (
              <Button key={template.tag} size="sm" variant="outline" onClick={() => onAdd(template.tag)}>
                <Plus aria-hidden />
                {template.displayName}
              </Button>
            ))}
          </div>

          <HireSection />

          <details className="rounded-2xl border bg-card p-5 text-sm">
            <summary className="cursor-pointer font-heading text-lg font-extrabold">
              이 폴더의 설정 <span className="font-sans text-sm font-normal text-muted-foreground">읽기만 해요</span>
            </summary>
            <dl className="mt-3 flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-x-3">
                <dt className="text-muted-foreground">Codex 동시 실행 수 (.codex/config.toml)</dt>
                <dd>{snapshot.codexMaxThreads ?? '적혀 있지 않음'}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="text-muted-foreground">Claude Code 에이전트 팀 (.claude/settings.json)</dt>
                <dd>{snapshot.agentTeamsEnabled ? '켜져 있음' : '꺼져 있음'}</dd>
              </div>
            </dl>
            {snapshot.unreadable.length > 0 ? (
              <div className="mt-3">
                <p className="font-medium">읽지 못한 역할 파일 (건드리지 않아요)</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {snapshot.unreadable.map((item) => (
                    <li key={item.path}>
                      <code>{item.path}</code>: {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              설정 파일은 이미 있는 내용을 망가뜨리지 않으려고 자동으로 고치지 않아요.
            </p>
          </details>

          {plan.changes.length > 0 || plan.problems.length > 0 ? (
            <section className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border-2 border-foreground bg-background p-4 shadow-lg" aria-label="저장">
              {plan.problems.map((problem) => (
                <p key={problem} className="text-sm font-medium text-rose-800" role="alert">
                  {problem}
                </p>
              ))}
              {plan.changes.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">바뀔 파일 {plan.changes.length}개</p>
                    <div className="flex gap-2">
                      <Button variant="ghost" disabled={busy} onClick={() => void rescan()}>
                        고친 것 버리기
                      </Button>
                      <Button disabled={busy} onClick={() => void onSave()}>
                        <Save aria-hidden />
                        파일에 저장
                      </Button>
                    </div>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground">무엇이 바뀌는지 보기</summary>
                    <div className="mt-2 max-h-72 overflow-y-auto">
                      <ChangeList changes={plan.changes} />
                    </div>
                  </details>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
