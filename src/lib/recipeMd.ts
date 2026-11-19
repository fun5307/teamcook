// RECIPE.md (사람이 읽는 설명서)를 만든다. zip 내보내기에 함께 들어간다.

import {
  AGENT_TEAMS_ENV_NAME,
  AGENT_TEAMS_MERGE_HINT,
  AGENT_TEAMS_SETTINGS_JSON,
  COLLABORATIONS,
  collaborationOf,
} from '../data/collaboration';
import type { AgentCard, EngineId, Permission, ProviderData, Recipe, UserPlans } from '../types';
import { handoffDeliverables } from './exportCheck';
import { requiredPlans } from './requiredPlans';
import { ENFORCEMENT_LABELS, FLOW_NOTE, PLAN_FIT_NOTE, permissionSupport, reflectionScope } from './support';
import { KIND_HINTS, verificationDetail, verificationLine } from './verification';
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
  // 조리법에 따라: 에이전트 팀은 Claude Code 전용, 토론형은 설정 파일이 없다
  const style = collaborationOf(recipe);
  if (style === 'agent-team') return ['claude-code'];
  if (style === 'debate') return [];
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
/** 넘겨주기 한 건의 전달 정보: 직접 쓴 설명과 고른 산출물. 예: '(변경 내용 전달: 변경 요약, 테스트 결과)' */
export function handoffWhat(recipe: Recipe, handoff: Recipe['handoffs'][number]): string {
  const names = handoffDeliverables(recipe, handoff)
    .found.map((item) => item.name)
    .join(', ');
  const label = handoff.label?.trim() ?? '';
  if (label && names) return `(${label}: ${names})`;
  if (label || names) return `(${label || names})`;
  return '';
}

/** 역할별 산출물을 한 줄로. 예: 'writer(변경 요약, 테스트 결과) / reviewer(지적 목록)' */
function deliverableSummary(recipe: Recipe, useDisplayName = false): string {
  return recipe.cards
    .filter((card) => card.deliverables?.length)
    .map((card) => {
      const who = useDisplayName ? card.displayName || card.name : card.name;
      return `${who}(${card.deliverables!.map((item) => item.name).join(', ')})`;
    })
    .join(' / ');
}

/** 프롬프트 끝에 붙이는 '마지막 정리' 지시: 누가 모으고, 어떤 형식으로 내놓는지 */
function wrapUpLines(recipe: Recipe, who: string): string[] {
  const outputs = deliverableSummary(recipe);
  const criteria = recipe.successCriteria ?? [];
  if (!outputs && criteria.length === 0) return [];
  const lines = [`모든 단계가 끝나면 ${who} 결과를 하나로 모아 아래 형식으로 정리해 줘.`];
  if (outputs) lines.push(`- 역할별 산출물: ${outputs}`);
  if (criteria.length > 0) {
    lines.push('- 성공 조건을 만족했는지 하나씩 확인:');
    criteria.forEach((item, index) => lines.push(`  ${index + 1}) ${item}`));
  }
  lines.push('- 확인하지 못한 것과 남은 문제');
  return lines;
}

function taskLines(recipe: Recipe): string[] {
  const lines = ['할 일: (여기에 요청을 적으세요)'];
  if (recipe.sampleTask?.trim()) lines.push(`과제 예시: ${recipe.sampleTask.trim()}`);
  return lines;
}

export function starterPrompt(recipe: Recipe): string {
  const steps = flowSteps(recipe, (from, to, what) => `${from.name}의 결과${what}를 ${to.name}에게 넘긴다`);
  const wrapUp = wrapUpLines(recipe, '네가(메인)');
  if (steps.length === 0) {
    const names = recipe.cards.map((card) => card.name).join(', ');
    const first = `${names} 에이전트를 써서 다음 일을 해 줘: (여기에 요청을 적으세요)`;
    const extra = [...(recipe.sampleTask?.trim() ? [`과제 예시: ${recipe.sampleTask.trim()}`] : []), ...wrapUp];
    return [first, ...extra].join('\n');
  }
  const byId = new Map(recipe.cards.map((card) => [card.id, card]));
  const first = byId.get(recipe.handoffs[0].from);
  const lines = [
    '아래 순서대로 서브에이전트에게 일을 맡겨 줘.',
    `1. ${first ? first.name : '첫 에이전트'}가 먼저 일한다.`,
    ...steps.map((step, index) => `${index + 2}. ${step}.`),
    ...wrapUp,
    ...taskLines(recipe),
  ];
  return lines.join('\n');
}

