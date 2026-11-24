// "이 폴더에서 AI가 한 일" 요약을 도우미(Node) 쪽에서 만든다.
// 기록 파일은 수십~수백 MB가 될 수 있어서, 브라우저가 통째로 받아 풀지 않고 여기서 읽어 요약만 화면으로 보낸다.
// 읽는 것은 두 도구의 대화 기록 파일(.jsonl, Codex는 .jsonl.zst)뿐이고, 경로는 기록 폴더 목록에서 얻은 것만 쓴다
// (기록 안의 agentId처럼 바깥에서 온 글자는 모양을 검사한 뒤에만 파일 이름에 쓴다). 아무것도 쓰거나 실행하지 않는다.
// 읽은 결과는 파일의 크기·수정 시각이 같으면 다시 풀지 않도록 메모리에만 둔다 (디스크에 저장하지 않는다).

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { ClaudeAgentEditsBuilder, claudeProjectSlug, ClaudeSessionBuilder } from '../../lib/journal/claude';
import { buildCodexSessions, CodexRolloutBuilder, type CodexRollout } from '../../lib/journal/codex';
import { buildActivitySummary, dedupeSessions, type ActivitySummary } from '../../lib/journal/activity';
import type { Delegation, JournalSession } from '../../lib/journal/types';
import { codexFiles, firstMatch, openLogStream, zstdSupported } from './discover';

interface Stamped<T> {
  stamp: string;
  value: T;
}

/** 읽은 결과를 파일의 크기·수정 시각이 같은 동안 기억해 둔다 (메모리에만) */
export class ActivityCache {
  claude = new Map<string, Stamped<JournalSession>>();
  subagent = new Map<string, Stamped<Record<string, number>>>();
  codexMeta = new Map<string, Stamped<{ id: string; cwd: string; parentId: string } | null>>();
  codexRollout = new Map<string, Stamped<CodexRollout>>();
}

export interface ActivityOptions {
  project: { path: string; name: string };
  claudeProjects: string;
  codexSessions: string;
  cache: ActivityCache;
  /** 이 시간(ms)이 지나면 읽기를 멈추고 읽은 만큼만 보여 준다 */
  budgetMs?: number;
  /** 도구마다 최근 몇 개의 기록 파일까지 읽을까 */
  maxPerTool?: number;
  /** Codex에서 훑어볼 최근 기록 파일 수 */
  codexCandidates?: number;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,120}$/;
const stampOf = (info: { size: number; mtimeMs: number }) => `${info.size}:${info.mtimeMs}`;
const norm = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

async function eachLine(file: string, onLine: (line: string) => void): Promise<void> {
  const stream = openLogStream(file);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) if (line) onLine(line);
  } finally {
    lines.close();
    stream.destroy();
  }
}

async function safeStat(file: string) {
  try {
    const info = await stat(file);
    return info.isFile() ? info : null;
  } catch {
    return null;
  }
}

