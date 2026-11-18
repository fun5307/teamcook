// 팀 제안: 작업 구성을 보고 역할을 묶어 제안한다. 작업 수와 역할 수는 따로다.
// - 같은 유형의 작업은 한 역할이 맡는다. 만드는 일과 검토하는 일은 독립 검토를 위해 다른 역할로 나눈다.
// - 작업이 하나뿐이면 한 역할로 충분하다고 제안한다. 팀원 수를 품질처럼 말하지 않는다.
// - 역할의 지시문 틀은 기존 레시피 책의 같은 유형 카드에서 가져온다 (없는 역할을 지어내지 않는다).
// - 도구는 '내 AI 현황'으로 고른다. 설치·로그인은 확인하지 않았다고 알린다.

import { builtinRecipes } from '../../data/recipes';
import { ROLE_LABELS } from '../roles';
import { newId } from '../id';
import type { AgentCard, Collaboration, EngineId, Permission, RoleTag, UserPlans } from '../../types';
import type { Assignment, OrderDraft, OrderRole, Recommendation, WorkItem } from './types';

const ROLE_NAMES: Record<RoleTag, string> = {
  researcher: 'researcher',
  planner: 'planner',
  implementer: 'implementer',
  writer: 'writer',
  reviewer: 'reviewer',
  synthesizer: 'synthesizer',
};

const PERMISSIONS: Record<RoleTag, Permission> = {
  researcher: 'read-only',
  planner: 'read-only',
  reviewer: 'read-only',
  synthesizer: 'read-only',
  implementer: 'edit',
  writer: 'edit',
};

/** 레시피 책에서 이 유형의 카드 하나 (지시문 틀) */
export function templateCard(tag: RoleTag): { recipeId: string; card: AgentCard } | null {
  for (const recipe of builtinRecipes) {
    const card = recipe.cards.find((item) => (item.tags ?? [])[0] === tag);
    if (card) return { recipeId: recipe.id, card };
  }
  return null;
}

const paidAnthropic = (plans: UserPlans) => ['pro', 'max', 'ultra'].includes(plans.anthropic) || plans.apiKeys.anthropic === true;
const anyOpenai = (plans: UserPlans) => plans.openai !== 'none' || plans.apiKeys.openai === true;

/** 역할 유형과 내 AI 현황으로 도구를 고른다 */
export function engineFor(tag: RoleTag, plans: UserPlans): EngineId {
  const claude = paidAnthropic(plans);
  const codex = anyOpenai(plans);
  if (claude && codex) return tag === 'reviewer' ? 'codex-cli' : 'claude-code';
  if (claude) return 'claude-code';
  if (codex) return 'codex-cli';
  return 'claude-code';
}

export interface TeamProposal {
  roles: OrderRole[];
  assignments: Assignment[];
  style: Collaboration;
  recommendation: Recommendation;
}

const activeWork = (order: OrderDraft) => order.work.filter((item) => item.state !== 'excluded');

/** 작업 유형을 역할 유형으로. 정리는 작성 담당이, 작성 담당이 없으면 기획 담당이 맡는다. */
function roleTagOf(item: WorkItem, present: Set<RoleTag>): RoleTag {
  if (item.type === 'synthesizer') return present.has('writer') ? 'writer' : 'planner';
  return item.type;
}

