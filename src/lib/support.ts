// 도구와 조리법이 "무엇을 실제로 해 주는지"에 대한 공통 규칙.
// 편집 화면의 권한 안내, 상세 화면의 '실행 반영 범위', 내보내기 점검, RECIPE.md가 모두 여기만 본다.
// (같은 설명을 화면마다 따로 적지 않는다. 근거는 converters/ 의 실제 생성 코드다.)

import { CLAUDE_EDIT_TOOLS, CLAUDE_READONLY_TOOLS, permissionFromTools } from '../converters/claude';
import { CODEX_READONLY_GUARD } from '../converters/codex';
import { composeInstructions } from '../converters/instructions';
import { collaborationOf } from '../data/collaboration';
import type { AgentCard, Collaboration, EngineId, ProviderData, Recipe } from '../types';

/**
 * 권한을 어떤 수단으로 지키는지.
 * - instruction: 지시문으로 부탁만 한다 (기술적으로 막지 않는다)
 * - tool-limit: 만들어지는 설정에서 쓸 수 있는 도구를 제한한다
 * - env-required: 실행 옵션이나 메인 세션의 권한 설정이 따로 필요하다
 * - unknown: 실제로 막히는지 확인하지 못했다
 */
export type EnforcementMode = 'instruction' | 'tool-limit' | 'env-required' | 'unknown';

export const ENFORCEMENT_LABELS: Record<EnforcementMode, string> = {
  instruction: '지시문으로 안내',
  'tool-limit': '도구 제한',
  'env-required': '실행 환경 설정 필요',
  unknown: '확인 필요',
};

export interface PermissionSupport {
  /** 해당하는 수단 (여럿일 수 있다) */
  modes: EnforcementMode[];
  /** 사용자에게 그대로 보여 줄 설명 */
  text: string;
}

/** 이 카드가 실제로 돌게 되는 도구 (에이전트 팀은 전부 Claude Code, 토론형은 프롬프트) */
export function effectiveEngine(card: AgentCard, style: Collaboration): EngineId {
  if (style === 'debate') return 'manual';
  if (style === 'agent-team') return 'claude-code';
  return card.preferredEngine;
}