async function safeDir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readClaude(options: ActivityOptions, deadline: number, notes: string[]): Promise<JournalSession[]> {
  const { project, claudeProjects, cache } = options;
  const wanted = claudeProjectSlug(project.path.replace(/[\\/]+$/, '')).toLowerCase();
  const dirs = (await safeDir(claudeProjects)).filter((entry) => entry.isDirectory() && entry.name.toLowerCase() === wanted);
  const files: { dir: string; name: string; file: string; mtime: number; birth: number; size: number }[] = [];
  for (const dir of dirs) {
    const full = path.join(claudeProjects, dir.name);
    for (const entry of await safeDir(full)) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const info = await safeStat(path.join(full, entry.name));
      if (info) files.push({ dir: full, name: entry.name, file: path.join(full, entry.name), mtime: info.mtimeMs, birth: info.birthtimeMs > 0 ? info.birthtimeMs : info.mtimeMs, size: info.size });
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  const cap = options.maxPerTool ?? 80;
  if (files.length > cap) notes.push(`Claude Code 대화 ${files.length}개 가운데 최근 ${cap}개만 읽었어요.`);

  const sessions: JournalSession[] = [];
  let late = 0;
  // 최근 cap개를 고른 뒤, 만들어진 순서(오래된 것부터)로 읽는다. 이어하기로 복사된 줄을 먼저 만든 대화에 귀속시키려는 것이다.
  const picked = files.slice(0, cap).sort((a, b) => a.birth - b.birth || a.mtime - b.mtime || a.name.localeCompare(b.name));
  for (const item of picked) {
    const stamp = `${item.size}:${item.mtime}`;
    const id = item.name.replace(/\.jsonl$/, '');
    let session = cache.claude.get(item.file)?.stamp === stamp ? cache.claude.get(item.file)!.value : undefined;
    if (!session) {
      if (Date.now() > deadline) {
        late += 1;
        continue;
      }
      try {
        const builder = new ClaudeSessionBuilder(id, { lite: true });
        await eachLine(item.file, (line) => builder.addLine(line));
        session = builder.result();
        cache.claude.set(item.file, { stamp, value: session });
      } catch {
        notes.push(`Claude Code 기록 하나를 읽지 못해 건너뛰었어요 (읽는 중 지워졌을 수 있어요).`);
        continue;
      }
    }
    // 팀원이 고친 파일은 팀원의 세부 기록에서 본다. 기록 파일이 바뀌었을 수 있어 요청마다 크기·시각을 다시 본다.
    const delegations: Delegation[] = [];
    for (const delegation of session.delegations) {
      const agentId = delegation.agentId;
      if (!agentId || !SAFE_ID.test(agentId) || !SAFE_ID.test(id)) {
        delegations.push(delegation);
        continue;
      }
      const file = path.join(item.dir, id, 'subagents', `agent-${agentId}.jsonl`);
      const info = await safeStat(file);
      if (!info) {
        delegations.push(delegation);
        continue;
      }
      const cached = cache.subagent.get(file);
      let edited = cached?.stamp === stampOf(info) ? cached.value : undefined;
      if (!edited) {
        if (Date.now() > deadline) {
          late += 1;
          delegations.push(delegation);
          continue;
        }
        try {
          const builder = new ClaudeAgentEditsBuilder();
          await eachLine(file, (line) => builder.addLine(line));
          edited = builder.result();
          cache.subagent.set(file, { stamp: stampOf(info), value: edited });
        } catch {
          delegations.push(delegation);
          continue;
        }
      }
      delegations.push({ ...delegation, edited });
    }
    sessions.push({ ...session, delegations });
  }
  if (late > 0) notes.push('시간이 오래 걸려 일부 Claude Code 기록은 읽지 못했어요. 잠시 뒤 다시 열면 이어서 읽어요.');
  const own = dedupeSessions(sessions);
  if (own.length < sessions.length) notes.push(`Claude Code 기록 ${sessions.length}개 가운데 ${sessions.length - own.length}개는 이어하기로 앞 대화를 복사만 해서 새로 한 일이 없어 대화 수에서 뺐어요.`);
  return own;
}

async function readCodex(options: ActivityOptions, deadline: number, notes: string[]): Promise<JournalSession[]> {
  const { project, codexSessions, cache } = options;
  const all: string[] = [];
  await codexFiles(codexSessions, 3, all);
  // 'rollout-날짜시각-…' 이름이라 이름순이 시간순이다
  all.sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
  const candidateCap = options.codexCandidates ?? 400;
  const canUnpack = zstdSupported();
  const skippedZst = all.filter((file) => file.endsWith('.zst')).length;
  const candidates = all.slice(0, candidateCap);
  if (all.length > candidateCap) notes.push(`Codex는 최근 기록 ${candidateCap}개 안에서 이 폴더의 대화를 찾았어요 (전체 ${all.length}개).`);
  if (!canUnpack && skippedZst > 0) notes.push(`Codex 압축 기록 ${skippedZst}개는 이 Node 버전(22.15 이상 필요)에서 풀 수 없어 읽지 못했어요.`);

  // 1) 파일마다 첫 줄(session_meta)에서 작업 폴더와 부모만 본다
  const metas = new Map<string, { id: string; cwd: string; parentId: string }>();
  let late = 0;
  for (const file of candidates) {
    const info = await safeStat(file);
    if (!info) continue;
    const cached = cache.codexMeta.get(file);
    let meta = cached?.stamp === stampOf(info) ? cached.value : undefined;
    if (meta === undefined) {
      if (Date.now() > deadline) {
        late += 1;
        continue;
      }
      if (file.endsWith('.zst') && !canUnpack) continue;
      meta =
        (await firstMatch(file, 3, (line) => {
          if (line.type !== 'session_meta') return undefined;
          const payload = (line.payload ?? {}) as Record<string, unknown>;
          return {
            id: typeof payload.id === 'string' ? payload.id : '',
            cwd: typeof payload.cwd === 'string' ? payload.cwd : '',
            parentId: typeof payload.parent_thread_id === 'string' ? payload.parent_thread_id : '',
          };
        })) ?? null;
      cache.codexMeta.set(file, { stamp: stampOf(info), value: meta });
    }
    if (meta?.id) metas.set(file, meta);
  }

  // 2) 이 폴더에서 시작한 대화와, 거기서 맡긴 팀원(그 팀원이 맡긴 팀원까지)을 고른다
  const mine = new Set<string>();
  for (const meta of metas.values()) if (!meta.parentId && meta.cwd && norm(meta.cwd) === norm(project.path)) mine.add(meta.id);
  for (let grew = true; grew; ) {
    grew = false;
    for (const meta of metas.values()) {
      if (meta.parentId && mine.has(meta.parentId) && !mine.has(meta.id)) {
        mine.add(meta.id);
        grew = true;
      }
    }
  }
  const chosen = [...metas.entries()].filter(([, meta]) => mine.has(meta.id)).map(([file]) => file);
  const parsedCap = (options.maxPerTool ?? 80) * 3;
  if (chosen.length > parsedCap) notes.push(`Codex 기록 ${chosen.length}개 가운데 최근 ${parsedCap}개만 읽었어요.`);

  // 3) 고른 파일을 읽는다
  const rollouts: CodexRollout[] = [];
  for (const file of chosen.slice(0, parsedCap)) {
    const info = await safeStat(file);
    if (!info) continue;
    const cached = cache.codexRollout.get(file);
    let rollout = cached?.stamp === stampOf(info) ? cached.value : undefined;
    if (!rollout) {
      if (Date.now() > deadline) {
        late += 1;
        continue;
      }
      try {
        const builder = new CodexRolloutBuilder({ lite: true });
        await eachLine(file, (line) => builder.addLine(line));
        rollout = builder.result();
        cache.codexRollout.set(file, { stamp: stampOf(info), value: rollout });
      } catch {
        notes.push('Codex 기록 하나를 읽지 못해 건너뛰었어요 (읽는 중 지워졌을 수 있어요).');
        continue;
      }
    }
    rollouts.push(rollout);
  }
  if (late > 0) notes.push('시간이 오래 걸려 일부 Codex 기록은 읽지 못했어요. 잠시 뒤 다시 열면 이어서 읽어요.');
  return buildCodexSessions(rollouts);
}

/** 이 프로젝트에서 AI가 한 일을 두 도구의 기록에서 모아 요약한다 */
export async function readActivity(options: ActivityOptions): Promise<ActivitySummary> {
  const started = Date.now();
  const deadline = started + (options.budgetMs ?? 30_000);
  const notes: string[] = [];
  const claude = await readClaude(options, deadline, notes);
  const codex = await readCodex(options, deadline, notes);
  const skipped = [...claude, ...codex].reduce((sum, session) => sum + session.skippedLines, 0);
  if (skipped > 0) notes.push(`읽지 못하고 건너뛴 줄이 ${skipped}개 있어요.`);
  return buildActivitySummary([...claude, ...codex], options.project, { notes, tookMs: Date.now() - started });
}
