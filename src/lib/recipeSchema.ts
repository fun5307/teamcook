// 바깥에서 들어온 데이터(공유 링크, recipe.json 파일)를 안전한 Recipe로 바꾼다.
// 남이 만든 데이터는 믿지 않는다: 모양을 하나하나 확인하고, 모르는 값은 버리거나 기본값으로 바꾼다.

import {
  RECIPE_SCHEMA_VERSION,
  type AgentCard,
  type CardExtra,
  type EngineId,
  type Handoff,
  type Permission,
  type Recipe,
} from '../types';
import { newId } from './id';

export class RecipeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeFormatError';
  }
}

const ENGINES: EngineId[] = [
  'codex-cli',
  'claude-code',
  'antigravity-cli',
  'grok-build',
  'api',
  'manual',
];
const PERMISSIONS: Permission[] = ['read-only', 'edit', 'full'];

const MAX_CARDS = 30;
const MAX_HANDOFFS = 100;
const MAX_SHORT = 300;
const MAX_LONG = 20000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function stringList(value: unknown, maxItems: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxItems)
    .map((item) => item.slice(0, MAX_SHORT));
  return list.length > 0 ? list : undefined;
}

function wholeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseExtra(value: unknown): CardExtra | undefined {
  if (!isObject(value)) return undefined;
  const extra: CardExtra = {};
  if (isObject(value.codex)) extra.codex = value.codex;
  if (isObject(value.claude)) extra.claude = value.claude;
  return Object.keys(extra).length > 0 ? extra : undefined;
}

function parseCard(value: unknown, usedIds: Set<string>): AgentCard | null {
  if (!isObject(value)) return null;
  const name = text(value.name, MAX_SHORT).trim();
  if (!name) return null;

  let id = text(value.id, MAX_SHORT);
  if (!id || usedIds.has(id)) id = newId('card');
  usedIds.add(id);

  const card: AgentCard = {
    id,
    name,
    displayName: text(value.displayName, MAX_SHORT) || name,
    role: text(value.role, MAX_LONG),
    instructions: text(value.instructions, MAX_LONG),
    preferredEngine: ENGINES.includes(value.preferredEngine as EngineId)
      ? (value.preferredEngine as EngineId)
      : 'codex-cli',
    permission: PERMISSIONS.includes(value.permission as Permission)
      ? (value.permission as Permission)
      : 'full',
  };
  const model = text(value.model, MAX_SHORT);
  if (model) card.model = model;
  const tools = stringList(value.tools, 50);
  if (tools) card.tools = tools;
  const tags = stringList(value.tags, 10);
  if (tags) card.tags = tags;
  const extra = parseExtra(value.extra);
  if (extra) card.extra = extra;
  return card;
}

/**
 * 알 수 없는 값을 Recipe로 바꾼다. 형식이 맞지 않으면 RecipeFormatError를 던진다.
 * 공유 링크 하위 호환: 새 schemaVersion을 만들면 여기에 "옛 버전 → 새 버전" 변환을 추가한다.
 */
export function parseRecipe(raw: unknown): Recipe {
  if (!isObject(raw)) {
    throw new RecipeFormatError('레시피 데이터가 아니에요.');
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number') {
    throw new RecipeFormatError('레시피 형식 버전(schemaVersion)이 없어요.');
  }
  if (version > RECIPE_SCHEMA_VERSION) {
    throw new RecipeFormatError(
      '이 레시피는 더 새로운 버전에서 만들어졌어요. 페이지를 새로고침한 뒤 다시 열어 보세요.',
    );
  }
  if (version < 1) {
    throw new RecipeFormatError('알 수 없는 레시피 형식 버전이에요.');
  }
  if (!Array.isArray(raw.cards)) {
    throw new RecipeFormatError('레시피에 카드 목록이 없어요.');
  }

  const usedIds = new Set<string>();
  const cards = raw.cards
    .slice(0, MAX_CARDS)
    .map((item) => parseCard(item, usedIds))
    .filter((card): card is AgentCard => card !== null);

  const handoffs: Handoff[] = [];
  if (Array.isArray(raw.handoffs)) {
    for (const item of raw.handoffs.slice(0, MAX_HANDOFFS)) {
      if (!isObject(item)) continue;
      const from = text(item.from, MAX_SHORT);
      const to = text(item.to, MAX_SHORT);
      // 없는 카드를 가리키는 화살표는 버린다
      if (!usedIds.has(from) || !usedIds.has(to)) continue;
      const handoff: Handoff = { id: text(item.id, MAX_SHORT) || newId('handoff'), from, to };
      const label = text(item.label, MAX_SHORT);
      if (label) handoff.label = label;
      handoffs.push(handoff);
    }
  }

  const settings = isObject(raw.settings) ? raw.settings : {};
  const recipe: Recipe = {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: text(raw.id, MAX_SHORT) || newId('recipe'),
    title: text(raw.title, MAX_SHORT).trim() || '이름 없는 레시피',
    summary: text(raw.summary, MAX_LONG),
    useCase: text(raw.useCase, MAX_SHORT),
    cards,
    handoffs,
    settings: {
      maxThreads: wholeNumber(settings.maxThreads, 3, 1, 20),
      maxDepth: wholeNumber(settings.maxDepth, 1, 1, 5),
    },
  };
  const author = text(raw.author, MAX_SHORT);
  if (author) recipe.author = author;
  const howToRun = text(raw.howToRun, MAX_LONG);
  if (howToRun) recipe.howToRun = howToRun;
  return recipe;
}
