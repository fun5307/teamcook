// 프로젝트 폴더에 실제로 들어 있는 팀을 읽고(scanTeam), 고친 내용을 그 파일에 되돌려 쓴다(planSave, applyChanges).
// - 읽는 곳: .codex/agents/*.toml, .claude/agents/*.md, 그리고 설정 두 개(.codex/config.toml, .claude/settings.json)는 읽기만.
// - 쓰는 곳: 역할 파일만. 설정 파일은 자동으로 고치지 않는다 (이미 있는 설정을 망가뜨리지 않으려고).
// - 사용자가 고치지 않은 역할의 파일은 한 글자도 건드리지 않는다 (다른 도구로 만든 파일의 모양을 지키려고).
// - 쓰기 직전에 파일을 다시 읽어, 읽은 뒤에 밖에서 바뀌었으면 덮어쓰지 않는다.

import { cardToClaudeMd, claudeMdToCard } from '../../converters/claude';
import { cardToCodexToml, codexConfigToSettings, codexTomlToCard } from '../../converters/codex';
import { AGENT_TEAMS_ENV_NAME, AGENT_TEAMS_MERGE_HINT } from '../../data/collaboration';
import type { AgentCard, ProviderData, Recipe } from '../../types';
import { buildRecipeFiles } from '../exportZip';
import { getDir, listFiles, readText, removeFile, writeText, type DirLike } from './fs';

export type TeamEngine = 'codex-cli' | 'claude-code';

export const TEAM_DIRS: Record<TeamEngine, { dir: string; ext: string; label: string }> = {
  'codex-cli': { dir: '.codex/agents', ext: '.toml', label: 'Codex' },
  'claude-code': { dir: '.claude/agents', ext: '.md', label: 'Claude Code' },
};
const ENGINES = Object.keys(TEAM_DIRS) as TeamEngine[];

export interface MemberFile {
  path: string;
  engine: TeamEngine;
  /** 읽었을 때의 파일 내용 (저장 전에 바뀌었는지 견줄 때 쓴다) */
  text: string;
}

export interface Member {
  card: AgentCard;
  files: MemberFile[];
  /** 같은 이름의 Codex 파일과 Claude Code 파일 내용이 서로 다른지 */
  diverged: boolean;
}

export interface TeamSnapshot {
  folderName: string;
  members: Member[];
  /** 읽지 못한 역할 파일 (형식이 깨졌거나 이름이 없음). 건드리지 않는다. */
  unreadable: { path: string; message: string }[];
  hasDir: Record<TeamEngine, boolean>;
  /** .codex/config.toml의 동시 실행 수 (없으면 undefined) */
  codexMaxThreads?: number;
  /** .claude/settings.json에 에이전트 팀이 켜져 있는지 */
  agentTeamsEnabled: boolean;
}

const fileBase = (name: string) => name.replace(/\.[^.]+$/, '');
const pathOf = (engine: TeamEngine, name: string) => `${TEAM_DIRS[engine].dir}/${name}${TEAM_DIRS[engine].ext}`;
const sameWork = (a: AgentCard, b: AgentCard) =>
  a.role.trim() === b.role.trim() && a.instructions.trim() === b.instructions.trim() && a.permission === b.permission;