function flowSteps(recipe: Recipe, verb: (from: AgentCard, to: AgentCard, what: string) => string): string[] {
  const byId = new Map(recipe.cards.map((card) => [card.id, card]));
  const steps: string[] = [];
  for (const handoff of recipe.handoffs) {
    const from = byId.get(handoff.from);
    const to = byId.get(handoff.to);
    if (!from || !to) continue;
    steps.push(verb(from, to, handoffWhat(recipe, handoff)));
  }
  return steps;
}

/**
 * 에이전트 팀을 시작하는 첫 프롬프트.
 * 공식 문서(2026-11-16 확인)대로 자연어로 팀원을 소개하고, 팀원마다 같은 이름의
 * 서브에이전트 정의(.claude/agents/<이름>.md)를 '에이전트 유형'으로 쓰게 한다.
 */
export function teamPrompt(recipe: Recipe): string {
  const steps = flowSteps(recipe, (from, to, what) => `${from.name}의 결과${what}를 ${to.name}에게 넘긴다`);
  const lines = [
    '에이전트 팀을 만들어 줘. 서브에이전트가 아니라 에이전트 팀으로 진행해.',
    '너는 리더다. 직접 작업하지 말고, 일을 나눠 맡기고 팀원들의 결과를 모아 정리해 줘.',
    '',
    `팀원 ${recipe.cards.length}명 (각각 같은 이름의 에이전트 유형을 써서 만든다):`,
    ...recipe.cards.map(
      (card) => `- ${card.name} 에이전트 유형으로 팀원 1명 — ${card.displayName || card.name}: ${cell(card.role)}`,
    ),
  ];
  if (steps.length > 0) {
    lines.push('', '일하는 순서:', ...steps.map((step, index) => `${index + 1}. ${step}.`));
  }
  const wrapUp = wrapUpLines(recipe, '리더인 네가');
  if (wrapUp.length > 0) lines.push('', ...wrapUp);
  lines.push('', ...taskLines(recipe));
  return lines.join('\n');
}

/** 토론형 프롬프트. 설정 파일 없이, 어느 AI 채팅에나 그대로 붙여 넣는다. */
export function debatePrompt(recipe: Recipe): string {
  const names = recipe.cards.map((card) => card.displayName || card.name);
  const first = names[0] ?? '사회자';
  const steps = flowSteps(
    recipe,
    (from, to, what) => `[${from.displayName || from.name}] 역할의 발언${what}을 [${to.displayName || to.name}] 역할이 이어받는다`,
  );
  const lines = [
    `지금부터 너 혼자서 아래 ${recipe.cards.length}명의 역할을 번갈아 맡아 토론해 줘.`,
    '',
    '주제: (여기에 결정하고 싶은 것을 적으세요)',
    ...(recipe.sampleTask?.trim() ? [`주제 예시: ${recipe.sampleTask.trim()}`] : []),
    '',
    '[역할]',
  ];
  recipe.cards.forEach((card, index) => {
    lines.push(`${index + 1}. ${card.displayName || card.name} — ${cell(card.role)}`);
    for (const line of card.instructions.split(/\r?\n/)) {
      if (line.trim()) lines.push(`   ${line.trim()}`);
    }
    if (card.requiredInputs?.length) lines.push(`   받는 것: ${card.requiredInputs.join(' / ')}`);
    if (card.deliverables?.length) {
      lines.push(`   내놓을 것: ${card.deliverables.map((item) => item.name).join(' / ')}`);
    }
    if (card.completionCriteria?.length) lines.push(`   끝나는 조건: ${card.completionCriteria.join(' / ')}`);
    if (card.boundaries?.length) lines.push(`   하지 않을 일: ${card.boundaries.join(' / ')}`);
  });
  lines.push('', '[진행 순서]');
  if (steps.length > 0) {
    lines.push(`1. [${first}] 역할이 먼저 주제와 판단 기준을 정리한다.`);
    steps.forEach((step, index) => lines.push(`${index + 2}. ${step}.`));
  } else {
    lines.push(...names.map((name, index) => `${index + 1}. [${name}] 역할이 발언한다.`));
  }
  lines.push(
    '',
    '[규칙]',
    '- 발언마다 맨 앞에 [역할 이름]을 붙인다.',
    '- 역할끼리 쉽게 동의하지 않는다. 앞선 발언의 약한 부분을 구체적으로 짚는다.',
    '- 확인한 사실, 추론, 확인하지 못한 것을 구분한다. 수치나 출처를 지어내지 않는다.',
    '- 위 순서를 두 바퀴 돈다. 둘째 바퀴에서는 첫째 바퀴에서 나온 반론에 답한다.',
    `- 마지막에 [${first}] 역할이 "결론 / 근거 / 남은 쟁점 / 다음에 할 일"을 정리한다.`,
  );
  if (recipe.successCriteria?.length) {
    lines.push('- 정리할 때 아래 조건을 만족했는지 하나씩 확인한다.');
    recipe.successCriteria.forEach((item, index) => lines.push(`  ${index + 1}) ${item}`));
  }
  return lines.join('\n');
}