/** 카드의 권한 선택이 내보낸 설정에서 어떻게 지켜지는지 */
export function permissionSupport(card: AgentCard, style: Collaboration): PermissionSupport {
  const engine = effectiveEngine(card, style);
  const readOnly = card.permission === 'read-only';

  if (style === 'debate') {
    return {
      modes: ['instruction'],
      text: '토론형은 프롬프트만 씁니다. 권한은 설정 파일로 제한되지 않고, 붙여 넣는 AI의 설정을 그대로 따릅니다.',
    };
  }

  if (engine === 'claude-code') {
    const custom = card.tools && card.tools.length > 0 ? card.tools : undefined;
    if (card.permission === 'full' && !custom) {
      return {
        modes: ['env-required'],
        text: '도구를 제한하지 않습니다. 무엇을 할 수 있는지는 Claude Code 메인 세션의 권한 설정을 따릅니다.',
      };
    }
    if (custom && permissionFromTools(custom) !== card.permission) {
      return {
        modes: ['unknown'],
        text: `직접 적은 도구 목록(${custom.join(', ')})이 고른 권한과 맞지 않습니다. 파일에는 적은 목록이 그대로 들어가므로, 권한이 지켜지는지 목록을 확인하세요.`,
      };
    }
    const tools = custom ?? (readOnly ? CLAUDE_READONLY_TOOLS : CLAUDE_EDIT_TOOLS);
    return readOnly
      ? {
          modes: ['tool-limit'],
          text: `Claude Code 설정의 tools를 ${tools.join(', ')}로 제한합니다. 파일을 고치는 도구가 목록에 없습니다.`,
        }
      : {
          modes: ['tool-limit', 'env-required'],
          text: `Claude Code 설정의 tools를 ${tools.join(', ')}로 적습니다. 실제로 수정을 허락할지는 Claude Code의 권한 설정(물어보기, 자동 허용 등)을 따릅니다.`,
        };
  }

  if (engine === 'codex-cli') {
    return readOnly
      ? {
          modes: ['instruction', 'env-required'],
          text: 'Codex는 에이전트 파일로 읽기 전용을 강제할 수 없습니다. 지시문 끝에 "수정하지 마라"는 문장을 넣을 뿐이고, 기술적으로 막으려면 codex --sandbox read-only 로 실행해야 합니다.',
        }
      : {
          modes: ['env-required'],
          text: 'Codex는 에이전트 파일로 권한을 바꿀 수 없습니다. 메인 세션의 샌드박스·승인 설정을 그대로 물려받습니다.',
        };
  }

  if (engine === 'antigravity-cli') {
    return readOnly
      ? {
          modes: ['tool-limit', 'unknown'],
          text: '설정의 tools를 읽기 도구(view_file, grep_search)로 적습니다. 형식은 공식 문서로 확인했지만 실제 Antigravity에서 막히는지는 실행해 보지 못했습니다.',
        }
      : { modes: ['unknown'], text: 'Antigravity에서 이 권한이 어떻게 적용되는지 실행해 확인하지 못했습니다.' };
  }

  if (engine === 'grok-build') {
    return readOnly
      ? {
          modes: ['instruction', 'unknown'],
          text: 'Grok Build는 도구 이름 목록을 확인하지 못해, 지시문 끝에 "수정하지 마라"는 문장만 넣습니다. 기술적으로 막지 않습니다.',
        }
      : { modes: ['unknown'], text: 'Grok Build에서 이 권한이 어떻게 적용되는지 확인하지 못했습니다.' };
  }

  return {
    modes: ['instruction'],
    text: '설정 파일을 쓰지 않는 경로입니다. 권한은 지시문으로만 안내되고, 붙여 넣는 AI의 설정을 따릅니다.',
  };
}

/** 권한이 지시문으로만 표현되는지 (기술적인 제한 수단이 하나도 없는지) */
export function isInstructionOnly(support: PermissionSupport): boolean {
  return support.modes.includes('instruction') && !support.modes.includes('tool-limit');
}

export interface ScopeRow {
  /** 설계한 항목 */
  item: string;
  /** 어디에 반영되는지 */
  where: string;
  /** 무엇이 보장되지 않는지, 조건은 무엇인지 */
  note: string;
}

