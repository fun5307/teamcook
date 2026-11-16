// 레시피를 zip으로 내보낸다 (PROJECT_BRIEF.md 5.4).
//   <recipe-name>/
//   ├─ .codex/agents/*.toml
//   ├─ .codex/config.toml
//   ├─ .claude/agents/*.md
//   ├─ .claude/settings.json   (에이전트 팀 조리법일 때만: 에이전트 팀 켜기. 이때는 .codex가 없다)
//   ├─ debate-prompt.txt       (토론형 조리법일 때만. 이때는 .codex·.claude가 없다)
//   ├─ recipe.json   (다시 불러오기용 원본)
//   └─ RECIPE.md     (사람용 설명서)

import JSZip from 'jszip';
import { cardToClaudeMd } from '../converters/claude';
import { cardToCodexToml, recipeToCodexConfig } from '../converters/codex';
import { cardToAntigravityMd, cardToGrokMd } from '../converters/markdownAgents';
import { AGENT_TEAMS_SETTINGS_JSON, collaborationOf } from '../data/collaboration';
import { codexBridgeMd, needsCodexBridge } from './bridge';
import type { ProviderData, Recipe, UserPlans } from '../types';
import { buildRecipeMd, debatePrompt, exportEngines } from './recipeMd';

export interface ExportOptions {
  /** 내 플랜. 주면 RECIPE.md에 실행 경로를 적고, 대안 도구의 형식도 함께 넣는다. */
  plans?: UserPlans;
  /** Claude Code가 Codex 담당 카드를 `codex exec`로 직접 부르게 한다 (실험적) */
  codexBridge?: boolean;
}

/** 파일·폴더 이름으로 쓸 수 없는 글자를 -로 바꾼다. 한글은 그대로 둔다. */
export function safeName(value: string, fallback: string): string {
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

/** zip에 들어갈 파일들을 { 경로: 내용 }으로 만든다. (테스트하기 쉽게 zip과 분리) */
export function buildRecipeFiles(
  recipe: Recipe,
  providers: ProviderData,
  options: ExportOptions = {},
): Record<string, string> {
  const { plans } = options;
  const engines = exportEngines(recipe, providers, plans);
  const style = collaborationOf(recipe);
  // 'Codex 자동 호출'은 서브에이전트 조리법에서만 뜻이 있다
  const bridge = style === 'subagents' && options.codexBridge === true && needsCodexBridge(recipe);
  const root = safeName(recipe.title, 'recipe');
  const files: Record<string, string> = {};
  const used = new Set<string>();

  for (const card of recipe.cards) {
    // 이름이 겹치면 뒤에 번호를 붙인다
    const base = safeName(card.name, 'agent');
    let fileName = base;
    for (let n = 2; used.has(fileName); n += 1) fileName = `${base}-${n}`;
    used.add(fileName);

    // 조리법에 따라 넣는 형식이 다르다: 토론형은 설정 파일 없음, 에이전트 팀은 Claude Code 전용
    if (style === 'debate') continue;
    if (style === 'agent-team') {
      // 팀원은 모두 Claude Code에서 돌므로, 다른 도구용 모델 이름은 쓰지 않는다
      const { model, ...rest } = card;
      const member = card.preferredEngine === 'claude-code' && model ? { ...rest, model } : rest;
      files[`${root}/.claude/agents/${fileName}.md`] = cardToClaudeMd({ ...member, preferredEngine: 'claude-code' });
      continue;
    }
    files[`${root}/.codex/agents/${fileName}.toml`] = cardToCodexToml(card);
    files[`${root}/.claude/agents/${fileName}.md`] =
      bridge && card.preferredEngine === 'codex-cli' ? codexBridgeMd(card) : cardToClaudeMd(card);
    if (engines.includes('antigravity-cli')) {
      files[`${root}/.agents/agents/${fileName}.md`] = cardToAntigravityMd(card);
    }
    if (engines.includes('grok-build')) {
      files[`${root}/.grok/agents/${fileName}.md`] = cardToGrokMd(card);
    }
  }

  if (style === 'subagents') files[`${root}/.codex/config.toml`] = recipeToCodexConfig(recipe);
  // 에이전트 팀 켜기 (프로젝트 폴더용 설정만. 사용자의 ~/.claude는 건드리지 않는다)
  if (style === 'agent-team') files[`${root}/.claude/settings.json`] = AGENT_TEAMS_SETTINGS_JSON;
  if (style === 'debate') files[`${root}/debate-prompt.txt`] = `${debatePrompt(recipe)}\n`;
  files[`${root}/recipe.json`] = `${JSON.stringify(recipe, null, 2)}\n`;
  files[`${root}/RECIPE.md`] = buildRecipeMd(recipe, providers, plans);
  if (bridge) {
    files[`${root}/RECIPE.md`] += [
      '## Claude Code에서 Codex 자동 호출 (실험적)',
      '',
      '이 zip은 "Codex 자동 호출"을 켜고 내보냈습니다. Codex 담당 에이전트의 Claude Code용 파일(`.claude/agents/`)은',
      '직접 일하지 않고 `codex exec` 명령으로 Codex에게 일을 넘긴 뒤 결과를 그대로 전달합니다.',
      '그래서 Claude Code 하나만 열어 두어도 두 회사 모델이 함께 일합니다.',
      '',
      '- Codex CLI가 설치·로그인돼 있어야 합니다 (ChatGPT Plus 이상 또는 API 키).',
      '- 호출할 때마다 Codex 사용량이 듭니다.',
      '- Claude Code가 `codex` 명령 실행 허락을 물으면 허용해 주세요.',
      '',
    ].join('\n');
  }
  return files;
}

/** 레시피 zip을 만든다. 브라우저에서는 new Blob([결과])로 내려받는다. */
export async function buildRecipeZip(
  recipe: Recipe,
  providers: ProviderData,
  options: ExportOptions = {},
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(buildRecipeFiles(recipe, providers, options))) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** 내려받을 zip 파일 이름 */
export function zipFileName(recipe: Recipe): string {
  return `${safeName(recipe.title, 'recipe')}.zip`;
}
