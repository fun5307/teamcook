// 화면 D — 팀 제안: 작업마다 맡을 역할을 정한다. 한 역할이 여러 작업을 맡을 수 있고, 작업 수와 역할 수는 따로다.
// 범위 선택(빠른 탐색·근거 확인·여러 안 비교)은 더해지고 빠질 작업을 먼저 보여 주고, 확인한 뒤에만 반영한다.

import { useState } from 'react';
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, Notice } from '@/components/common';
import { engineName } from '@/components/RouteInfo';
import { COLLABORATIONS, COLLABORATION_IDS } from '@/data/collaboration';
import { applyScope, SCOPE_LABELS, scopePreview, type ScopePreview } from '@/lib/order/ops';
import { coverage, makeRole, proposeTeam, type TeamProposal } from '@/lib/order/team';
import type { Assignment, OrderRole, WorkScope } from '@/lib/order/types';
import { PERMISSION_LABELS } from '@/lib/recipeMd';
import { ROLE_LABELS } from '@/lib/roles';
import { useStore } from '@/store/useStore';
import { useWorkspace } from '@/store/useWorkspace';
import type { EngineId, Permission, RoleTag } from '@/types';
import type { StepProps } from '@/pages/order/OrderPage';

const ENGINES: EngineId[] = ['claude-code', 'codex-cli', 'antigravity-cli', 'grok-build'];

