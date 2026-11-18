// 사용자가 고른 기록 폴더에서 업무 일지를 읽는다 (읽기 전용).
// 읽는 것은 대화 기록 파일(.jsonl)뿐이다. 사용자가 ~/.claude나 ~/.codex를 통째로 골라도
// projects / sessions 폴더 안으로만 들어가고, 인증 파일이나 설정 파일은 열지 않는다.

import { getDir, listDirs, listFiles, type DirLike, type FileData, type FileLike } from '../workspace/fs';
import { ClaudeSessionBuilder, parseClaudeAgentSteps } from './claude';
import { buildCodexSessions, CodexRolloutBuilder, type CodexRollout } from './codex';
import type { AgentStep, JournalSession } from './types';

/** 큰 파일을 한 줄씩 읽는다 (기록 파일은 수십 MB가 될 수 있다) */
export async function forEachLine(file: FileData, onLine: (line: string) => void): Promise<void> {
  if (!file.stream) {
    for (const line of (await file.text()).split('\n')) if (line) onLine(line);
    return;
  }
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let rest = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    rest += decoder.decode(value, { stream: true });
    let index = rest.indexOf('\n');
    while (index >= 0) {
      const line = rest.slice(0, index);
      if (line) onLine(line);
      rest = rest.slice(index + 1);
      index = rest.indexOf('\n');
    }
  }
  rest += decoder.decode();
  if (rest) onLine(rest);
}

export interface SessionFile {
  id: string;
  handle: FileLike;
  lastModified: number;
  size: number;
}

/**
 * 고른 폴더에서 이 프로젝트의 Claude Code 기록 폴더 후보를 찾는다.
 * - 고른 폴더에 .jsonl이 바로 있으면 그 폴더가 기록 폴더다.
 * - ~/.claude 또는 ~/.claude/projects를 골랐으면, 이름이 프로젝트 폴더 이름으로 끝나는 폴더를 찾는다
 *   (Claude Code는 경로의 글자·숫자가 아닌 것을 '-'로 바꿔 폴더 이름을 만든다).
 */
export async function findClaudeProjectDirs(picked: DirLike, projectName: string): Promise<DirLike[]> {
  // ~/.claude처럼 projects 폴더를 품은 폴더를 골랐으면 그 안으로 들어간다
  const base = (await getDir(picked, 'projects')) ?? picked;
  if ((await listFiles(base)).some((file) => file.name.endsWith('.jsonl'))) return [base];
  const slug = projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  return (await listDirs(base)).filter((dir) => {
    const name = dir.name.toLowerCase();
    return name === slug || name.endsWith(`-${slug}`);
  });
}

export async function listClaudeSessions(projectDir: DirLike): Promise<SessionFile[]> {
  const sessions: SessionFile[] = [];
  for (const handle of await listFiles(projectDir)) {
    if (!handle.name.endsWith('.jsonl')) continue;
    const file = await handle.getFile();
    sessions.push({ id: handle.name.replace(/\.jsonl$/, ''), handle, lastModified: file.lastModified ?? 0, size: file.size ?? 0 });
  }
  return sessions.sort((a, b) => b.lastModified - a.lastModified);
}

export async function readClaudeSession(entry: SessionFile): Promise<JournalSession> {
  const builder = new ClaudeSessionBuilder(entry.id);
  await forEachLine(await entry.handle.getFile(), (line) => builder.addLine(line));
  return builder.result();
}

/** 서브에이전트 하나가 한 일. 기록 파일이 없으면 null. */
export async function readClaudeAgentSteps(projectDir: DirLike, sessionId: string, agentId: string): Promise<AgentStep[] | null> {
  const dir = await getDir(projectDir, `${sessionId}/subagents`);
  if (!dir) return null;
  try {
    const handle = await dir.getFileHandle(`agent-${agentId}.jsonl`);
    return parseClaudeAgentSteps(await (await handle.getFile()).text());
  } catch {
    return null;
  }
}

export interface CodexJournal {
  sessions: JournalSession[];
  /** 읽은 기록 파일 수 */
  read: number;
  /** 압축돼 있어(.zst) 브라우저에서 읽지 못한 파일 수. Codex는 오래된 기록을 압축한다. */
  compressed: number;
}

async function walk(dir: DirLike, depth: number, found: FileLike[], counter: { compressed: number }): Promise<void> {
  for (const file of await listFiles(dir)) {
    if (file.name.endsWith('.jsonl')) found.push(file);
    else if (file.name.endsWith('.zst')) counter.compressed += 1;
  }
  if (depth <= 0) return;
  for (const child of await listDirs(dir)) await walk(child, depth - 1, found, counter);
}

/** Codex 기록 폴더(~/.codex/sessions 또는 ~/.codex)에서 최근 기록을 읽어 세션으로 묶는다 */
export async function readCodexJournal(picked: DirLike, limit = 80): Promise<CodexJournal> {
  const base = (await getDir(picked, 'sessions')) ?? picked;
  const files: FileLike[] = [];
  const counter = { compressed: 0 };
  // 연/월/일 폴더 구조라 세 단계까지만 내려간다
  await walk(base, 3, files, counter);
  // 파일 이름이 'rollout-날짜시각-…'이라 이름순이 시간순이다
  const recent = files.sort((a, b) => b.name.localeCompare(a.name)).slice(0, limit);
  const rollouts: CodexRollout[] = [];
  for (const handle of recent) {
    const builder = new CodexRolloutBuilder();
    await forEachLine(await handle.getFile(), (line) => builder.addLine(line));
    rollouts.push(builder.result());
  }
  return { sessions: buildCodexSessions(rollouts), read: recent.length, compressed: counter.compressed };
}

/** 기록에 적힌 작업 폴더가 이 프로젝트인지 (폴더 이름으로 견준다. 브라우저는 전체 경로를 알려 주지 않는다) */
export function sameProject(cwd: string | undefined, projectName: string): boolean {
  if (!cwd) return false;
  const last = cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
  return last.toLowerCase() === projectName.toLowerCase();
}
