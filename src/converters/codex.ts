// Codex 커스텀 에이전트(.codex/agents/<name>.toml) ↔ AgentCard 변환.
//
// 2026-11-16 공식 문서 확인 (https://learn.chatgpt.com/docs/agent-configuration/subagents):
// - 필수 필드: name, description, developer_instructions
// - 선택: model, model_reasoning_effort, model_reasoning_summary, model_verbosity,
//         features.*, skills.* → 모르는 필드는 extra.codex에 그대로 보관한다.
// - sandbox_mode, approval_policy, model_provider, mcp_servers는 에이전트 파일에 써도
//   부모 설정을 덮어쓰지 못한다. 즉 "읽기 전용"은 파일로 강제할 수 없다.
//   → 읽기 전용 카드는 지시문 끝에 '수정하지 마라' 문장을 붙이고,
//     실제 강제는 부모 세션(codex --sandbox read-only)에서 하도록 RECIPE.md로 안내한다.

import { parse, stringify } from 'smol-toml';
import type { AgentCard, Recipe } from '../types';
import { newId } from '../lib/id';
import { type CardMeta, ConvertError, metaLine, normalizeText, readMeta } from './meta';

/** 읽기 전용 카드의 지시문 끝에 붙이는 문장. 불러올 때는 이 문장을 떼어 내고 권한으로 되돌린다. */
export const CODEX_READONLY_GUARD =
  '[권한: 읽기 전용] 파일을 만들거나 수정하지 마라. 고칠 점이 있으면 직접 고치지 말고 제안으로만 보고하라.';

const KNOWN_KEYS = ['name', 'description', 'developer_instructions'];

/** TOML 한 줄 문자열 */
function tomlString(value: string): string {
  return JSON.stringify(value).replace(/\u007f/g, '\\u007F');
}

/** TOML 여러 줄 문자열 ("""...""") */
function tomlMultiline(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '""\\"')
    // 줄바꿈·탭을 뺀 제어 문자는 \uXXXX로 바꾼다
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, (ch) => {
      return `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}`;
    });
  return `"""\n${escaped}\n"""`;
}

/** 카드 → Codex TOML 파일 내용 */
export function cardToCodexToml(card: AgentCard): string {
  const isNative = card.preferredEngine === 'codex-cli';

  const meta: CardMeta = {};
  if (card.displayName && card.displayName !== card.name) meta.displayName = card.displayName;
  if (card.tags && card.tags.length > 0) meta.tags = card.tags;
  if (card.permission !== 'full') meta.permission = card.permission;
  if (!isNative) meta.engine = card.preferredEngine;
  if (card.model && !isNative) meta.model = card.model;
  if (card.tools && card.tools.length > 0) meta.tools = card.tools;

  let instructions = normalizeText(card.instructions);
  if (card.permission === 'read-only') {
    instructions = instructions ? `${instructions}\n\n${CODEX_READONLY_GUARD}` : CODEX_READONLY_GUARD;
  }

  const lines: string[] = [];
  const comment = metaLine(meta);
  if (comment) lines.push(comment);
  lines.push(`name = ${tomlString(card.name)}`);
  lines.push(`description = ${tomlString(card.role)}`);
  if (card.model && isNative) lines.push(`model = ${tomlString(card.model)}`);
  lines.push(`developer_instructions = ${tomlMultiline(instructions)}`);

  const extra = card.extra?.codex ?? {};
  if (Object.keys(extra).length > 0) {
    // smol-toml은 값(스칼라)을 먼저, 표([table])를 나중에 쓰므로 위 줄들 뒤에 붙여도 안전하다.
    lines.push(stringify(extra).trimEnd());
  }
  return `${lines.join('\n')}\n`;
}

/** Codex TOML 파일 내용 → 카드. 형식이 잘못되면 ConvertError를 던진다. */
export function codexTomlToCard(text: string, options: { id?: string } = {}): AgentCard {
  let data: Record<string, unknown>;
  try {
    data = parse(text) as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : '';
    throw new ConvertError(`TOML 형식을 읽을 수 없어요. ${detail}`.trim());
  }

  const missing = KNOWN_KEYS.filter((key) => typeof data[key] !== 'string' || data[key] === '');
  if (missing.length > 0) {
    throw new ConvertError(
      `Codex 에이전트 파일에 꼭 있어야 하는 항목이 없어요: ${missing.join(', ')}`,
    );
  }

  const meta = readMeta(text);
  const engine = meta.engine ?? 'codex-cli';
  const isNative = engine === 'codex-cli';

  let instructions = normalizeText(data.developer_instructions as string);
  let guardFound = false;
  if (instructions.endsWith(CODEX_READONLY_GUARD)) {
    guardFound = true;
    instructions = instructions.slice(0, -CODEX_READONLY_GUARD.length).trimEnd();
  }

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (KNOWN_KEYS.includes(key)) continue;
    if (key === 'model' && isNative && typeof value === 'string') continue;
    rest[key] = value;
  }

  const name = data.name as string;
  const card: AgentCard = {
    id: options.id ?? newId('card'),
    name,
    displayName: meta.displayName ?? name,
    role: data.description as string,
    instructions,
    preferredEngine: engine,
    permission: meta.permission ?? (guardFound ? 'read-only' : 'full'),
  };
  const model = isNative ? data.model : meta.model;
  if (typeof model === 'string' && model !== '') card.model = model;
  if (meta.tools) card.tools = meta.tools;
  if (meta.tags) card.tags = meta.tags;
  if (Object.keys(rest).length > 0) card.extra = { codex: rest };
  return card;
}

/** 레시피 → 프로젝트 설정(.codex/config.toml) 내용 */
export function recipeToCodexConfig(recipe: Recipe): string {
  const threads = Math.max(1, Math.round(recipe.settings.maxThreads));
  return [
    `# teamcook 레시피: ${recipe.title.replace(/[\r\n]+/g, ' ')}`,
    '# 동시에 열 수 있는 서브에이전트 수 (메인 세션 제외)',
    '[agents]',
    `max_concurrent_threads_per_session = ${threads}`,
    '',
  ].join('\n');
}

/** .codex/config.toml 내용 → 레시피 설정의 일부. 옛 키(max_threads)도 읽는다. */
export function codexConfigToSettings(text: string): { maxThreads?: number; maxDepth?: number } {
  let data: Record<string, unknown>;
  try {
    data = parse(text) as Record<string, unknown>;
  } catch {
    throw new ConvertError('config.toml 형식을 읽을 수 없어요.');
  }
  const agents = (data.agents ?? {}) as Record<string, unknown>;
  const result: { maxThreads?: number; maxDepth?: number } = {};
  const threads = agents.max_concurrent_threads_per_session ?? agents.max_threads;
  if (typeof threads === 'number') result.maxThreads = threads;
  if (typeof agents.max_depth === 'number') result.maxDepth = agents.max_depth;
  return result;
}
