// 바깥에서 들어온 데이터(공유 링크, recipe.json 파일)를 안전한 Recipe로 바꾼다.
// 남이 만든 데이터는 믿지 않는다: 모양을 하나하나 확인하고, 모르는 값은 버리거나 기본값으로 바꾼다.

import {
  RECIPE_SCHEMA_VERSION,
  type AgentCard,
  type CardExtra,
  type Collaboration,
  type Deliverable,
  type EngineId,
  type Handoff,
  type Permission,
  type Recipe,
  type VerificationKind,
  type VerificationRecord,
  type VerificationResult,
  type VerificationSource,
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
const COLLABORATIONS: Collaboration[] = ['subagents', 'agent-team', 'debate'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: VerificationKind[] = ['docs', 'file', 'run', 'unclassified'];
const RESULTS: VerificationResult[] = ['success', 'failure', 'n/a'];
const SOURCES: VerificationSource[] = ['user', 'auto', 'author', 'unknown'];
/** 옛 형식(v1)의 확인 날짜를 옮긴 기록의 id. 고정이라 두 번 옮겨도 하나만 생긴다. */
export const LEGACY_VERIFICATION_ID = 'legacy-date';
const MAX_ITEMS = 30;
const MAX_LINE = 1000;

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

/** 여러 줄 목록 (성공 조건, 완료 기준 등). 빈 줄은 버린다. */
function lineList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.slice(0, MAX_LINE))
    .filter((item) => item.trim() !== '')
    .slice(0, MAX_ITEMS);
  return list.length > 0 ? list : undefined;
}

function parseDeliverables(value: unknown): Deliverable[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const used = new Set<string>();
  const list: Deliverable[] = [];
  for (const item of value.slice(0, MAX_ITEMS)) {
    if (!isObject(item)) continue;
    const name = text(item.name, MAX_SHORT);
    if (name.trim() === '') continue;
    let id = text(item.id, MAX_SHORT);
    if (!id || used.has(id)) id = newId('out');
    used.add(id);
    const deliverable: Deliverable = { id, name };
    const description = text(item.description, MAX_LINE);
    if (description) deliverable.description = description;
    list.push(deliverable);
  }
  return list.length > 0 ? list : undefined;
}

function parseVerification(value: unknown): VerificationRecord[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const list: VerificationRecord[] = [];
  for (const item of value.slice(0, MAX_ITEMS)) {
    if (!isObject(item)) continue;
    // 날짜가 없는 기록은 버린다. 모르는 종류·결과·출처는 '모름' 쪽으로 낮춘다 (성공으로 올리지 않는다).
    if (typeof item.checkedAt !== 'string' || !DATE_PATTERN.test(item.checkedAt)) continue;
    let id = text(item.id, MAX_SHORT);
    if (!id || used.has(id)) id = newId('check');
    used.add(id);
    const record: VerificationRecord = {
      id,
      kind: KINDS.includes(item.kind as VerificationKind) ? (item.kind as VerificationKind) : 'unclassified',
      checkedAt: item.checkedAt,
      result: RESULTS.includes(item.result as VerificationResult) ? (item.result as VerificationResult) : 'n/a',
      source: SOURCES.includes(item.source as VerificationSource) ? (item.source as VerificationSource) : 'unknown',
    };
    for (const key of ['tool', 'toolVersion', 'environment'] as const) {
      const field = text(item[key], MAX_SHORT);
      if (field) record[key] = field;
    }
    const note = text(item.note, MAX_LINE);
    if (note) record.note = note;
    list.push(record);
  }
  return list;
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
  if (isObject(value.antigravity)) extra.antigravity = value.antigravity;
  if (isObject(value.grok)) extra.grok = value.grok;
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
  const requiredInputs = lineList(value.requiredInputs);
  if (requiredInputs) card.requiredInputs = requiredInputs;
  const deliverables = parseDeliverables(value.deliverables);
  if (deliverables) card.deliverables = deliverables;
  const completionCriteria = lineList(value.completionCriteria);
  if (completionCriteria) card.completionCriteria = completionCriteria;
  const boundaries = lineList(value.boundaries);
  if (boundaries) card.boundaries = boundaries;
  const extra = parseExtra(value.extra);
  if (extra) card.extra = extra;
  return card;
}

/**
 * 알 수 없는 값을 Recipe로 바꾼다. 형식이 맞지 않으면 RecipeFormatError를 던진다.
 *
 * 하위 호환 (옛 버전 → 지금 버전). 여러 번 적용해도 결과가 같다.
 * - v1 → v2: 확인 날짜(lastVerified)를 '확인 방식 미기록' 기록 하나로 옮긴다. 날짜는 그대로 두고,
 *   실제 실행에 성공했다는 기록으로 올리지 않는다. 새로 생긴 항목(학습 목표, 산출물 등)은 비워 둔다.
 * - 더 새로운 버전은 읽지 않고 거절한다 (모르는 항목을 조용히 버리지 않으려고).
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
      // 지워진 산출물을 가리키는 id도 그대로 둔다 (화면에서 '재선택 필요'로 알려 준다)
      const deliverableIds = stringList(item.deliverableIds, MAX_ITEMS);
      if (deliverableIds) handoff.deliverableIds = deliverableIds;
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
  // 조리법: 없으면(옛 링크) 그대로 비워 두고, 모르는 값이면 'subagents'로 바꾼다
  if (raw.collaboration !== undefined) {
    recipe.collaboration = COLLABORATIONS.includes(raw.collaboration as Collaboration)
      ? (raw.collaboration as Collaboration)
      : 'subagents';
  }
  const learningObjective = text(raw.learningObjective, MAX_LINE);
  if (learningObjective) recipe.learningObjective = learningObjective;
  const sampleTask = text(raw.sampleTask, MAX_LONG);
  if (sampleTask) recipe.sampleTask = sampleTask;
  const successCriteria = lineList(raw.successCriteria);
  if (successCriteria) recipe.successCriteria = successCriteria;
  const prerequisites = lineList(raw.prerequisites);
  if (prerequisites) recipe.prerequisites = prerequisites;

  const verification = parseVerification(raw.verification);
  // v1의 확인 날짜: 무엇을 어떻게 확인했는지 모르므로 '미기록'으로 옮긴다
  if (
    typeof raw.lastVerified === 'string' &&
    DATE_PATTERN.test(raw.lastVerified) &&
    !verification.some((record) => record.id === LEGACY_VERIFICATION_ID)
  ) {
    verification.push({
      id: LEGACY_VERIFICATION_ID,
      kind: 'unclassified',
      checkedAt: raw.lastVerified,
      result: 'n/a',
      source: 'unknown',
    });
  }
  if (verification.length > 0) recipe.verification = verification;
  const author = text(raw.author, MAX_SHORT);
  if (author) recipe.author = author;
  const howToRun = text(raw.howToRun, MAX_LONG);
  if (howToRun) recipe.howToRun = howToRun;
  return recipe;
}
