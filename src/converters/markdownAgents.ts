// Antigravity CLI(.agents/agents/<name>.md)와 Grok Build(.grok/agents/<name>.md) ↔ AgentCard 변환.
// 둘 다 Claude Code처럼 "YAML 머리말 + 본문(시스템 프롬프트)" 형식이다.
//
// 2026-11-16 공식 문서 확인
// - Antigravity: https://antigravity.google/docs/subagents
//   필수 name, description / 선택 tools(목록), mainAgent, subagent, model(inherit|flash|pro),
//   commandExecutionPolicy, mcpServers, skills, plugins.
//   주의: tools에 없는 도구 이름을 쓰면 서브에이전트가 멈출 수 있다고 문서에 적혀 있다.
//   그래서 문서에 나온 이름(view_file, grep_search, replace_file_content, run_command)만 쓴다.
// - Grok Build: https://docs.x.ai/build/features/subagents 와 xai-org/grok-build 저장소의 사용자 안내서
//   위치와 "YAML 머리말이 있는 마크다운"이라는 점, 예시의 name·description·tools만 확인했다.
//   도구 이름 전체 목록은 확인하지 못해서 tools를 만들어 쓰지 않는다.
//   읽기 전용은 Codex처럼 지시문 끝 문장으로 표현한다.

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { AgentCard, EngineId, Permission } from '../types';
import { newId } from '../lib/id';
import { CODEX_READONLY_GUARD } from './codex';
import { type CardMeta, ConvertError, metaLine, normalizeText, readMeta } from './meta';

interface Format {
  engine: EngineId;
  /** extra 안에서 이 형식 전용 필드를 보관하는 이름 */
  extraKey: 'antigravity' | 'grok';
  label: string;
  /** 권한별 기본 도구. 없으면 tools를 쓰지 않고 지시문 끝 문장으로 읽기 전용을 표현한다. */
  tools?: { readOnly: string[]; edit: string[]; write: string[] };
  /** 겉모습이 Claude 형식과 같아서, 주석에 형식 표시를 남겨야 하는지 */
  tagFormat: boolean;
}

const ANTIGRAVITY: Format = {
  engine: 'antigravity-cli',
  extraKey: 'antigravity',
  label: 'Antigravity',
  tools: {
    readOnly: ['view_file', 'grep_search'],
    edit: ['view_file', 'grep_search', 'replace_file_content', 'run_command'],
    write: ['replace_file_content', 'run_command'],
  },
  tagFormat: false,
};

const GROK: Format = {
  engine: 'grok-build',
  extraKey: 'grok',
  label: 'Grok Build',
  tagFormat: true,
};

function sameList(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function toList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((item) => String(item).trim());
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}

function defaultTools(format: Format, permission: Permission): string[] | undefined {
  if (!format.tools || permission === 'full') return undefined;
  return permission === 'read-only' ? format.tools.readOnly : format.tools.edit;
}

function permissionFromTools(format: Format, tools: string[] | undefined): Permission {
  if (!format.tools || !tools) return 'full';
  return tools.some((tool) => format.tools!.write.includes(tool)) ? 'edit' : 'read-only';
}

function toMarkdown(card: AgentCard, format: Format): string {
  const isNative = card.preferredEngine === format.engine;
  const own = (card.extra?.[format.extraKey] ?? {}) as Record<string, unknown>;
  const { tools: savedTools, ...rest } = own;
  const tools = toList(savedTools) ?? defaultTools(format, card.permission);

  const meta: CardMeta = {};
  if (card.displayName && card.displayName !== card.name) meta.displayName = card.displayName;
  if (card.tags && card.tags.length > 0) meta.tags = card.tags;
  if (permissionFromTools(format, tools) !== card.permission) meta.permission = card.permission;
  if (!isNative) meta.engine = card.preferredEngine;
  if (card.model && !isNative) meta.model = card.model;
  if (card.tools && card.tools.length > 0) meta.tools = card.tools;
  if (format.tagFormat) meta.format = 'grok';

  const frontmatter: Record<string, unknown> = { name: card.name, description: card.role };
  if (tools) frontmatter.tools = tools;
  if (card.model && isNative) frontmatter.model = card.model;
  Object.assign(frontmatter, rest);

  let instructions = normalizeText(card.instructions);
  // 도구 목록으로 막을 수 없는 형식은 지시문 끝에 '수정하지 마라' 문장을 붙인다
  if (!format.tools && card.permission === 'read-only') {
    instructions = instructions ? `${instructions}\n\n${CODEX_READONLY_GUARD}` : CODEX_READONLY_GUARD;
  }

  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd();
  const comment = metaLine(meta);
  return `---\n${comment ? `${comment}\n` : ''}${yaml}\n---\n\n${instructions}\n`;
}

