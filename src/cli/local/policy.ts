// 내 컴퓨터 도우미(teamcook open)가 읽고 쓸 수 있는 곳의 규칙. 화면이 무엇을 부탁하든 여기를 통과해야 한다.
// - project: 사용자가 고른 프로젝트 폴더. 역할 폴더(.claude/agents, .codex/agents)와 .teamcook/만 읽고 쓴다.
//   설정 두 개(.codex/config.toml, .claude/settings.json)는 읽기만 하고, 없을 때 새로 만드는 것만 허락한다 (레시피 들이기).
// - claude-logs: ~/.claude/projects. 대화 기록 파일(.jsonl)만 읽는다.
// - codex-logs: ~/.codex/sessions. 대화 기록 파일(.jsonl, 압축된 .jsonl.zst)만 읽는다.
// 인증 파일(auth.json, .credentials.json 등)은 어떤 경우에도 이 규칙을 통과하지 못한다.

export type RootId = 'project' | 'claude-logs' | 'codex-logs';
export const ROOT_IDS: RootId[] = ['project', 'claude-logs', 'codex-logs'];

const AGENT_DIRS = [
  ['.claude', 'agents'],
  ['.codex', 'agents'],
];
const DOCS_DIR = ['.teamcook'];
/** 읽기만 하는 설정 파일 (없을 때 새로 만드는 것만 허락) */
const CONFIG_FILES = [
  ['.codex', 'config.toml'],
  ['.claude', 'settings.json'],
];

/** 'a/b/c'를 조각으로. 위로 올라가기(..)·드라이브·역슬래시 같은 수상한 경로는 null. */
export function splitPath(rel: string): string[] | null {
  if (rel.length > 1024) return null;
  const parts = rel.split('/').filter((part) => part !== '');
  for (const part of parts) {
    if (part === '.' || part === '..' || /[\\:\0]/.test(part)) return null;
  }
  return parts;
}

const startsWith = (parts: string[], prefix: string[]) => prefix.every((name, index) => parts[index] === name);
const equals = (parts: string[], other: string[]) => parts.length === other.length && startsWith(parts, other);

/** 로그 파일 이름 (Codex는 오래된 기록을 .zst로 압축한다) */
export const isLogFile = (root: RootId, name: string) =>
  root === 'codex-logs' ? name.endsWith('.jsonl') || name.endsWith('.jsonl.zst') : root === 'claude-logs' && name.endsWith('.jsonl');

/** 폴더로서 들어가거나 목록을 볼 수 있는가 */
export function canOpenDir(root: RootId, parts: string[]): boolean {
  if (root !== 'project') return true;
  if (parts.length === 0) return true;
  // .claude, .codex 자체는 지나가는 길로만 (목록은 아래 canSee로 걸러진다)
  if (parts.length === 1 && (parts[0] === '.claude' || parts[0] === '.codex')) return true;
  return [...AGENT_DIRS, DOCS_DIR].some((prefix) => startsWith(parts, prefix));
}

/** 파일을 읽을 수 있는가 */
export function canReadFile(root: RootId, parts: string[]): boolean {
  if (parts.length === 0) return false;
  const name = parts[parts.length - 1];
  if (root !== 'project') return isLogFile(root, name);
  if (CONFIG_FILES.some((file) => equals(parts, file))) return true;
  if (AGENT_DIRS.some((prefix) => startsWith(parts, prefix))) return parts.length === 3;
  return startsWith(parts, DOCS_DIR) && parts.length >= 2;
}

/** 목록에 보여 줄 항목인가 (보이지 않는 것은 이름도 알려 주지 않는다) */
export function canSee(root: RootId, parent: string[], name: string, kind: 'file' | 'directory'): boolean {
  const parts = [...parent, name];
  if (kind === 'directory') {
    if (root !== 'project') return true;
    return [...AGENT_DIRS, DOCS_DIR].some((prefix) => startsWith(parts, prefix) || startsWith(prefix, parts));
  }
  return canReadFile(root, parts);
}

/** 파일을 쓸 수 있는가. 설정 파일은 아직 없을 때만 (새로 만들기). */
export function canWrite(root: RootId, parts: string[], exists: boolean): boolean {
  if (root !== 'project' || parts.length < 2) return false;
  if (CONFIG_FILES.some((file) => equals(parts, file))) return !exists;
  if (AGENT_DIRS.some((prefix) => startsWith(parts, prefix))) return parts.length === 3;
  return startsWith(parts, DOCS_DIR);
}

/** 파일을 지울 수 있는가. 역할 파일만 (팀에서 빼기). */
export function canRemove(root: RootId, parts: string[]): boolean {
  return root === 'project' && parts.length === 3 && AGENT_DIRS.some((prefix) => startsWith(parts, prefix));
}