/** 폴더에 있는 팀을 읽는다. 폴더에 아무것도 쓰지 않는다. */
export async function scanTeam(root: DirLike): Promise<TeamSnapshot> {
  const snapshot: TeamSnapshot = {
    folderName: root.name,
    members: [],
    unreadable: [],
    hasDir: { 'codex-cli': false, 'claude-code': false },
    agentTeamsEnabled: false,
  };
  const found = new Map<string, { card: AgentCard; file: MemberFile }[]>();
  for (const engine of ENGINES) {
    const { dir, ext } = TEAM_DIRS[engine];
    const handle = await getDir(root, dir);
    if (!handle) continue;
    snapshot.hasDir[engine] = true;
    for (const file of await listFiles(handle)) {
      if (!file.name.endsWith(ext)) continue;
      const path = `${dir}/${file.name}`;
      const text = await (await file.getFile()).text();
      try {
        const id = `ws-${fileBase(file.name)}`;
        const card = engine === 'codex-cli' ? codexTomlToCard(text, { id }) : claudeMdToCard(text, { id });
        // 한 사람은 "파일 이름"으로 묶는다 (도구가 파일 이름으로 역할을 찾으므로)
        const key = fileBase(file.name);
        found.set(key, [...(found.get(key) ?? []), { card, file: { path, engine, text } }]);
      } catch (error) {
        snapshot.unreadable.push({ path, message: (error as Error).message });
      }
    }
  }
  for (const [, items] of [...found.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // 두 형식이 다 있으면, 그 역할이 원래 쓰는 도구의 파일을 기준으로 삼는다
    const primary = items.find((item) => item.card.preferredEngine === item.file.engine) ?? items[0];
    snapshot.members.push({
      card: primary.card,
      files: items.map((item) => item.file),
      diverged: items.some((item) => !sameWork(item.card, primary.card)),
    });
  }

  const config = await readText(root, '.codex/config.toml');
  if (config) {
    try {
      snapshot.codexMaxThreads = codexConfigToSettings(config).maxThreads;
    } catch {
      // 설정을 읽지 못해도 팀은 보여 준다
    }
  }
  const settings = await readText(root, '.claude/settings.json');
  if (settings) {
    try {
      const parsed = JSON.parse(settings) as { env?: Record<string, unknown> };
      snapshot.agentTeamsEnabled = String(parsed.env?.[AGENT_TEAMS_ENV_NAME] ?? '') === '1';
    } catch {
      // 위와 같다
    }
  }
  return snapshot;
}

// ───────────────────────── 저장 ─────────────────────────

export interface FileChange {
  path: string;
  kind: 'create' | 'update' | 'delete';
  /** 읽었을 때의 내용 (create면 null) */
  before: string | null;
  /** 쓸 내용 (delete면 null) */
  after: string | null;
  /** 누구의 파일인지 (화면 표시용) */
  who: string;
}

export interface SavePlan {
  changes: FileChange[];
  /** 저장을 막는 문제 (이름이 잘못됐거나 겹침) */
  problems: string[];
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function render(engine: TeamEngine, card: AgentCard): string {
  return engine === 'codex-cli' ? cardToCodexToml(card) : cardToClaudeMd(card);
}

/**
 * 고친 카드 목록을 파일 변경 목록으로 바꾼다. 아직 아무것도 쓰지 않는다.
 * - 고치지 않은 역할: 변경 없음.
 * - 고친 역할: 그 역할이 가진 형식의 파일만 다시 쓴다. 이름을 바꾸면 옛 파일을 지우고 새 파일을 만든다.
 * - 새 역할: 폴더에 이미 있는 형식(없으면 그 역할의 도구 형식)으로 만든다.
 * - 뺀 역할: 그 역할의 파일을 지운다.
 */
export function planSave(snapshot: TeamSnapshot, cards: AgentCard[]): SavePlan {
  const problems: string[] = [];
  const names = new Set<string>();
  for (const card of cards) {
    const label = card.displayName || card.name || '이름 없는 역할';
    if (!NAME_PATTERN.test(card.name)) {
      problems.push(`"${label}"의 에이전트 이름은 영문 소문자·숫자·밑줄(_)·하이픈(-)만 쓸 수 있어요.`);
    } else if (names.has(card.name)) {
      problems.push(`에이전트 이름 "${card.name}"이 두 번 있어요. 파일 이름이 겹쳐요.`);
    }
    names.add(card.name);
  }
  if (problems.length > 0) return { changes: [], problems };

  const byId = new Map(snapshot.members.map((member) => [member.card.id, member]));
  const kept = new Set<string>();
  const changes: FileChange[] = [];
  for (const card of cards) {
    const member = byId.get(card.id);
    const who = card.displayName || card.name;
    if (!member) {
      const existing = ENGINES.filter((engine) => snapshot.hasDir[engine]);
      const fallback: TeamEngine = card.preferredEngine === 'codex-cli' ? 'codex-cli' : 'claude-code';
      for (const engine of existing.length > 0 ? existing : [fallback]) {
        changes.push({ path: pathOf(engine, card.name), kind: 'create', before: null, after: render(engine, card), who });
      }
      continue;
    }
    kept.add(card.id);
    if (JSON.stringify(card) === JSON.stringify(member.card)) continue;
    for (const file of member.files) {
      // 이름을 바꾸지 않았으면 파일 자리는 그대로 둔다 (파일 이름과 안의 name이 다른 파일도 있다)
      const nextPath = card.name === member.card.name ? file.path : pathOf(file.engine, card.name);
      const after = render(file.engine, card);
      if (nextPath !== file.path) {
        changes.push({ path: file.path, kind: 'delete', before: file.text, after: null, who });
        changes.push({ path: nextPath, kind: 'create', before: null, after, who });
      } else if (after !== file.text) {
        changes.push({ path: file.path, kind: 'update', before: file.text, after, who });
      }
    }
  }
  for (const member of snapshot.members) {
    if (kept.has(member.card.id)) continue;
    for (const file of member.files) {
      changes.push({ path: file.path, kind: 'delete', before: file.text, after: null, who: member.card.displayName || member.card.name });
    }
  }
  return { changes, problems };
}

export interface ApplyResult {
  written: string[];
  /** 읽은 뒤에 밖에서 바뀌어(또는 이미 생겨) 쓰지 않은 파일 */
  conflicts: string[];
}

/**
 * 변경 목록을 폴더에 쓴다. 파일마다 쓰기 직전에 다시 읽어, 읽었을 때와 다르면 그 파일은 건너뛴다
 * (그 사이 Claude Code나 사람이 고친 내용을 덮어쓰지 않으려고).
 */
export async function applyChanges(root: DirLike, changes: FileChange[]): Promise<ApplyResult> {
  const result: ApplyResult = { written: [], conflicts: [] };
  for (const change of changes) {
    const current = await readText(root, change.path);
    if (current !== change.before) {
      result.conflicts.push(change.path);
      continue;
    }
    if (change.kind === 'delete') await removeFile(root, change.path);
    else await writeText(root, change.path, change.after ?? '');
    result.written.push(change.path);
  }
  return result;
}

// ───────────────────────── 레시피를 이 폴더에 들이기 ─────────────────────────

export interface HirePlan {
  changes: FileChange[];
  /** 이미 있어서 덮어쓰지 않는 파일과 이유 */
  skipped: { path: string; reason: string }[];
}

const PROTECTED: Record<string, string> = {
  '.codex/config.toml': '이미 있는 .codex/config.toml은 덮어쓰지 않아요. [agents] 부분만 직접 옮겨 적으세요.',
  '.claude/settings.json': AGENT_TEAMS_MERGE_HINT,
};

/**
 * 레시피의 팀을 이 폴더에 넣을 때 생길 파일들. 이미 있는 파일은 절대 덮어쓰지 않는다
 * (같은 이름의 역할이 있으면 건너뛰고 알려 준다). 설명서와 원본은 .teamcook/ 아래에 둔다.
 */
export async function planHire(root: DirLike, recipe: Recipe, providers: ProviderData): Promise<HirePlan> {
  const plan: HirePlan = { changes: [], skipped: [] };
  const exported = buildRecipeFiles(recipe, providers, {});
  for (const [fullPath, content] of Object.entries(exported)) {
    const relative = fullPath.slice(fullPath.indexOf('/') + 1);
    const folder = fullPath.slice(0, fullPath.indexOf('/'));
    const path = relative.startsWith('.') ? relative : `.teamcook/${folder}/${relative}`;
    const current = await readText(root, path);
    if (current === null) {
      plan.changes.push({ path, kind: 'create', before: null, after: content, who: recipe.title });
    } else if (current !== content) {
      plan.skipped.push({
        path,
        reason: PROTECTED[path] ?? '같은 이름의 파일이 이미 있어 덮어쓰지 않아요. 내 팀 화면에서 직접 고치거나 이름을 바꿔 주세요.',
      });
    }
  }
  return plan;
}
