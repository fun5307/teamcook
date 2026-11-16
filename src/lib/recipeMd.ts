// RECIPE.md (사람이 읽는 설명서)를 만든다. zip 내보내기에 함께 들어간다.

import type { AgentCard, EngineId, Permission, ProviderData, Recipe, UserPlans } from '../types';
import { requiredPlans } from './requiredPlans';
import { PATH_NAMES, PATH_SYMBOLS, effectiveRoute, resolveRecipe } from './resolvePath';

export const PERMISSION_LABELS: Record<Permission, string> = {
  'read-only': '읽기 전용',
  edit: '편집 가능',
  full: '제한 없음 (메인 세션 설정을 따름)',
};

/**
 * zip에 넣을 형식들. Codex와 Claude Code는 항상 넣고,
 * Antigravity·Grok은 그 도구를 쓰는 카드가 있을 때(원래 설정이든, 내 플랜 기준 대안이든)만 넣는다.
 */
export function exportEngines(recipe: Recipe, providers: ProviderData, plans?: UserPlans): EngineId[] {
  const used = new Set<EngineId>(recipe.cards.map((card) => card.preferredEngine));
  if (plans) {
    const resolved = resolveRecipe(recipe, plans, providers);
    for (const card of recipe.cards) used.add(effectiveRoute(resolved.perCard[card.id]).engine);
  }
  const engines: EngineId[] = ['codex-cli', 'claude-code'];
  for (const extra of ['antigravity-cli', 'grok-build'] as const) {
    if (used.has(extra)) engines.push(extra);
  }
  return engines;
}

/** 표 칸 안에서 깨지지 않게 줄바꿈과 | 를 정리한다. */
function cell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function cardLabel(card: AgentCard): string {
  return card.displayName && card.displayName !== card.name
    ? `${card.displayName}(\`${card.name}\`)`
    : `\`${card.name}\``;
}

/**
 * 넘겨주기 흐름을 바탕으로 "첫 프롬프트" 예시를 만든다.
 * 에이전트 파일에는 흐름이 담기지 않으므로, 흐름은 첫 프롬프트로 알려 줘야 한다.
 */
export function starterPrompt(recipe: Recipe): string {
  const byId = new Map(recipe.cards.map((card) => [card.id, card]));
  const steps: string[] = [];
  for (const handoff of recipe.handoffs) {
    const from = byId.get(handoff.from);
    const to = byId.get(handoff.to);
    if (!from || !to) continue;
    const what = handoff.label ? `(${handoff.label})` : '';
    steps.push(`${from.name}의 결과${what}를 ${to.name}에게 넘긴다`);
  }
  if (steps.length === 0) {
    const names = recipe.cards.map((card) => card.name).join(', ');
    return `${names} 에이전트를 써서 다음 일을 해 줘: (여기에 요청을 적으세요)`;
  }
  const first = byId.get(recipe.handoffs[0].from);
  const lines = [
    '아래 순서대로 서브에이전트에게 일을 맡겨 줘.',
    `1. ${first ? first.name : '첫 에이전트'}가 먼저 일한다.`,
    ...steps.map((step, index) => `${index + 2}. ${step}.`),
    '할 일: (여기에 요청을 적으세요)',
  ];
  return lines.join('\n');
}

