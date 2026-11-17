// 내보내기 전 점검. 화면의 점검 목록과 ZIP을 만드는 코드가 모두 이 함수 하나를 쓴다.
// 식별 코드(code)는 화면 문구와 따로 둔다. 문구를 고쳐도 코드는 그대로다.

import { collaborationOf } from '../data/collaboration';
import { AGENT_NAME_PATTERN } from '../data/tips';
import type { AgentCard, Deliverable, Handoff, ProviderData, Recipe } from '../types';
import { effectiveEngine, isInstructionOnly, permissionSupport } from './support';

/**
 * error: 고쳐야 내려받을 수 있다 (만들어질 파일이 깨지는 경우만)
 * warn: 채우면 더 좋다 (내려받기는 된다)
 * info: 알아 둘 점
 *
 * 2026-11-17 사용자 결정: 학습 목표·성공 조건·산출물·완료 기준이 비어 있어도 막지 않는다.
 * 막는 것은 "파일을 만들 수 없거나, 만든 파일이 서로 덮어쓰거나, 도구가 맞지 않는" 경우뿐이다.
 */
export type IssueLevel = 'error' | 'warn' | 'info';

export const ISSUE_LEVEL_LABELS: Record<IssueLevel, string> = {
  error: '고쳐야 해요',
  warn: '채우면 더 좋아요',
  info: '알아 두세요',
};

export type IssueCode =
  | 'NO_CARDS'
  | 'BAD_FILE_NAME'
  | 'DUPLICATE_FILE'
  | 'NO_OBJECTIVE'
  | 'NO_SUCCESS_CRITERIA'
  | 'CARD_NO_TASK'
  | 'CARD_NO_DELIVERABLE'
  | 'CARD_NO_CRITERIA'
  | 'HANDOFF_BROKEN'
  | 'TOOL_STYLE_MISMATCH'
  | 'HANDOFF_EMPTY'
  | 'HANDOFF_STALE_DELIVERABLE'
  | 'PERMISSION_INSTRUCTION_ONLY'
  | 'FLOW_CYCLE'
  | 'ENV_UNCHECKED'
  | 'ORDER_PROMPT_ONLY';

/** 문제가 있는 입력 위치. field는 화면의 입력 칸 이름이다. */
export interface IssueTarget {
  kind: 'recipe' | 'card' | 'handoff';
  /** 카드 id 또는 넘겨주기 id (레시피 전체면 없음) */
  id?: string;
  field: string;
}

export interface ExportIssue {
  level: IssueLevel;
  code: IssueCode;
  message: string;
  target: IssueTarget;
}

/** 점검 결과가 가리키는 입력 칸의 화면 id (편집 화면이 같은 규칙으로 id를 붙인다) */
export function fieldDomId(target: IssueTarget): string {
  if (target.kind === 'recipe') return `recipe-${target.field}`;
  if (target.kind === 'handoff') return `handoff-${target.id}`;
  return `${target.id}-${target.field}`;
}

const cardLabel = (card: AgentCard) => card.displayName || card.name || '이름 없는 역할';

/** 넘겨주기가 가리키는 산출물: 찾은 것과, 지워져서 못 찾은 id */
export function handoffDeliverables(
  recipe: Recipe,
  handoff: Handoff,
): { found: Deliverable[]; missing: string[] } {
  const from = recipe.cards.find((card) => card.id === handoff.from);
  const found: Deliverable[] = [];
  const missing: string[] = [];
  for (const id of handoff.deliverableIds ?? []) {
    const deliverable = from?.deliverables?.find((item) => item.id === id);
    if (deliverable) found.push(deliverable);
    else missing.push(id);
  }
  return { found, missing };
}

/** 전달 정보가 적혀 있는지: 고른 산출물이나 직접 쓴 설명 중 하나라도 있으면 된다 */
export function hasHandoffInfo(recipe: Recipe, handoff: Handoff): boolean {
  return Boolean(handoff.label?.trim()) || handoffDeliverables(recipe, handoff).found.length > 0;
}

