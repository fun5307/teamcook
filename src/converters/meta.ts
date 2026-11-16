// 설정 파일 맨 위에 붙이는 한 줄 주석 "# teamcook: {...}".
// (이름을 확정하기 전에 내보낸 파일의 "# agent-recipes: {...}"도 계속 읽는다.)
// Codex TOML이나 Claude 머리말에는 자리가 없는 카드 정보(표시 이름, 역할 태그, 권한 등)를
// 주석으로 실어 두었다가, 다시 불러올 때 되살린다. 주석이라 Codex·Claude Code는 무시한다.

import type { EngineId, Permission } from '../types';

export interface CardMeta {
  displayName?: string;
  tags?: string[];
  permission?: Permission;
  engine?: EngineId;
  /** 이 형식의 엔진용이 아니라서 model 필드에 쓰지 못한 모델 이름 */
  model?: string;
  /** Claude용 도구 목록 (Codex TOML에 실어 둘 때만) */
  tools?: string[];
}

export class ConvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConvertError';
  }
}

const META_PATTERN = /^[ \t]*#[ \t]*(?:teamcook|agent-recipes):[ \t]*(\{.*\})[ \t]*$/m;

const PERMISSIONS: Permission[] = ['read-only', 'edit', 'full'];
const ENGINES: EngineId[] = [
  'codex-cli',
  'claude-code',
  'antigravity-cli',
  'grok-build',
  'api',
  'manual',
];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** 파일 내용에서 메타 주석을 찾아 읽는다. 없거나 깨졌으면 빈 객체. */
export function readMeta(text: string): CardMeta {
  const match = META_PATTERN.exec(text);
  if (!match) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const meta: CardMeta = {};
  if (typeof source.displayName === 'string') meta.displayName = source.displayName;
  if (isStringArray(source.tags)) meta.tags = source.tags;
  if (PERMISSIONS.includes(source.permission as Permission)) {
    meta.permission = source.permission as Permission;
  }
  if (ENGINES.includes(source.engine as EngineId)) meta.engine = source.engine as EngineId;
  if (typeof source.model === 'string') meta.model = source.model;
  if (isStringArray(source.tools)) meta.tools = source.tools;
  return meta;
}

/** 메타 주석 한 줄을 만든다. 실을 정보가 없으면 null. */
export function metaLine(meta: CardMeta): string | null {
  if (Object.keys(meta).length === 0) return null;
  return `# teamcook: ${JSON.stringify(meta)}`;
}

/** 줄바꿈을 \n으로 통일하고 앞뒤 공백을 정리한다. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}
