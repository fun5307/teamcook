// 주문 저장·불러오기·JSON 내보내기·가져오기.
// 저장 이름은 'teamcook-orders'로 레시피·실습 기록과 따로다. 저장에 실패하면 이전 내용을 그대로 두고 실패를 알린다.
// 바깥에서 온 데이터는 모양을 확인하고, 모르는 값은 기본값으로 낮춘다. 자료 본문과 링크는 글자로만 다룬다.

import { newId } from '../id';
import { isZonedIso, nowIso } from '../practice/time';
import type { Collaboration, EngineId, Permission, RoleTag } from '../../types';
import {
  ORDER_SCHEMA_VERSION,
  type Assignment,
  type Dependency,
  type Material,
  type OpenQuestion,
  type OrderDraft,
  type OrderRole,
  type Requirement,
  type WorkItem,
} from './types';

export class OrderFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderFormatError';
  }
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 4000) => (typeof value === 'string' ? value.slice(0, max) : '');
const list = (value: unknown, max = 200): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const strings = (value: unknown) => list(value, 50).filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 1000));
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

const TAGS: RoleTag[] = ['writer', 'implementer', 'reviewer', 'researcher', 'planner', 'synthesizer'];
const ENGINES: EngineId[] = ['codex-cli', 'claude-code', 'antigravity-cli', 'grok-build', 'api', 'manual'];
const PERMS: Permission[] = ['read-only', 'edit', 'full'];
const STYLES: Collaboration[] = ['subagents', 'agent-team', 'debate'];
const STATES = ['proposed', 'accepted', 'excluded'] as const;

function evidence(value: unknown) {
  if (!isObject(value)) return undefined;
  const sourceId = text(value.sourceId, 200);
  return sourceId ? { sourceId, excerpt: text(value.excerpt, 300) } : undefined;
}

function material(value: unknown): Material | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 200);
  if (!id) return null;
  const item: Material = {
    id,
    name: text(value.name, 300) || '이름 없는 자료',
    kind: pick(value.kind, ['text', 'file', 'link'] as const, 'text'),
    status: pick(value.status, ['read', 'reference', 'failed'] as const, 'failed'),
  };
  // 링크는 주소로만 저장한다. 본문을 읽은 것으로 바꿀 수 없다.
  if (item.kind === 'link') item.status = 'reference';
  const content = text(value.content, 1_100_000);
  if (content && item.status === 'read') item.content = content;
  const url = text(value.url, 2000);
  if (url) item.url = url;
  const error = text(value.error, 300);
  if (error) item.error = error;
  if (typeof value.size === 'number' && Number.isFinite(value.size)) item.size = value.size;
  return item;
}

function requirement(value: unknown): Requirement | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 200);
  const body = text(value.text, 2000);
  if (!id || !body.trim()) return null;
  const item: Requirement = {
    id,
    kind: pick(value.kind, ['goal', 'deliverable', 'current', 'constraint', 'exclusion', 'success'] as const, 'constraint'),
    text: body,
    source: pick(value.source, ['explicit', 'rule', 'user', 'assumption'] as const, 'rule'),
    state: pick(value.state, STATES, 'proposed'),
  };
  const found = evidence(value.evidence);
  if (found) item.evidence = found;
  return item;
}

function question(value: unknown): OpenQuestion | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 200);
  const body = text(value.text, 1000);
  if (!id || !body) return null;
  const item: OpenQuestion = {
    id,
    text: body,
    state: pick(value.state, ['open', 'answered', 'undecided', 'later'] as const, 'open'),
    mustDecide: value.mustDecide === true,
    affects: strings(value.affects),
  };
  const options = strings(value.options);
  if (options.length > 0) item.options = options;
  const answer = text(value.answer, 1000);
  if (answer) item.answer = answer;
  return item;
}

function work(value: unknown): WorkItem | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 200);
  if (!id) return null;
  const item: WorkItem = {
    id,
    title: text(value.title, 300) || '이름 없는 작업',
    description: text(value.description, 4000),
    inputs: strings(value.inputs),
    outputs: list(value.outputs, 30)
      .filter(isObject)
      .map((output) => ({ id: text(output.id, 200), name: text(output.name, 300) }))
      .filter((output) => output.id && output.name),
    criteria: strings(value.criteria),
    overrides: strings(value.overrides),
    checkpoint: value.checkpoint === true,
    required: value.required !== false,
    origin: value.origin === 'user' ? 'user' : 'rule',
    state: pick(value.state, STATES, 'proposed'),
    type: pick(value.type, TAGS, 'implementer'),
  };
  const found = evidence(value.evidence);
  if (found) item.evidence = found;
  return item;
}