/** 되돌아가는(순환) 흐름이 있는지. 재검토 흐름일 수 있어 막지는 않는다. */
export function hasCycle(recipe: Recipe): boolean {
  const next = new Map<string, string[]>();
  for (const handoff of recipe.handoffs) {
    next.set(handoff.from, [...(next.get(handoff.from) ?? []), handoff.to]);
  }
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const to of next.get(id) ?? []) if (visit(to)) return true;
    state.set(id, 2);
    return false;
  };
  return recipe.cards.some((card) => visit(card.id));
}

/** 내보내기 전 점검. providers는 도구 이름을 문구에 쓰려고 받는다. */
export function checkRecipe(recipe: Recipe, providers: ProviderData): ExportIssue[] {
  const issues: ExportIssue[] = [];
  const style = collaborationOf(recipe);
  const makesFiles = style !== 'debate';
  const add = (level: IssueLevel, code: IssueCode, message: string, target: IssueTarget) =>
    issues.push({ level, code, message, target });
  const names = (cards: AgentCard[]) => cards.map(cardLabel).join(', ');
  const cardTarget = (card: AgentCard, field: string): IssueTarget => ({ kind: 'card', id: card.id, field });

  // ── 고쳐야 해요: 파일을 만들 수 없거나 잘못 만들어지는 경우만 ──
  if (recipe.cards.length === 0) {
    add('error', 'NO_CARDS', '역할이 하나도 없어요. 역할을 추가해 주세요.', { kind: 'recipe', field: 'cards' });
  }

  const fileNames = new Map<string, AgentCard>();
  for (const card of recipe.cards) {
    const who = cardLabel(card);
    // 파일 이름 점검은 실제로 파일이 만들어지는 조리법에만 한다 (토론형은 파일이 없다)
    if (makesFiles) {
      if (!AGENT_NAME_PATTERN.test(card.name)) {
        add(
          'error',
          'BAD_FILE_NAME',
          `'${who}'의 에이전트 이름 "${card.name}"은 파일 이름으로 쓸 수 없어요. 영문 소문자·숫자·밑줄(_)만 써 주세요.`,
          cardTarget(card, 'name'),
        );
      } else if (fileNames.has(card.name)) {
        add(
          'error',
          'DUPLICATE_FILE',
          `'${who}'와 '${cardLabel(fileNames.get(card.name)!)}'의 에이전트 이름이 "${card.name}"으로 같아요. 같은 파일에 쓰이니 하나를 바꿔 주세요.`,
          cardTarget(card, 'name'),
        );
      } else {
        fileNames.set(card.name, card);
      }
    }
    if (style === 'agent-team' && card.preferredEngine !== 'claude-code') {
      const engine = providers.engines[card.preferredEngine]?.name ?? card.preferredEngine;
      add(
        'error',
        'TOOL_STYLE_MISMATCH',
        `에이전트 팀은 Claude Code에서만 돌아가는데 '${who}'의 도구가 ${engine}예요. 도구를 Claude Code로 바꾸거나 조리법을 서브에이전트로 바꿔 주세요.`,
        cardTarget(card, 'engine'),
      );
    }
  }

  const cardIds = new Set(recipe.cards.map((card) => card.id));
  const emptyLinks: typeof recipe.handoffs = [];
  const staleLinks: typeof recipe.handoffs = [];
  for (const handoff of recipe.handoffs) {
    if (!cardIds.has(handoff.from) || !cardIds.has(handoff.to)) {
      add('error', 'HANDOFF_BROKEN', '없는 역할을 가리키는 전달 흐름이 있어요. 보내는 쪽과 받는 쪽을 다시 골라 주세요.', {
        kind: 'handoff',
        id: handoff.id,
        field: 'handoff',
      });
    } else if (handoffDeliverables(recipe, handoff).missing.length > 0) {
      staleLinks.push(handoff);
    } else if (!hasHandoffInfo(recipe, handoff)) {
      emptyLinks.push(handoff);
    }
  }

  // ── 채우면 더 좋아요: 같은 종류는 한 줄로 묶는다 ──
  if (recipe.cards.length > 0) {
    if (!recipe.learningObjective?.trim()) {
      add('warn', 'NO_OBJECTIVE', '학습 목표가 비어 있어요. 적어 두면 설명서 맨 위에 들어가요.', {
        kind: 'recipe',
        field: 'objective',
      });
    }
    if (!recipe.successCriteria?.some((item) => item.trim())) {
      add('warn', 'NO_SUCCESS_CRITERIA', '성공 조건이 없어요. 적어 두면 AI가 마지막에 하나씩 확인해 줘요.', {
        kind: 'recipe',
        field: 'success',
      });
    }
    const grouped: [IssueCode, string, (card: AgentCard) => boolean, string][] = [
      ['CARD_NO_TASK', 'role', (card) => !card.role.trim(), '맡을 일이 비어 있는 역할'],
      ['CARD_NO_DELIVERABLE', 'deliverables', (card) => !card.deliverables?.some((item) => item.name.trim()), '산출물을 적지 않은 역할'],
      ['CARD_NO_CRITERIA', 'criteria', (card) => !card.completionCriteria?.some((item) => item.trim()), '완료 기준을 적지 않은 역할'],
    ];
    for (const [code, field, test, label] of grouped) {
      const cards = recipe.cards.filter(test);
      if (cards.length > 0) add('warn', code, `${label}: ${names(cards)}`, cardTarget(cards[0], field));
    }
    const link = (handoff: (typeof recipe.handoffs)[number]): IssueTarget => ({
      kind: 'handoff',
      id: handoff.id,
      field: 'handoff',
    });
    if (staleLinks.length > 0) {
      add('warn', 'HANDOFF_STALE_DELIVERABLE', `지워진 산출물을 가리키는 전달 흐름이 ${staleLinks.length}개 있어요. 넘길 것을 다시 골라 주세요.`, link(staleLinks[0]));
    }
    if (emptyLinks.length > 0) {
      add('warn', 'HANDOFF_EMPTY', `무엇을 넘기는지 적지 않은 전달 흐름이 ${emptyLinks.length}개 있어요.`, link(emptyLinks[0]));
    }
    // 토론형은 설정 파일이 없어 권한 선택이 쓰이지 않으므로 점검하지 않는다
    const soft = makesFiles
      ? recipe.cards.filter(
          (card) => card.permission === 'read-only' && isInstructionOnly(permissionSupport(card, style)),
        )
      : [];
    if (soft.length > 0) {
      const tools = [...new Set(soft.map((card) => providers.engines[effectiveEngine(card, style)]?.name))].join(', ');
      add(
        'warn',
        'PERMISSION_INSTRUCTION_ONLY',
        `읽기 전용이 지시문으로만 안내되는 역할: ${names(soft)} (${tools}). 기술적으로 수정을 막지는 않아요.`,
        cardTarget(soft[0], 'permission'),
      );
    }

    // ── 알아 두세요 ──
    if (hasCycle(recipe)) {
      add('info', 'FLOW_CYCLE', '되돌아가는 흐름은 시작 프롬프트에 한 번씩만 순서대로 적혀요. 반복하라는 지시는 넣지 않아요.', {
        kind: 'recipe',
        field: 'flow',
      });
    }
    add('info', 'ENV_UNCHECKED', '이 PC에 도구가 설치·로그인돼 있는지는 사이트가 확인하지 않았어요.', {
      kind: 'recipe',
      field: 'cards',
    });
    add('info', 'ORDER_PROMPT_ONLY', '작업 순서는 시작 프롬프트와 설명서로 전달돼요. 도구가 순서를 강제하지는 않아요.', {
      kind: 'recipe',
      field: 'flow',
    });
  }

  return issues;
}

/** 다운로드를 막아야 하는지 */
export function isBlocked(issues: ExportIssue[]): boolean {
  return issues.some((issue) => issue.level === 'error');
}