/** 설계한 내용이 내보낸 파일과 프롬프트의 어디에 들어가는지 (실제 생성 로직 기준) */
export function reflectionScope(recipe: Recipe, providers: ProviderData): ScopeRow[] {
  const style = collaborationOf(recipe);
  const engines = [...new Set(recipe.cards.map((card) => effectiveEngine(card, style)))];
  const extra = (['antigravity-cli', 'grok-build'] as const)
    .filter((id) => engines.includes(id))
    .map((id) => providers.engines[id].configFormat ?? providers.engines[id].name);

  const modes = new Set<EnforcementMode>();
  for (const card of recipe.cards) for (const mode of permissionSupport(card, style).modes) modes.add(mode);
  const permissionRow: ScopeRow = {
    item: '권한 제한',
    where: [...modes].map((mode) => ENFORCEMENT_LABELS[mode]).join(', ') || '카드 없음',
    note: '카드마다 수단이 다릅니다. 역할별 설명을 확인하세요. "읽기 전용"을 골랐다고 항상 기술적으로 막히는 것은 아닙니다.',
  };

  if (style === 'debate') {
    return [
      { item: '역할 정의', where: '토론 프롬프트 (debate-prompt.txt, RECIPE.md)', note: '설정 파일은 만들지 않습니다.' },
      { item: '작업 순서', where: '토론 프롬프트의 진행 순서', note: 'AI가 프롬프트를 따르는 만큼만 지켜집니다. 사이트가 순서를 강제하지 않습니다.' },
      { item: '산출물·완료 기준', where: '토론 프롬프트의 역할 설명', note: '역할마다 내놓을 것과 끝나는 조건을 프롬프트에 적습니다.' },
      { item: '팀원 메시지', where: '해당 없음', note: '한 AI가 여러 역할을 번갈아 맡습니다. 별도 세션끼리 주고받는 협업과는 다릅니다.' },
      permissionRow,
    ];
  }

  if (style === 'agent-team') {
    return [
      { item: '역할 정의', where: '.claude/agents/*.md', note: '팀원을 만들 때 "에이전트 유형"으로 씁니다. 리더는 처음 연 대화창이라 파일이 없습니다.' },
      { item: '작업 순서', where: '첫 프롬프트, RECIPE.md', note: '리더가 프롬프트를 읽고 일을 나눕니다. 사이트나 파일이 순서를 강제하지 않습니다.' },
      { item: '산출물·완료 기준', where: '각 팀원 파일의 지시문 끝', note: '팀원의 지시문에 덧붙습니다.' },
      { item: '팀원 메시지', where: 'Claude Code 에이전트 팀 기능', note: '팀원끼리의 메시지와 공용 할 일 목록은 Claude Code가 제공합니다(실험 기능, 공식 문서로 확인). 에이전트 팀을 켜는 설정은 .claude/settings.json에 들어갑니다.' },
      permissionRow,
    ];
  }

  return [
    {
      item: '역할 정의',
      where: ['.codex/agents/*.toml', '.claude/agents/*.md', ...extra].join(', '),
      note: '모든 역할을 Codex와 Claude Code 두 형식으로 넣습니다. 쓰지 않는 쪽은 지워도 됩니다.',
    },
    { item: '작업 순서', where: '첫 프롬프트, RECIPE.md', note: '메인 AI가 프롬프트를 읽고 순서대로 맡깁니다. 사이트나 파일이 순서를 강제하지 않습니다.' },
    { item: '산출물·완료 기준', where: '각 역할 파일의 지시문 끝', note: '역할의 지시문에 덧붙습니다.' },
    {
      item: '팀원 메시지',
      where: '설정하지 않음',
      note: '내보낸 서브에이전트는 결과를 메인 AI에게 돌려줍니다. 서브에이전트끼리 직접 소통할 수 있는지는 도구마다 다르고, 이 사이트는 그것을 설정하지 않습니다.',
    },
    permissionRow,
  ];
}

/** '내 플랜으로 가능' 옆에 항상 붙이는 문장 */
export const PLAN_FIT_NOTE =
  '선택한 요금제 정보를 기준으로 찾은 실행 경로입니다. 이 PC의 설치·로그인·실제 실행 상태는 확인하지 않았습니다.';

/** 흐름 영역에 항상 붙이는 문장 */
export const FLOW_NOTE =
  '이 흐름은 시작 프롬프트와 설명서에 반영됩니다. 사이트가 실제 실행 순서를 강제하지는 않습니다.';

/**
 * 이 카드가 실제로 돌 도구의 설정 파일에 들어갈 지시문 (화면의 '생성될 지시문 미리보기').
 * 변환기와 같은 함수(composeInstructions)를 쓰고, 지시문으로만 읽기 전용을 안내하는 도구에는
 * 변환기가 붙이는 문장을 똑같이 붙인다.
 */
export function previewInstructions(card: AgentCard, style: Collaboration): string {
  const text = composeInstructions(card);
  const engine = effectiveEngine(card, style);
  const guarded = card.permission === 'read-only' && (engine === 'codex-cli' || engine === 'grok-build');
  if (!guarded) return text;
  return text ? `${text}\n\n${CODEX_READONLY_GUARD}` : CODEX_READONLY_GUARD;
}