function dependency(value: unknown): Dependency | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 200);
  const from = text(value.from, 200);
  const to = text(value.to, 200);
  if (!id || !from || !to) return null;
  return { id, from, to, outputIds: strings(value.outputIds), note: text(value.note, 500) };
}

function role(value: unknown): OrderRole | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 200);
  const name = text(value.name, 100);
  if (!id || !name) return null;
  const item: OrderRole = {
    id,
    name,
    displayName: text(value.displayName, 200) || name,
    tag: pick(value.tag, TAGS, 'implementer'),
    engine: pick(value.engine, ENGINES, 'claude-code'),
    permission: pick(value.permission, PERMS, 'read-only'),
  };
  if (isObject(value.template) && text(value.template.recipeId) && text(value.template.cardId)) {
    item.template = { recipeId: text(value.template.recipeId, 200), cardId: text(value.template.cardId, 200) };
  }
  if (value.fromWorkspace === true) item.fromWorkspace = true;
  return item;
}

function assignment(value: unknown): Assignment | null {
  if (!isObject(value)) return null;
  const workId = text(value.workId, 200);
  const roleId = text(value.roleId, 200);
  if (!workId || !roleId) return null;
  return { workId, roleId, responsibility: value.responsibility === 'reviewer' ? 'reviewer' : 'owner' };
}

const compact = <T,>(items: (T | null)[]) => items.filter((item): item is T => item !== null);

export function parseOrder(raw: unknown): OrderDraft {
  if (!isObject(raw)) throw new OrderFormatError('주문 데이터가 아니에요.');
  if (typeof raw.schemaVersion !== 'number') throw new OrderFormatError('주문 형식 버전이 없어요.');
  if (raw.schemaVersion > ORDER_SCHEMA_VERSION) throw new OrderFormatError('더 새로운 버전에서 만든 주문이에요. 페이지를 새로고침해 보세요.');
  const id = text(raw.id, 200);
  if (!id) throw new OrderFormatError('주문에 id가 없어요.');
  const createdAt = isZonedIso(raw.createdAt) ? raw.createdAt : nowIso();
  const request = isObject(raw.request) ? raw.request : {};
  const order: OrderDraft = {
    schemaVersion: ORDER_SCHEMA_VERSION,
    id,
    revision: typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision > 0 ? raw.revision : 1,
    status: pick(raw.status, ['draft', 'designing', 'ready'] as const, 'draft'),
    step: pick(raw.step, ['request', 'define', 'work', 'team', 'ready'] as const, 'request'),
    createdAt,
    updatedAt: isZonedIso(raw.updatedAt) ? raw.updatedAt : createdAt,
    title: text(raw.title, 300),
    request: {
      text: text(request.text, 200_000),
      materials: compact(list(request.materials, 10).map(material)),
    },
    requirements: compact(list(raw.requirements).map(requirement)),
    questions: compact(list(raw.questions, 50).map(question)),
    work: compact(list(raw.work, 100).map(work)),
    deps: compact(list(raw.deps, 300).map(dependency)),
    roles: compact(list(raw.roles, 30).map(role)),
    assignments: compact(list(raw.assignments, 300).map(assignment)),
    style: pick(raw.style, STYLES, 'subagents'),
    detected: strings(raw.detected),
  };
  if (typeof request.textAtDraft === 'string') order.request.textAtDraft = request.textAtDraft.slice(0, 200_000);
  if (raw.scope === 'quick' || raw.scope === 'evidence' || raw.scope === 'alternatives') order.scope = raw.scope;
  if (isObject(raw.recommendation)) {
    order.recommendation = {
      pattern: text(raw.recommendation.pattern, 200),
      reasons: strings(raw.recommendation.reasons),
      state: pick(raw.recommendation.state, STATES, 'proposed'),
      ...(text(raw.recommendation.recipeId) ? { recipeId: text(raw.recommendation.recipeId, 200) } : {}),
    };
  }
  if (isObject(raw.link) && text(raw.link.recipeId) && typeof raw.link.orderRevision === 'number') {
    order.link = { recipeId: text(raw.link.recipeId, 200), orderRevision: raw.link.orderRevision, fingerprint: text(raw.link.fingerprint, 200) };
  }
  const source = text(raw.sourceRecipeId, 200);
  if (source) order.sourceRecipeId = source;
  return order;
}

// ───────────────────────── 브라우저 저장 ─────────────────────────

export const ORDER_STORAGE_KEY = 'teamcook-orders';
export const ORDER_STORAGE_LIMIT = 3_000_000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStorage = (): StorageLike | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export interface OrderData {
  version: 1;
  orders: OrderDraft[];
  unreadable: unknown[];
}

