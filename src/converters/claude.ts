// Claude Code 서브에이전트(.claude/agents/<name>.md) ↔ AgentCard 변환.
//
// 2026-11-16 공식 문서 확인 (https://code.claude.com/docs/en/sub-agents):
// - YAML 머리말(---) + 본문. 본문이 시스템 프롬프트다.
// - 필수: name, description / 선택: tools, disallowedTools, model, permissionMode, maxTurns,
//   skills, mcpServers, hooks, memory, background, effort, isolation, color, initialPrompt 등
//   → 모르는 필드는 extra.claude에 그대로 보관한다.
// - tools는 쉼표로 구분한 글자 또는 YAML 목록. 생략하면 모든 도구를 물려받는다.
// - 서브에이전트의 permissionMode로 권한을 "늘릴" 수는 없다(부모가 우선).
//   → 권한은 tools 목록으로만 표현한다: 읽기 전용 = 읽기 도구만, full = tools 생략.

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { AgentCard, Permission } from '../types';
import { newId } from '../lib/id';
import { type CardMeta, ConvertError, metaLine, normalizeText, readMeta } from './meta';

/** 읽기 전용 카드의 기본 도구 */
export const CLAUDE_READONLY_TOOLS = ['Read', 'Grep', 'Glob'];
/** 편집 카드의 기본 도구 */
export const CLAUDE_EDIT_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'];

/** 파일을 바꾸거나 명령을 실행할 수 있는 도구 */
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash', 'PowerShell']);

const KNOWN_KEYS = ['name', 'description', 'tools'];

function defaultTools(permission: Permission): string[] | undefined {
  if (permission === 'read-only') return CLAUDE_READONLY_TOOLS;
  if (permission === 'edit') return CLAUDE_EDIT_TOOLS;
  return undefined;
}

/** 도구 목록에서 권한을 짐작한다. 예: ['Read','Grep'] → 'read-only' */
export function permissionFromTools(tools: string[] | undefined): Permission {
  if (!tools) return 'full';
  const canWrite = tools.some((tool) => WRITE_TOOLS.has(tool.split('(')[0].trim()));
  return canWrite ? 'edit' : 'read-only';
}

/** 'Read, Bash(git diff:*, git log:*)' 처럼 괄호 안에 쉼표가 있어도 올바르게 나눈다. */
function splitTools(value: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function sameList(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** 카드 → Claude Code 서브에이전트 파일 내용 */
export function cardToClaudeMd(card: AgentCard): string {
  const isNative = card.preferredEngine === 'claude-code';
  const tools = card.tools && card.tools.length > 0 ? card.tools : defaultTools(card.permission);

  const meta: CardMeta = {};
  if (card.displayName && card.displayName !== card.name) meta.displayName = card.displayName;
  if (card.tags && card.tags.length > 0) meta.tags = card.tags;
  if (permissionFromTools(tools) !== card.permission) meta.permission = card.permission;
  if (!isNative) meta.engine = card.preferredEngine;
  if (card.model && !isNative) meta.model = card.model;

  const frontmatter: Record<string, unknown> = {
    name: card.name,
    description: card.role,
  };
  if (tools) frontmatter.tools = tools.join(', ');
  if (card.model && isNative) frontmatter.model = card.model;
  Object.assign(frontmatter, card.extra?.claude ?? {});

  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd();
  const comment = metaLine(meta);
  const head = comment ? `${comment}\n${yaml}` : yaml;
  return `---\n${head}\n---\n\n${normalizeText(card.instructions)}\n`;
}

/** Claude Code 서브에이전트 파일 내용 → 카드. 형식이 잘못되면 ConvertError를 던진다. */
export function claudeMdToCard(text: string, options: { id?: string } = {}): AgentCard {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/.exec(normalized.trimStart());
  if (!match) {
    throw new ConvertError(
      'Claude 서브에이전트 파일은 맨 위에 ---로 감싼 머리말(name, description)이 있어야 해요.',
    );
  }

  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : '';
    throw new ConvertError(`머리말(YAML)을 읽을 수 없어요. ${detail}`.trim());
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ConvertError('머리말(YAML)에 name과 description이 없어요.');
  }
  const fields = data as Record<string, unknown>;

  const missing = ['name', 'description'].filter(
    (key) => fields[key] === undefined || fields[key] === null || fields[key] === '',
  );
  if (missing.length > 0) {
    throw new ConvertError(
      `Claude 서브에이전트 파일에 꼭 있어야 하는 항목이 없어요: ${missing.join(', ')}`,
    );
  }

  const meta = readMeta(match[1]);
  const engine = meta.engine ?? 'claude-code';
  const isNative = engine === 'claude-code';

  let tools: string[] | undefined;
  if (typeof fields.tools === 'string') tools = splitTools(fields.tools);
  else if (Array.isArray(fields.tools)) tools = fields.tools.map((tool) => String(tool).trim());

  const permission = meta.permission ?? permissionFromTools(tools);

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (KNOWN_KEYS.includes(key)) continue;
    if (key === 'model' && isNative && typeof value === 'string') continue;
    rest[key] = value;
  }

  const name = String(fields.name);
  const card: AgentCard = {
    id: options.id ?? newId('card'),
    name,
    displayName: meta.displayName ?? name,
    role: String(fields.description),
    instructions: normalizeText(match[2] ?? ''),
    preferredEngine: engine,
    permission,
  };
  const model = isNative ? fields.model : meta.model;
  if (typeof model === 'string' && model !== '') card.model = model;
  // 권한의 기본 도구 목록과 똑같으면 따로 적지 않는다 (다시 내보낼 때 같은 목록이 나온다)
  if (tools && !sameList(tools, defaultTools(permission))) card.tools = tools;
  if (meta.tags) card.tags = meta.tags;
  if (Object.keys(rest).length > 0) card.extra = { claude: rest };
  return card;
}