export function TeamStep({ order, save, go }: StepProps) {
  const plans = useStore((state) => state.plans);
  const snapshot = useWorkspace((state) => state.snapshot);
  const [scopeDraft, setScopeDraft] = useState<{ scope: WorkScope; preview: ScopePreview } | null>(null);
  const [proposal, setProposal] = useState<TeamProposal | null>(null);
  const [newTag, setNewTag] = useState<RoleTag>('reviewer');
  const work = order.work.filter((item) => item.state !== 'excluded');
  const cover = coverage(order);
  const workspaceNames = snapshot?.members.map((member) => member.card.name) ?? [];

  const ownerOf = (workId: string) => order.assignments.find((item) => item.workId === workId && item.responsibility === 'owner')?.roleId ?? '';
  const reviewerOf = (workId: string) => order.assignments.find((item) => item.workId === workId && item.responsibility === 'reviewer')?.roleId ?? '';
  const assign = (workId: string, responsibility: Assignment['responsibility'], roleId: string) => {
    const rest = order.assignments.filter((item) => !(item.workId === workId && item.responsibility === responsibility));
    save({ ...order, assignments: roleId ? [...rest, { workId, roleId, responsibility }] : rest });
  };
  const updateRole = (id: string, patch: Partial<OrderRole>) => save({ ...order, roles: order.roles.map((role) => (role.id === id ? { ...role, ...patch } : role)) });
  const removeRole = (id: string) => save({ ...order, roles: order.roles.filter((role) => role.id !== id), assignments: order.assignments.filter((item) => item.roleId !== id) });
  const owned = (roleId: string) => order.assignments.filter((item) => item.roleId === roleId && item.responsibility === 'owner').length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="작업 범위">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-heading text-lg font-extrabold">작업 범위</h3>
          <span className="text-xs text-muted-foreground">고르면 바뀔 작업을 먼저 보여 드려요. 필수 조건과 검토 요구는 지우지 않아요.</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(SCOPE_LABELS) as WorkScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              aria-pressed={order.scope === scope}
              onClick={() => setScopeDraft({ scope, preview: scopePreview(order, scope) })}
              className={cn('flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors', order.scope === scope ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}
            >
              <span className="font-medium">{SCOPE_LABELS[scope].label}</span>
              <span className={cn('text-xs', order.scope === scope ? 'text-background/75' : 'text-muted-foreground')}>{SCOPE_LABELS[scope].hint}</span>
            </button>
          ))}
        </div>
        {scopeDraft ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm" role="dialog" aria-label="범위 바꾸기 확인">
            <p className="font-medium">"{SCOPE_LABELS[scopeDraft.scope].label}"로 바꾸면</p>
            <ul className="list-disc pl-5">
              {scopeDraft.preview.add.map((item) => (
                <li key={item.id}>더해요: {item.title} (제안으로 더하니 작업 설계에서 확정해 주세요)</li>
              ))}
              {scopeDraft.preview.remove.map((item) => (
                <li key={item.id}>빼요: {item.title}</li>
              ))}
              {scopeDraft.preview.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              {scopeDraft.preview.add.length + scopeDraft.preview.remove.length + scopeDraft.preview.notes.length === 0 ? <li>바뀌는 작업이 없어요.</li> : null}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { save(applyScope(order, scopeDraft.scope, scopeDraft.preview)); setScopeDraft(null); }}>
                반영하기
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setScopeDraft(null)}>
                취소
              </Button>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">걸리는 시간이나 금액은 근거 없이 계산하지 않아요.</p>
      </section>

      <section className="flex flex-col gap-3" aria-label="팀 제안">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setProposal(proposeTeam(order, plans, workspaceNames))} disabled={work.length === 0}>
            <Sparkles aria-hidden />
            작업에 맞는 팀 제안 받기
          </Button>
          {snapshot ? <span className="text-xs text-muted-foreground">열어 둔 "{snapshot.folderName}" 폴더의 팀원 이름도 함께 살펴요.</span> : null}
        </div>
        {proposal ? (
          <div className="flex flex-col gap-2 rounded-xl border-2 border-foreground bg-card p-4 text-sm">
            <p className="font-heading text-lg font-extrabold">제안: {proposal.recommendation.pattern}</p>
            <p>
              역할 {proposal.roles.length}개 · {COLLABORATIONS[proposal.style].label}:{' '}
              {proposal.roles.map((role) => `${role.displayName}(${engineName(role.engine)})`).join(', ')}
            </p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {proposal.recommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {order.roles.length > 0 ? <p className="text-amber-800">이대로 쓰면 지금 정한 역할과 배정을 이 제안으로 바꿔요.</p> : null}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { save({ ...order, roles: proposal.roles, assignments: proposal.assignments, style: proposal.style, recommendation: { ...proposal.recommendation, state: 'accepted' } }); setProposal(null); }}>
                <Check aria-hidden />
                이대로 쓰기
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                닫기
              </Button>
            </div>
          </div>
        ) : order.recommendation?.state === 'accepted' ? (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">쓰고 있는 제안: {order.recommendation.pattern}</summary>
            <ul className="mt-1 list-disc pl-5">
              {order.recommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="flex flex-col gap-2" aria-label="역할">
        <h3 className="font-heading text-lg font-extrabold">역할 {order.roles.length}개</h3>
        {order.roles.length === 0 ? <p className="text-sm text-muted-foreground">아직 역할이 없어요. 제안을 받거나 직접 더해 주세요.</p> : null}
        <ul className="flex flex-col gap-2">
          {order.roles.map((role) => (
            <li key={role.id} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-center">
              <Input aria-label="역할 이름" value={role.displayName} onChange={(event) => updateRole(role.id, { displayName: event.target.value })} />
              <Input aria-label="에이전트 이름" className="font-mono text-sm" value={role.name} onChange={(event) => updateRole(role.id, { name: event.target.value.trim() })} />
              <NativeSelect aria-label="도구" className="w-auto" value={role.engine} onChange={(event) => updateRole(role.id, { engine: event.target.value as EngineId })}>
                {ENGINES.map((engine) => (
                  <option key={engine} value={engine}>
                    {engineName(engine)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="권한" className="w-auto" value={role.permission} onChange={(event) => updateRole(role.id, { permission: event.target.value as Permission })}>
                {(['read-only', 'edit', 'full'] as Permission[]).map((permission) => (
                  <option key={permission} value={permission}>
                    {PERMISSION_LABELS[permission]}
                  </option>
                ))}
              </NativeSelect>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">맡은 작업 {owned(role.id)}</span>
                <Button size="icon-sm" variant="ghost" aria-label={`${role.displayName} 빼기`} onClick={() => removeRole(role.id)}>
                  <Trash2 />
                </Button>
              </span>
              {role.fromWorkspace ? <span className="text-xs text-emerald-800 sm:col-span-5">내 팀의 "{role.name}"과 같은 이름이에요. 들일 때 기존 파일은 덮어쓰지 않아요.</span> : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="더할 역할 유형" className="w-auto" value={newTag} onChange={(event) => setNewTag(event.target.value as RoleTag)}>
            {(Object.keys(ROLE_LABELS) as RoleTag[]).map((tag) => (
              <option key={tag} value={tag}>
                {ROLE_LABELS[tag]}
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" variant="outline" onClick={() => {
            const role = makeRole(newTag, plans, workspaceNames);
            let name = role.name;
            for (let n = 2; order.roles.some((item) => item.name === name); n += 1) name = `${role.name}_${n}`;
            save({ ...order, roles: [...order.roles, { ...role, name }] });
          }}>
            <Plus aria-hidden />
            역할 더하기
          </Button>
          <span className="text-xs text-muted-foreground">도구는 "내 AI 현황" 기준이에요. 설치·로그인은 확인하지 않았어요.</span>
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label="작업과 담당">
        <h3 className="font-heading text-lg font-extrabold">작업과 담당</h3>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">작업</th>
                <th className="px-3 py-2 font-medium">맡을 역할</th>
                <th className="px-3 py-2 font-medium">검토할 역할 (선택)</th>
              </tr>
            </thead>
            <tbody>
              {work.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <th className="px-3 py-2 font-medium">
                    {item.title}
                    {item.state === 'proposed' ? <span className="ml-1 text-xs font-normal text-muted-foreground">(제안)</span> : null}
                  </th>
                  <td className="px-3 py-2">
                    <NativeSelect aria-label={`${item.title} 맡을 역할`} value={ownerOf(item.id)} onChange={(event) => assign(item.id, 'owner', event.target.value)}>
                      <option value="">정하지 않음</option>
                      {order.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.displayName}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="px-3 py-2">
                    <NativeSelect aria-label={`${item.title} 검토할 역할`} value={reviewerOf(item.id)} onChange={(event) => assign(item.id, 'reviewer', event.target.value)}>
                      <option value="">없음</option>
                      {order.roles.filter((role) => role.id !== ownerOf(item.id)).map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.displayName}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cover.unassigned.length > 0 ? <Notice tone="warn">맡은 역할이 없는 작업: {cover.unassigned.map((item) => item.title).join(', ')}</Notice> : null}
        {cover.idle.length > 0 ? <p className="text-sm text-muted-foreground">아무 작업도 맡지 않은 역할: {cover.idle.map((role) => role.displayName).join(', ')} (레시피에 들어가지 않아요)</p> : null}
      </section>

      <section className="flex flex-col gap-2" aria-label="협업 방식">
        <h3 className="font-heading text-lg font-extrabold">함께 일하는 방식</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {COLLABORATION_IDS.map((style) => (
            <label key={style} className={cn('flex cursor-pointer flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 text-sm', order.style === style && 'border-foreground')}>
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="order-style" checked={order.style === style} onChange={() => save({ ...order, style })} />
                {COLLABORATIONS[style].label}
              </span>
              <span className="text-xs text-muted-foreground">{COLLABORATIONS[style].availability}</span>
            </label>
          ))}
        </div>
        {order.style === 'debate' ? <p className="text-xs text-muted-foreground">토론형은 한 AI가 여러 역할을 번갈아 맡아요. 각 역할이 따로 일하지 않아요.</p> : null}
      </section>

      <div>
        <Button onClick={() => go('ready')}>다음: 실행 준비</Button>
      </div>
    </div>
  );
}