export function loadOrders(storage: StorageLike | null = defaultStorage()): OrderData {
  const empty: OrderData = { version: 1, orders: [], unreadable: [] };
  if (!storage) return empty;
  let raw: string | null = null;
  try {
    raw = storage.getItem(ORDER_STORAGE_KEY);
  } catch {
    return empty;
  }
  if (!raw) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...empty, unreadable: [raw] };
  }
  const data: OrderData = { version: 1, orders: [], unreadable: [] };
  const items = [...(isObject(parsed) && Array.isArray(parsed.orders) ? parsed.orders : []), ...(isObject(parsed) && Array.isArray(parsed.unreadable) ? parsed.unreadable : [])];
  const seen = new Set<string>();
  for (const item of items) {
    try {
      const order = parseOrder(item);
      if (seen.has(order.id)) continue;
      seen.add(order.id);
      data.orders.push(order);
    } catch {
      data.unreadable.push(item);
    }
  }
  return data;
}

export type SaveResult = { ok: true } | { ok: false; message: string };

export function saveOrders(data: OrderData, storage: StorageLike | null = defaultStorage()): SaveResult {
  if (!storage) return { ok: false, message: '이 브라우저에서는 저장 공간을 쓸 수 없어요.' };
  const json = JSON.stringify(data);
  if (json.length > ORDER_STORAGE_LIMIT) {
    return { ok: false, message: `저장할 내용이 너무 커요(${Math.round(json.length / 1000).toLocaleString()}KB). 큰 자료를 지우거나 주문을 JSON으로 내보낸 뒤 정리해 주세요.` };
  }
  try {
    storage.setItem(ORDER_STORAGE_KEY, json);
    return { ok: true };
  } catch {
    return { ok: false, message: '브라우저 저장 공간에 저장하지 못했어요. 바뀐 내용은 저장되지 않았어요.' };
  }
}

// ───────────────────────── JSON 내보내기·가져오기 ─────────────────────────

export const ORDER_EXPORT_FORMAT = 'teamcook-order';
export const ORDER_IMPORT_LIMIT = 6_000_000;

/** 내보낼 JSON. 자료 본문은 기본으로 빼고, 사용자가 고르면 넣는다. 만든 레시피와의 연결은 뺀다. */
export function exportOrder(order: OrderDraft, options: { materialContent: boolean }): string {
  const copy: OrderDraft = structuredClone(order);
  delete copy.link;
  if (!options.materialContent) {
    copy.request.materials = copy.request.materials.map((item) => {
      const { content: _content, ...rest } = item;
      void _content;
      return item.status === 'read' ? { ...rest, status: 'failed' as const, error: '보낸 쪽에서 본문을 빼고 내보냈어요.' } : rest;
    });
  }
  return JSON.stringify({ format: ORDER_EXPORT_FORMAT, version: 1, exportedAt: nowIso(), omitted: options.materialContent ? [] : ['자료 본문'], order: copy }, null, 2);
}

/** 가져오기: 검사 후 새 주문을 돌려준다. id가 겹치면 새 id를 준다. 실패하면 이유를 던진다. */
export function importOrder(textValue: string, existing: OrderDraft[]): OrderDraft {
  if (textValue.length > ORDER_IMPORT_LIMIT) throw new OrderFormatError('파일이 너무 커요.');
  let raw: unknown;
  try {
    raw = JSON.parse(textValue);
  } catch {
    throw new OrderFormatError('JSON 형식이 아니에요.');
  }
  if (!isObject(raw) || raw.format !== ORDER_EXPORT_FORMAT) throw new OrderFormatError('teamcook 주문 파일이 아니에요.');
  if (typeof raw.version !== 'number' || raw.version > 1) throw new OrderFormatError('지원하지 않는 파일 버전이에요.');
  const order = parseOrder(raw.order);
  // 안쪽 참조(작업·산출물·역할)는 주문 안에서만 쓰이므로 주문 id만 새로 주면 된다
  if (existing.some((item) => item.id === order.id)) order.id = newId('order');
  // 없는 작업을 가리키는 배정·전달은 가져오지 않는다
  const workIds = new Set(order.work.map((item) => item.id));
  const roleIds = new Set(order.roles.map((item) => item.id));
  order.deps = order.deps.filter((dep) => workIds.has(dep.from) && workIds.has(dep.to));
  order.assignments = order.assignments.filter((item) => workIds.has(item.workId) && roleIds.has(item.roleId));
  delete order.link;
  return order;
}