/** 조리법에 맞는 '처음에 붙여 넣을 프롬프트' */
export function runPrompt(recipe: Recipe): string {
  const style = collaborationOf(recipe);
  if (style === 'agent-team') return teamPrompt(recipe);
  if (style === 'debate') return debatePrompt(recipe);
  return starterPrompt(recipe);
}

/** RECIPE.md 내용을 만든다. plans를 주면 '내 플랜 기준 실행 경로'도 적는다. */
export function buildRecipeMd(recipe: Recipe, providers: ProviderData, plans?: UserPlans): string {
  const required = requiredPlans(recipe, providers);
  const byId = new Map(recipe.cards.map((card) => [card.id, card]));
  const hasReadOnly = recipe.cards.some((card) => card.permission === 'read-only');
  const engines = exportEngines(recipe, providers, plans);
  const style = collaborationOf(recipe);
  const styleInfo = COLLABORATIONS[style];
  const out: string[] = [];

  out.push(`# ${recipe.title}`, '');
  if (recipe.summary) out.push(recipe.summary, '');
  if (recipe.useCase) out.push(`- **쓰임새:** ${recipe.useCase}`);
  if (recipe.author) out.push(`- **만든 사람:** ${recipe.author}`);
  out.push(
    `- **조리법(협업 방식):** ${styleInfo.label}${styleInfo.experimental ? ' (실험 기능)' : ''} — ${styleInfo.availability}`,
  );
  out.push(
    `- **필요한 플랜:** ${required.badges.length > 0 ? required.badges.join(' · ') : '없음'} (${providers.lastVerified} 확인)`,
  );
  for (const badge of required.details) {
    for (const note of badge.notes) out.push(`  - ${note}`);
  }
  out.push('');

  out.push('## 이 레시피로 익히는 것', '');
  out.push(`- **학습 목표:** ${recipe.learningObjective?.trim() || '(적혀 있지 않아요)'}`);
  if (recipe.sampleTask?.trim()) out.push(`- **입력 과제 예시:** ${cell(recipe.sampleTask)}`);
  out.push('- **실습 성공 조건:**');
  const success = recipe.successCriteria ?? [];
  if (success.length === 0) out.push('  - (적혀 있지 않아요)');
  success.forEach((item, index) => out.push(`  ${index + 1}. ${item}`));
  out.push('');

  out.push('## 준비', '');
  for (const item of recipe.prerequisites ?? []) out.push(`- ${item}`);
  out.push(
    '- 도구가 설치돼 있고 로그인돼 있어야 합니다. teamcook 사이트는 이 PC의 설치·로그인 상태를 확인하지 않았습니다.',
    '',
  );

  out.push('## 팀 구성', '', '| 에이전트 | 하는 일 | 권장 도구 | 권한 |', '| --- | --- | --- | --- |');
  for (const card of recipe.cards) {
    const engine =
      style === 'agent-team'
        ? providers.engines['claude-code'].name
        : style === 'debate'
          ? '프롬프트 안의 역할'
          : (providers.engines[card.preferredEngine]?.name ?? card.preferredEngine);
    out.push(
      `| ${cell(cardLabel(card))} | ${cell(card.role)} | ${engine} | ${PERMISSION_LABELS[card.permission]} |`,
    );
  }
  out.push('');

  out.push('### 역할별 작업·산출물·완료 기준', '');
  for (const card of recipe.cards) {
    const support = permissionSupport(card, style);
    out.push(`**${cardLabel(card)}**`, '');
    out.push(`- 맡을 일: ${cell(card.role) || '(적혀 있지 않아요)'}`);
    if (card.requiredInputs?.length) out.push(`- 받을 입력: ${card.requiredInputs.join(' / ')}`);
    out.push(
      `- 필수 산출물: ${
        card.deliverables?.length
          ? card.deliverables
              .map((item) => (item.description ? `${item.name} (${item.description})` : item.name))
              .join(' / ')
          : '(적혀 있지 않아요)'
      }`,
    );
    out.push(`- 완료 기준: ${card.completionCriteria?.length ? card.completionCriteria.join(' / ') : '(적혀 있지 않아요)'}`);
    if (card.boundaries?.length) out.push(`- 하지 않을 일: ${card.boundaries.join(' / ')}`);
    out.push(
      `- 권한: ${PERMISSION_LABELS[card.permission]} — ${support.modes.map((mode) => ENFORCEMENT_LABELS[mode]).join(', ')}. ${support.text}`,
      '',
    );
  }

  if (recipe.handoffs.length > 0) {
    out.push('## 전달 흐름 (누가 누구에게 무엇을 넘기나)', '');
    recipe.handoffs.forEach((handoff, index) => {
      const from = byId.get(handoff.from);
      const to = byId.get(handoff.to);
      if (!from || !to) return;
      const { found, missing } = handoffDeliverables(recipe, handoff);
      const label = handoff.label ? `: ${handoff.label}` : '';
      out.push(`${index + 1}. ${cardLabel(from)} → ${cardLabel(to)}${label}`);
      if (found.length > 0) out.push(`   - 넘기는 산출물: ${found.map((item) => item.name).join(', ')}`);
      if (missing.length > 0) out.push('   - (지워진 산출물을 가리키고 있어요. 다시 골라야 합니다.)');
      if (found.length === 0 && !handoff.label) out.push('   - (무엇을 넘기는지 적혀 있지 않아요.)');
    });
    out.push('', `> ${FLOW_NOTE}`, '');
  }

  out.push('## 실행 반영 범위 (설계한 내용이 어디에 들어가나)', '', '| 항목 | 반영되는 곳 | 알아 둘 점 |', '| --- | --- | --- |');
  for (const row of reflectionScope(recipe, providers)) {
    out.push(`| ${row.item} | ${cell(row.where)} | ${cell(row.note)} |`);
  }
  out.push('');

  const outputs = deliverableSummary(recipe, true);
  if (outputs || success.length > 0) {
    out.push('## 예상 결과 형식', '', '첫 프롬프트는 마지막에 결과를 이렇게 정리하라고 요청합니다.', '');
    if (outputs) out.push(`- 역할별 산출물: ${outputs}`);
    if (success.length > 0) out.push('- 성공 조건을 하나씩 확인한 결과');
    out.push('- 확인하지 못한 것과 남은 문제', '');
  }

  out.push('## 확인 기록', '');
  const records = recipe.verification ?? [];
  if (records.length === 0) {
    out.push('- 확인 기록이 없습니다. 이 레시피는 실제 도구에서 실행해 확인된 적이 없습니다.');
  }
  for (const record of records) {
    const detail = verificationDetail(record);
    out.push(`- ${verificationLine(record)}${detail ? ` (${detail})` : ''}`);
    out.push(`  - ${record.note ?? KIND_HINTS[record.kind]}`);
  }
  out.push('', '> "문서 확인"과 "파일 생성 확인"은 실제로 실행해 본 것이 아닙니다. 직접 돌려 본 뒤 결과를 teamcook 편집 화면의 확인 기록에 적어 두세요.', '');

  if (plans && style !== 'debate') {
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
    if (resolved.styleLock) out.push('', `> 🔒 ${resolved.styleLock.reason} ${resolved.styleLock.suggestion}`);
    out.push('', `> ${PLAN_FIT_NOTE} 다른 사람은 플랜이 달라 경로가 다를 수 있어요.`, '');
  }

  if (style === 'agent-team') {
    out.push(...agentTeamSections(recipe));
    return out.join('\n');
  }
  if (style === 'debate') {
    out.push(...debateSections(recipe));
    return out.join('\n');
  }

  out.push(
    '## 설치 (1분)',
    '',
    '1. 이 폴더 안의 `.codex` 폴더와 `.claude` 폴더를 **내 프로젝트 폴더 맨 위**에 복사합니다.',
    '   - 점(.)으로 시작하는 폴더는 숨김 폴더라 안 보일 수 있어요. (Windows 탐색기: 보기 → 숨긴 항목 / macOS Finder: Cmd+Shift+.)',
    '   - 이미 `.codex/config.toml`이 있다면 덮어쓰지 말고, 이 파일의 `[agents]` 부분만 옮겨 적으세요.',
    '2. 두 도구 모두에서 팀 전체를 쓸 수 있게, 모든 에이전트를 Codex 형식(`.codex/agents/*.toml`)과 Claude Code 형식(`.claude/agents/*.md`)으로 둘 다 넣어 두었습니다. 쓰지 않는 쪽 폴더는 지워도 됩니다.',
    ...(engines.includes('antigravity-cli')
      ? ['3. Antigravity를 쓴다면 `.agents` 폴더도 같은 곳에 복사합니다. (`.agents/agents/*.md`, 실행: `agy`. 처음엔 구글 계정 로그인, 또는 설정의 `modelProvider`를 `gemini`로 하고 `GEMINI_API_KEY`)']
      : []),
    ...(engines.includes('grok-build')
      ? ['3. Grok Build를 쓴다면 `.grok` 폴더도 같은 곳에 복사합니다. (`.grok/agents/*.md`, 실행: `grok`, 에이전트 목록: `/agents`. 처음엔 브라우저 로그인, 브라우저가 없으면 `XAI_API_KEY`)']
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
    '### 에이전트가 안 보일 때',
    '',
    '- `.codex`와 `.claude` 폴더가 프로젝트 폴더 **맨 위**에 있는지 확인합니다 (하위 폴더에 넣으면 안 보입니다).',
    '- 도구를 그 프로젝트 폴더에서 실행했는지 확인하고, 파일을 넣은 뒤 도구를 한 번 껐다 켭니다.',
    '- 파일 이름과 확장자(`.toml`, `.md`)가 바뀌지 않았는지 확인합니다.',
    '- 도구에 로그인돼 있는지 확인합니다.',
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

function tipLines(recipe: Recipe): string[] {
  return recipe.howToRun
    ? ['만든 사람의 실행 팁:', '', `> ${recipe.howToRun.replace(/\r?\n/g, '\n> ')}`, '']
    : [];
}

/** 에이전트 팀 조리법의 설치·실행·확인 방법 (2026-11-16 공식 문서 확인) */
function agentTeamSections(recipe: Recipe): string[] {
  const info = COLLABORATIONS['agent-team'];
  const firstName = recipe.cards[0]?.name ?? 'reviewer';
  return [
    '## 설치 (1분)',
    '',
    '1. 이 폴더 안의 `.claude` 폴더를 **내 프로젝트 폴더 맨 위**에 복사합니다.',
    '   - 점(.)으로 시작하는 폴더는 숨김 폴더라 안 보일 수 있어요. (Windows 탐색기: 보기 → 숨긴 항목 / macOS Finder: Cmd+Shift+.)',
    '   - `.claude/agents/*.md`: 팀원 한 명 한 명의 역할 정의입니다.',
    '   - `.claude/settings.json`: 에이전트 팀 기능을 켜는 설정입니다. 내용은 아래 한 가지뿐이에요.',
    '',
    '```json',
    AGENT_TEAMS_SETTINGS_JSON.trimEnd(),
    '```',
    '',
    `2. **${AGENT_TEAMS_MERGE_HINT}**`,
    '',
    '## 실행 방법 (Claude Code 전용)',
    '',
    '```bash',
    'cd 내-프로젝트-폴더',
    'claude',
    '```',
    '',
    '설정 파일을 넣은 뒤에는 Claude Code를 **새로 시작**해야 적용됩니다. 그다음 아래 프롬프트를 붙여 넣고, 맨 아래 "할 일"만 바꿔 주세요.',
    '',
    '### 첫 프롬프트 (팀원 소개)',
    '',
    '```text',
    teamPrompt(recipe),
    '```',
    '',
    ...tipLines(recipe),
    '## 팀이 제대로 시작됐는지 확인하기',
    '',
    `1. 프롬프트를 보낸 뒤 화면 아래쪽 에이전트 목록에 팀원 ${recipe.cards.length}명의 이름이 보이면 성공입니다.`,
    '2. 위·아래 화살표로 팀원을 고르고 Enter를 누르면 그 팀원의 대화를 볼 수 있고, 바로 말을 걸 수도 있습니다.',
    '3. Ctrl+T를 누르면 팀이 함께 쓰는 할 일 목록이 보입니다.',
    '4. 팀원이 아니라 서브에이전트로 일을 시작했다면 "서브에이전트 말고 에이전트 팀으로 다시 해 줘"라고 말하세요.',
    `5. 끝낼 때는 "${firstName} 팀원을 종료해 줘"처럼 말합니다. 대화창을 닫으면 팀은 자동으로 정리됩니다.`,
    '',
    `팀원이 하나도 안 생긴다면: \`.claude/settings.json\`에 \`${AGENT_TEAMS_ENV_NAME}\`가 들어 있는지, Claude Code를 새로 시작했는지 확인하세요. 오래된 Claude Code라면 먼저 업데이트하세요.`,
    '',
    '## 알아 둘 점',
    '',
    ...info.notes.map((note) => `- ${note}`),
    '- **읽기 전용 팀원:** `tools` 목록을 읽기 도구(Read, Grep, Glob)로 제한해 두었습니다.',
    '- **Claude Code가 없다면:** teamcook 사이트에서 `recipe.json`을 불러와 조리법을 "서브에이전트"로 바꾸면, 같은 역할을 Codex 등 다른 도구용 파일로 내보낼 수 있습니다.',
    `- 공식 문서: ${info.sourceUrl} (${info.lastVerified} 확인)`,
    '',
  ];
}

/** 토론형 조리법의 실행 방법. 설정 파일이 없고 프롬프트만 있다. */
function debateSections(recipe: Recipe): string[] {
  return [
    '## 실행 방법 (설치할 것이 없어요)',
    '',
    '1. 아래 프롬프트를 통째로 복사합니다. (같은 내용이 `debate-prompt.txt`에도 들어 있습니다.)',
    '2. 쓰는 AI 채팅에 붙여 넣습니다. ChatGPT·Claude·Gemini 무료 웹 채팅도 되고, Codex·Claude Code 같은 터미널 도구도 됩니다.',
    '3. "주제:" 줄만 내가 결정하고 싶은 것으로 바꿔서 보냅니다.',
    '',
    '### 토론 프롬프트',
    '',
    '```text',
    debatePrompt(recipe),
    '```',
    '',
    ...tipLines(recipe),
    '## 알아 둘 점',
    '',
    ...COLLABORATIONS.debate.notes.map((note) => `- ${note}`),
    '- **토론 결과는 주장입니다:** 결론에 쓰인 사실은 직접 확인한 뒤 쓰세요.',
    '- **다시 고치려면:** `recipe.json`을 teamcook 사이트에서 불러오면 역할과 순서를 고칠 수 있습니다.',
    '',
  ];
}