function fromMarkdown(text: string, format: Format, options: { id?: string }): AgentCard {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/.exec(normalized.trimStart());
  if (!match) {
    throw new ConvertError(
      `${format.label} 에이전트 파일은 맨 위에 ---로 감싼 머리말(name, description)이 있어야 해요.`,
    );
  }
  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch {
    throw new ConvertError('머리말(YAML)을 읽을 수 없어요.');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ConvertError('머리말(YAML)에 name과 description이 없어요.');
  }
  const fields = data as Record<string, unknown>;
  const missing = ['name', 'description'].filter((key) => !fields[key]);
  if (missing.length > 0) {
    throw new ConvertError(
      `${format.label} 에이전트 파일에 꼭 있어야 하는 항목이 없어요: ${missing.join(', ')}`,
    );
  }

  const meta = readMeta(match[1]);
  const engine = meta.engine ?? format.engine;
  const isNative = engine === format.engine;
  const tools = toList(fields.tools);

  let instructions = normalizeText(match[2] ?? '');
  let guardFound = false;
  if (!format.tools && instructions.endsWith(CODEX_READONLY_GUARD)) {
    guardFound = true;
    instructions = instructions.slice(0, -CODEX_READONLY_GUARD.length).trimEnd();
  }
  const permission =
    meta.permission ?? (guardFound ? 'read-only' : permissionFromTools(format, tools));

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'name' || key === 'description') continue;
    if (key === 'model' && isNative && typeof value === 'string') continue;
    // 권한의 기본 도구 목록과 똑같으면 따로 보관하지 않는다
    if (key === 'tools' && sameList(tools, defaultTools(format, permission))) continue;
    rest[key] = key === 'tools' ? tools : value;
  }

  const name = String(fields.name);
  const card: AgentCard = {
    id: options.id ?? newId('card'),
    name,
    displayName: meta.displayName ?? name,
    role: String(fields.description),
    instructions,
    preferredEngine: engine,
    permission,
  };
  const model = isNative ? fields.model : meta.model;
  if (typeof model === 'string' && model !== '') card.model = model;
  if (meta.tools) card.tools = meta.tools;
  if (meta.tags) card.tags = meta.tags;
  if (Object.keys(rest).length > 0) card.extra = { [format.extraKey]: rest };
  return card;
}

/** 카드 → Antigravity 커스텀 에이전트 파일 내용 */
export const cardToAntigravityMd = (card: AgentCard) => toMarkdown(card, ANTIGRAVITY);
/** Antigravity 커스텀 에이전트 파일 내용 → 카드 */
export const antigravityMdToCard = (text: string, options: { id?: string } = {}) =>
  fromMarkdown(text, ANTIGRAVITY, options);

/** 카드 → Grok Build 에이전트 파일 내용 */
export const cardToGrokMd = (card: AgentCard) => toMarkdown(card, GROK);
/** Grok Build 에이전트 파일 내용 → 카드 */
export const grokMdToCard = (text: string, options: { id?: string } = {}) =>
  fromMarkdown(text, GROK, options);

/**
 * .md 에이전트 파일이 어느 도구의 형식인지 짐작한다.
 * Antigravity는 고유한 머리말 항목·도구 이름으로, Grok은 우리가 적어 둔 주석으로 알아본다.
 * 나머지는 Claude Code 형식으로 본다.
 */
export function detectMarkdownEngine(text: string): 'claude-code' | 'antigravity-cli' | 'grok-build' {
  const head = /^﻿?\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  if (/^(mainAgent|subagent|commandExecutionPolicy)\s*:/m.test(head)) return 'antigravity-cli';
  if (/\b(view_file|grep_search|replace_file_content|run_command)\b/.test(head)) return 'antigravity-cli';
  if (readMeta(head).format === 'grok') return 'grok-build';
  return 'claude-code';
}