/** RECIPE.md 내용을 만든다. plans를 주면 '내 플랜 기준 실행 경로'도 적는다. */
export function buildRecipeMd(recipe: Recipe, providers: ProviderData, plans?: UserPlans): string {
  const required = requiredPlans(recipe, providers);
  const byId = new Map(recipe.cards.map((card) => [card.id, card]));
  const hasReadOnly = recipe.cards.some((card) => card.permission === 'read-only');
  const engines = exportEngines(recipe, providers, plans);
  const out: string[] = [];

  out.push(`# ${recipe.title}`, '');
  if (recipe.summary) out.push(recipe.summary, '');
  if (recipe.useCase) out.push(`- **쓰임새:** ${recipe.useCase}`);
  if (recipe.author) out.push(`- **만든 사람:** ${recipe.author}`);
  out.push(
    `- **필요한 플랜:** ${required.badges.length > 0 ? required.badges.join(' · ') : '없음'} (${providers.lastVerified} 확인)`,
  );
  for (const badge of required.details) {
    for (const note of badge.notes) out.push(`  - ${note}`);
  }
  out.push('');

  out.push('## 팀 구성', '', '| 에이전트 | 하는 일 | 권장 도구 | 권한 |', '| --- | --- | --- | --- |');
  for (const card of recipe.cards) {
    const engine = providers.engines[card.preferredEngine]?.name ?? card.preferredEngine;
    out.push(
      `| ${cell(cardLabel(card))} | ${cell(card.role)} | ${engine} | ${PERMISSION_LABELS[card.permission]} |`,
    );
  }
  out.push('');

  if (recipe.handoffs.length > 0) {
    out.push('## 흐름 (누가 누구에게 무엇을 넘기나)', '');
    recipe.handoffs.forEach((handoff, index) => {
      const from = byId.get(handoff.from);
      const to = byId.get(handoff.to);
      if (!from || !to) return;
      const label = handoff.label ? `: ${handoff.label}` : '';
      out.push(`${index + 1}. ${cardLabel(from)} → ${cardLabel(to)}${label}`);
    });
    out.push('');
  }

  if (plans) {
    const resolved = resolveRecipe(recipe, plans, providers);
    out.push('## 내 플랜 기준 실행 경로 (내보낸 시점)', '', `${resolved.summary}`, '');
    for (const card of recipe.cards) {
      const resolution = resolved.perCard[card.id];
      const route = effectiveRoute(resolution);
      const engine = providers.engines[route.engine]?.name ?? route.engine;
      const lock = resolution.locked ? `🔒 ${resolution.lockReason ?? ''} → ` : '';
      out.push(
        `- ${cardLabel(card)}: ${lock}${PATH_SYMBOLS[route.path]} ${PATH_NAMES[route.path]} — ${engine}`,
      );
      if (resolution.alternative) out.push(`  - ${resolution.alternative.reason}`);
    }
    out.push('', '> 다른 사람은 플랜이 달라 경로가 다를 수 있어요.', '');
  }

  out.push(
    '## 설치 (1분)',
    '',
    '1. 이 폴더 안의 `.codex` 폴더와 `.claude` 폴더를 **내 프로젝트 폴더 맨 위**에 복사합니다.',
    '   - 점(.)으로 시작하는 폴더는 숨김 폴더라 안 보일 수 있어요. (Windows 탐색기: 보기 → 숨긴 항목 / macOS Finder: Cmd+Shift+.)',
    '   - 이미 `.codex/config.toml`이 있다면 덮어쓰지 말고, 이 파일의 `[agents]` 부분만 옮겨 적으세요.',
    '2. 두 도구 모두에서 팀 전체를 쓸 수 있게, 모든 에이전트를 Codex 형식(`.codex/agents/*.toml`)과 Claude Code 형식(`.claude/agents/*.md`)으로 둘 다 넣어 두었습니다. 쓰지 않는 쪽 폴더는 지워도 됩니다.',
    ...(engines.includes('antigravity-cli')
      ? ['3. Antigravity를 쓴다면 `.agents` 폴더도 같은 곳에 복사합니다. (`.agents/agents/*.md`, 실행: `agy`)']
      : []),
    ...(engines.includes('grok-build')
      ? ['3. Grok Build를 쓴다면 `.grok` 폴더도 같은 곳에 복사합니다. (`.grok/agents/*.md`, 실행: `grok`, 에이전트 목록: `/agents`)']
      : []),
    '',
    '## 실행 방법',
    '',
    '### 터미널에서 Codex로',
    '',
    '```bash',
    'cd 내-프로젝트-폴더',
    hasReadOnly ? 'codex            # 검토·조사만 할 때는: codex --sandbox read-only' : 'codex',
    '```',
    '',
    `확인: \`${recipe.cards[0]?.name ?? 'reviewer'} 에이전트에게 이 프로젝트를 한 줄로 요약하게 해 줘\` 라고 입력해 보세요. 실행 중인 에이전트는 \`/subagents\`로 볼 수 있습니다.`,
    '',
    '### 터미널에서 Claude Code로',
    '',
    '```bash',
    'cd 내-프로젝트-폴더',
    'claude',
    '```',
    '',
    `확인: \`어떤 서브에이전트가 있어?\` 라고 물어보세요. 특정 에이전트를 콕 집어 부르려면 \`@agent-${recipe.cards[0]?.name ?? 'reviewer'}\` 처럼 씁니다.`,
    '(`.claude/agents` 폴더를 처음 만든 경우에는 Claude Code를 한 번 껐다 켜야 보입니다.)',
    '',
    '### T3 Code · 1Code에서',
    '',
    '두 도구는 내 PC에 설치된 Codex·Claude Code를 대신 실행해 주는 화면입니다. 위처럼 파일을 프로젝트 폴더에 넣은 뒤 그 폴더를 프로젝트로 열면 됩니다.',
    '채팅마다 별도의 git 작업 폴더(worktree)를 만드는 도구에서는, **`.codex`와 `.claude` 폴더를 git에 커밋해 두어야** 에이전트가 보입니다.',
    '',
    '### 첫 프롬프트 예시',
    '',
    '```text',
    starterPrompt(recipe),
    '```',
    '',
  );
  if (recipe.howToRun) out.push('만든 사람의 실행 팁:', '', `> ${recipe.howToRun.replace(/\r?\n/g, '\n> ')}`, '');

  out.push(
    '## 알아 둘 점',
    '',
    '- **Codex의 읽기 전용:** Codex는 에이전트 파일만으로는 읽기 전용을 강제할 수 없습니다(서브에이전트는 메인 세션의 권한을 물려받음). 그래서 읽기 전용 에이전트의 지시문 끝에 "수정하지 마라"는 문장을 넣어 두었습니다. 확실히 막으려면 `codex --sandbox read-only`로 실행하세요.',
    '- **Claude Code의 읽기 전용:** `tools` 목록을 읽기 도구(Read, Grep, Glob)로 제한해 두었습니다.',
    '- **검토 결과는 주장입니다:** 다른 모델의 지적도 틀릴 수 있습니다. 작성자가 확인한 뒤 맞는 것만 반영하세요.',
    '- **다시 고치려면:** `recipe.json`을 teamcook 사이트에서 불러오면 이 팀을 그대로 편집할 수 있습니다.',
    '',
  );
  return out.join('\n');
}