export function proposeTeam(order: OrderDraft, plans: UserPlans, workspaceNames: string[] = []): TeamProposal {
  const work = activeWork(order);
  const reasons: string[] = [];
  const types = new Set(work.map((item) => item.type));
  // 결정이 중심이고 만들거나 조사할 일이 없으면 토론형이 가장 가볍다
  const decideOnly = order.detected.includes('decide') && !order.detected.some((type) => ['build', 'fix', 'write', 'research'].includes(type));

  if (work.length <= 1) {
    const tag: RoleTag = work[0]?.type ?? 'implementer';
    const role = makeRole(tag, plans, workspaceNames);
    reasons.push(work.length === 0 ? '아직 작업이 없어요. 작업을 더한 뒤 다시 제안받으세요.' : '작업이 하나라 한 역할로 충분해요.');
    return {
      roles: work.length === 0 ? [] : [role],
      assignments: work.map((item) => ({ workId: item.id, roleId: role.id, responsibility: 'owner' })),
      style: 'subagents',
      recommendation: { pattern: '한 역할', reasons, state: 'proposed' },
    };
  }

  const roles = new Map<RoleTag, OrderRole>();
  const assignments: Assignment[] = [];
  for (const item of work) {
    const tag = roleTagOf(item, types);
    if (!roles.has(tag)) roles.set(tag, makeRole(tag, plans, workspaceNames));
    assignments.push({ workId: item.id, roleId: roles.get(tag)!.id, responsibility: 'owner' });
  }
  const makers = work.filter((item) => item.type === 'implementer' || item.type === 'writer');
  const reviewer = roles.get('reviewer');
  if (reviewer && makers.length > 0) {
    reasons.push('만든 쪽이 스스로 검토하지 않도록 검토 담당을 따로 뒀어요 (독립 검토).');
    for (const item of makers) assignments.push({ workId: item.id, roleId: reviewer.id, responsibility: 'reviewer' });
  }
  const shared = [...roles.values()].filter((role) => assignments.filter((item) => item.roleId === role.id && item.responsibility === 'owner').length > 1);
  for (const role of shared) {
    reasons.push(`${role.displayName}이(가) 같은 성격의 작업 여러 개를 맡아요. 작업마다 새 역할을 만들지 않았어요.`);
  }
  const deps = order.deps.filter((dep) => {
    const from = assignments.find((item) => item.workId === dep.from && item.responsibility === 'owner')?.roleId;
    const to = assignments.find((item) => item.workId === dep.to && item.responsibility === 'owner')?.roleId;
    return from && to && from !== to;
  });
  if (deps.length > 0) reasons.push(`역할 사이에 넘겨줄 결과가 ${deps.length}건 있어요. 시작 프롬프트에 순서대로 적어요.`);
  const allRoles = [...roles.values()];
  if (allRoles.some((role) => role.engine === 'codex-cli') && allRoles.some((role) => role.engine === 'claude-code')) {
    reasons.push('Claude와 ChatGPT를 둘 다 쓰실 수 있어서, 검토는 다른 회사 모델이 맡게 했어요 (교차 검토).');
  }
  if (workspaceNames.length > 0 && allRoles.some((role) => role.fromWorkspace)) {
    reasons.push('열어 둔 프로젝트 폴더에 같은 유형의 팀원이 있어서 그 이름을 그대로 썼어요.');
  }
  reasons.push('도구는 "내 AI 현황"으로 골랐어요. 이 컴퓨터에 설치·로그인돼 있는지는 확인하지 않았어요.');
  const style: Collaboration = decideOnly ? 'debate' : 'subagents';
  if (decideOnly) reasons.push('결정 작업만 있어서, 한 AI가 여러 역할을 번갈아 맡는 토론형을 제안해요.');
  return {
    roles: allRoles,
    assignments,
    style,
    recommendation: {
      pattern: reviewer && makers.length > 0 ? '만들기와 검토 분리' : '유형별 역할',
      ...(templateCard(allRoles[0]?.tag ?? 'implementer') ? { recipeId: templateCard(allRoles[0].tag)!.recipeId } : {}),
      reasons,
      state: 'proposed',
    },
  };
}

export function makeRole(tag: RoleTag, plans: UserPlans, workspaceNames: string[] = []): OrderRole {
  const template = templateCard(tag);
  const fromWorkspace = workspaceNames.find((name) => name === ROLE_NAMES[tag] || name.includes(ROLE_NAMES[tag].slice(0, 5)));
  const role: OrderRole = {
    id: newId('role'),
    name: fromWorkspace ?? ROLE_NAMES[tag],
    displayName: template?.card.displayName && template.card.tags?.[0] === tag ? ROLE_LABELS[tag] : ROLE_LABELS[tag],
    tag,
    engine: engineFor(tag, plans),
    permission: PERMISSIONS[tag],
  };
  if (template) role.template = { recipeId: template.recipeId, cardId: template.card.id };
  if (fromWorkspace) role.fromWorkspace = true;
  return role;
}

export interface Coverage {
  /** 맡은 사람이 없는 작업 */
  unassigned: WorkItem[];
  /** 맡은 사람(owner)이 둘 이상인 작업 (책임이 겹침) */
  shared: WorkItem[];
  /** 아무 작업도 맡지 않은 역할 */
  idle: OrderRole[];
}

export function coverage(order: OrderDraft): Coverage {
  const work = activeWork(order);
  const owners = (id: string) => order.assignments.filter((item) => item.workId === id && item.responsibility === 'owner');
  return {
    unassigned: work.filter((item) => owners(item.id).length === 0),
    shared: work.filter((item) => owners(item.id).length > 1),
    idle: order.roles.filter((role) => !order.assignments.some((item) => item.roleId === role.id)),
  };
}

export function ownerOf(order: OrderDraft, workId: string): OrderRole | undefined {
  const roleId = order.assignments.find((item) => item.workId === workId && item.responsibility === 'owner')?.roleId;
  return order.roles.find((role) => role.id === roleId);
}
