// "이 폴더에서 AI가 한 일": 대화 기록(JournalSession) 여러 개를 한 프로젝트의 활동 요약으로 모은다.
// AI를 쓰지 않는 규칙 기반 요약이다. 기록에 적힌 것(대화 수, 사용자가 친 말 수, 파일 고침 도구, 토큰)만 세고,
// 없는 값은 0이 아니라 '모름'으로 둔다. 금액은 계산하지 않는다. 읽기 전용이고 디스크에 저장하지 않는다.
// 한계: 셸 명령(Bash 등)으로 바꾼 파일은 기록만으로 알 수 없어 '고친 파일'에 들어가지 않는다.

import { summarizeRoles, type JournalSession, type JournalTool, type SessionActivity } from './types';

export interface ActivitySession {
  tool: JournalTool;
  id: string;
  /** 대화 제목으로 쓰는 사용자의 처음 말 (자른 것) */
  title: string;
  startedAt?: string;
  endedAt?: string;
  /** 사용자가 직접 친 말의 수 */
  turns: number;
  /** 팀원에게 맡긴 일의 수 */
  delegations: number;
  /** 메인 AI가 쓴 도구 횟수 */
  toolCalls: number;
  /** 파일 고침 도구를 부른 횟수 (메인 AI + 팀원) */
  editCount: number;
  /** 서로 다른 고친 파일 수 */
  editedFiles: number;
  /** 가장 많이 고친 파일 몇 개 */
  topFiles: string[];
  /** 기록에 적힌 토큰. Claude Code는 출력 토큰, Codex는 도구가 낸 합계라 뜻이 달라 종류를 함께 둔다. 없으면 모름. */
  tokens?: { kind: 'output' | 'total'; value: number };
  /** 메인 AI의 마지막 말 (자른 것) */
  finalAnswer?: string;
}

export interface ActivityFile {
  path: string;
  /** 파일 고침 도구를 부른 횟수 */
  edits: number;
  /** 몇 개 대화에서 고쳤나 */
  sessions: number;
}

export interface ActivityRole {
  role: string;
  count: number;
  /** 하나라도 기록에 없으면 null(모름) */
  tokens: number | null;
  durationMs: number | null;
  /** 이 역할이 고친 서로 다른 파일 수. 세부 기록을 못 봤으면 null(모름) */
  editedFiles: number | null;
}

/** 팀원(역할) 하나가 파일을 고친 기록 한 건 (권한 점검에 쓴다) */
export interface RoleEditRecord {
  role: string;
  tool: JournalTool;
  sessionId: string;
  at?: string;
  files: string[];
}

export interface ActivityTotals {
  sessions: number;
  claude: number;
  codex: number;
  turns: number;
  /** 파일 고침 도구를 부른 횟수 */
  editCount: number;
  editedFiles: number;
  /** 값이 적힌 대화만 합친 것 */
  claudeOutputTokens: number;
  codexTokens: number;
  firstAt?: string;
  lastAt?: string;
}

export interface ActivitySummary {
  generatedAt: string;
  project: { path: string; name: string };
  totals: ActivityTotals;
  /** 최근 대화부터 (개수를 잘랐을 수 있다. totals는 전부 센 것) */
  sessions: ActivitySession[];
  topFiles: ActivityFile[];
  roles: ActivityRole[];
  /** 팀원이 파일을 고친 기록 */
  roleEdits: RoleEditRecord[];
  /** 팀원의 세부 기록을 못 봐서 파일을 고쳤는지 모르는 맡긴 일의 수 */
  uncheckedDelegations: number;
  /** 읽다가 건너뛴 것, 일부만 본 것 같은 알림 */
  notes: string[];
  tookMs?: number;
}

const normalize = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');

/** 프로젝트 안의 파일이면 프로젝트 기준 상대 경로로, 밖이면 슬래시만 맞춘 전체 경로로 */
export function relativeToProject(file: string, projectPath: string): string {
  const target = normalize(file);
  const base = normalize(projectPath);
  if (base && target.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return target.slice(base.length + 1);
  return target;
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** 대화 제목: 처음 말 가운데 너무 짧지 않은(= "계속해", "응" 같지 않은) 첫 것. 없으면 첫 말. */
export function pickTitle(prompts: string[], fallback = ''): string {
  const cleaned = prompts.map(squash).filter(Boolean);
  const chosen = cleaned.find((text) => text.length >= 8) ?? cleaned[0] ?? squash(fallback);
  return clip(chosen, 100);
}

function addCounts(into: Map<string, number>, record: Record<string, number> | undefined, project: string) {
  for (const [file, count] of Object.entries(record ?? {})) {
    const key = relativeToProject(file, project);
    into.set(key, (into.get(key) ?? 0) + count);
  }
}

const sumValues = (record: Record<string, number> | undefined) => Object.values(record ?? {}).reduce((sum, value) => sum + value, 0);

const startOf = (session: JournalSession) => session.startedAt ?? session.endedAt ?? '';

/**
 * Claude Code의 이어하기(resume)로 앞 대화의 줄이 새 대화 파일에 복사되면, 같은 일이 여러 대화에 들어 있어 그대로 더하면 몇 배로 부풀려진다.
 * (이 컴퓨터의 실제 기록에서 파일 고침의 82%가 다른 파일과 겹쳤다.) 항목마다 키(메시지·도구 id, 보낸 시각+글)가 복사본에서도 같아서,
 * 대화를 '오래된 것부터' 받아 먼저 만든 대화에 한 번만 귀속시키고 뒤 대화에서는 뺀다.
 * 새로 한 일이 하나도 없는(복사만 된) 대화는 목록에서 뺀다. items가 없는 대화(Codex 등)는 그대로 둔다.
 * 한계: 오래된 원본이 읽는 범위 밖이면 복사본이 원본 몫까지 가진다.
 */
export function dedupeSessions(ordered: JournalSession[]): JournalSession[] {
  const seenPrompts = new Set<string>();
  const seenTools = new Set<string>();
  const seenMessages = new Set<string>();
  const seenDelegations = new Set<string>();
  const out: JournalSession[] = [];
  for (const session of ordered) {
    const items = session.activity?.items;
    if (!items) {
      out.push(session);
      continue;
    }
    const prompts = items.prompts.filter((item) => !seenPrompts.has(item.key));
    const tools = items.tools.filter((item) => !seenTools.has(item.id));
    const outputs = Object.entries(items.outputs).filter(([id]) => !seenMessages.has(id));
    const delegations = session.delegations.filter((item) => !seenDelegations.has(item.id));
    // 한 파일 안에서 같은 키가 또 나오지 않도록, 이 파일의 것은 걸러낸 뒤에 한꺼번에 기억한다
    for (const item of items.prompts) seenPrompts.add(item.key);
    for (const item of items.tools) seenTools.add(item.id);
    for (const id of Object.keys(items.outputs)) seenMessages.add(id);
    for (const item of session.delegations) seenDelegations.add(item.id);
    if (prompts.length === 0 && tools.length === 0 && outputs.length === 0 && delegations.length === 0) continue;

    const toolCounts: Record<string, number> = {};
    const edits: Record<string, number> = {};
    for (const tool of tools) {
      toolCounts[tool.name] = (toolCounts[tool.name] ?? 0) + 1;
      if (tool.edit) edits[tool.edit] = (edits[tool.edit] ?? 0) + 1;
    }
    // 이 대화가 실제로 시작된 때: 자기 몫의 가장 이른 시각 (복사된 앞부분의 시각이 아니다)
    const times = [...prompts.map((item) => item.at), ...tools.map((item) => item.at), ...delegations.map((item) => item.startedAt)].filter((at): at is string => Boolean(at));
    const startedAt = times.length > 0 ? times.reduce((min, at) => (at < min ? at : min)) : session.startedAt;
    const activity: SessionActivity = {
      turns: prompts.length,
      prompts: prompts.slice(0, 5).map((item) => item.text),
      toolCounts,
      edits,
    };
    if (outputs.length > 0) activity.outputTokens = outputs.reduce((sum, [, tokens]) => sum + tokens, 0);
    out.push({ ...session, ...(startedAt ? { startedAt } : {}), firstPrompt: prompts[0]?.text ?? '', delegations, activity });
  }
  return out;
}

export function buildActivitySummary(
  sessions: JournalSession[],
  project: { path: string; name: string },
  options: { notes?: string[]; tookMs?: number; now?: string; limit?: number } = {},
): ActivitySummary {
  const ordered = [...sessions].sort((a, b) => startOf(b).localeCompare(startOf(a)));
  const fileTotals = new Map<string, { edits: number; sessions: number }>();
  const roleTotals = new Map<string, { count: number; tokens: number | null; durationMs: number | null; files: Set<string>; unknown: boolean }>();
  const roleEdits: RoleEditRecord[] = [];
  const rows: ActivitySession[] = [];
  const totals: ActivityTotals = {
    sessions: ordered.length,
    claude: 0,
    codex: 0,
    turns: 0,
    editCount: 0,
    editedFiles: 0,
    claudeOutputTokens: 0,
    codexTokens: 0,
  };
  let unchecked = 0;

  for (const session of ordered) {
    if (session.tool === 'claude-code') totals.claude += 1;
    else totals.codex += 1;
    const activity = session.activity;
    const perSession = new Map<string, number>();
    addCounts(perSession, activity?.edits, project.path);
    for (const delegation of session.delegations) {
      if (delegation.edited === undefined) {
        unchecked += 1;
      } else {
        addCounts(perSession, delegation.edited, project.path);
        const files = Object.keys(delegation.edited).map((file) => relativeToProject(file, project.path));
        if (files.length > 0) {
          roleEdits.push({ role: delegation.role, tool: session.tool, sessionId: session.id, ...(delegation.startedAt ? { at: delegation.startedAt } : {}), files });
        }
      }
    }
    for (const [file, count] of perSession) {
      const row = fileTotals.get(file) ?? { edits: 0, sessions: 0 };
      row.edits += count;
      row.sessions += 1;
      fileTotals.set(file, row);
    }
    const editCount = [...perSession.values()].reduce((sum, value) => sum + value, 0);
    totals.turns += activity?.turns ?? 0;
    totals.editCount += editCount;
    const at = startOf(session);
    if (at) {
      if (!totals.firstAt || at < totals.firstAt) totals.firstAt = at;
      const end = session.endedAt ?? at;
      if (!totals.lastAt || end > totals.lastAt) totals.lastAt = end;
    }

    for (const row of summarizeRoles(session)) {
      const sum = roleTotals.get(row.role) ?? { count: 0, tokens: 0, durationMs: 0, files: new Set<string>(), unknown: false };
      sum.count += row.count;
      sum.tokens = sum.tokens === null || row.tokens === null ? null : sum.tokens + row.tokens;
      sum.durationMs = sum.durationMs === null || row.durationMs === null ? null : sum.durationMs + row.durationMs;
      roleTotals.set(row.role, sum);
    }
    for (const delegation of session.delegations) {
      const sum = roleTotals.get(delegation.role);
      if (!sum) continue;
      if (delegation.edited === undefined) sum.unknown = true;
      else for (const file of Object.keys(delegation.edited)) sum.files.add(relativeToProject(file, project.path));
    }

    let tokens: ActivitySession['tokens'];
    if (activity?.outputTokens !== undefined) {
      tokens = { kind: 'output', value: activity.outputTokens };
      totals.claudeOutputTokens += activity.outputTokens;
    } else if (activity?.totalTokens !== undefined) {
      tokens = { kind: 'total', value: activity.totalTokens };
      totals.codexTokens += activity.totalTokens;
    }
    const final = session.finalAnswer ? squash(session.finalAnswer) : '';
    rows.push({
      tool: session.tool,
      id: session.id,
      title: pickTitle(activity?.prompts ?? [], session.firstPrompt),
      ...(session.startedAt ? { startedAt: session.startedAt } : {}),
      ...(session.endedAt ? { endedAt: session.endedAt } : {}),
      turns: activity?.turns ?? 0,
      delegations: session.delegations.length,
      toolCalls: sumValues(activity?.toolCounts),
      editCount,
      editedFiles: perSession.size,
      topFiles: [...perSession.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([file]) => file),
      ...(tokens ? { tokens } : {}),
      ...(final ? { finalAnswer: clip(final, 200) } : {}),
    });
  }
  totals.editedFiles = fileTotals.size;

  return {
    generatedAt: options.now ?? new Date().toISOString(),
    project,
    totals,
    sessions: rows.slice(0, options.limit ?? 40),
    topFiles: [...fileTotals.entries()]
      .map(([path, row]) => ({ path, ...row }))
      .sort((a, b) => b.edits - a.edits || b.sessions - a.sessions || a.path.localeCompare(b.path))
      .slice(0, 12),
    roles: [...roleTotals.entries()]
      .map(([role, row]) => ({ role, count: row.count, tokens: row.tokens, durationMs: row.durationMs, editedFiles: row.unknown ? null : row.files.size }))
      .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role)),
    roleEdits,
    uncheckedDelegations: unchecked,
    notes: options.notes ?? [],
    ...(options.tookMs !== undefined ? { tookMs: options.tookMs } : {}),
  };
}

// ───────────────────────── 권한 점검 ─────────────────────────

export interface PermissionIssue {
  role: string;
  /** 파일을 고친 기록의 수 (맡긴 일 단위) */
  times: number;
  files: string[];
  lastAt?: string;
  tools: JournalTool[];
}

export interface PermissionCheck {
  /** 지금 역할 파일에서 '읽기 전용'인 팀원 */
  readOnlyRoles: string[];
  /** 그중 파일을 고친 기록이 있는 팀원 */
  issues: PermissionIssue[];
}

/**
 * 지금 역할 파일이 '읽기 전용'인 팀원이 기록에서 파일을 고쳤는지 본다.
 * 한계: 지금 역할 파일 기준이라 그때는 권한이 달랐을 수 있고, 셸 명령으로 바꾼 파일은 볼 수 없다.
 */
export function checkPermissions(records: RoleEditRecord[], cards: { name: string; permission: string }[]): PermissionCheck {
  const readOnly = new Set(cards.filter((card) => card.permission === 'read-only').map((card) => card.name));
  const issues = new Map<string, PermissionIssue & { fileSet: Set<string> }>();
  for (const record of records) {
    if (!readOnly.has(record.role)) continue;
    const issue = issues.get(record.role) ?? { role: record.role, times: 0, files: [], tools: [], fileSet: new Set<string>() };
    issue.times += 1;
    for (const file of record.files) issue.fileSet.add(file);
    if (!issue.tools.includes(record.tool)) issue.tools.push(record.tool);
    if (record.at && (!issue.lastAt || record.at > issue.lastAt)) issue.lastAt = record.at;
    issues.set(record.role, issue);
  }
  return {
    readOnlyRoles: [...readOnly],
    issues: [...issues.values()].map(({ fileSet, ...issue }) => ({ ...issue, files: [...fileSet].slice(0, 6) })),
  };
}

// ───────────────────────── 위임 계보 ─────────────────────────

export interface LineageNode {
  id: string;
  role: string;
  children: LineageNode[];
}

/**
 * 맡긴 일을 '누가 누구에게 맡겼나' 나무로 만든다. parentId가 없으면 메인 AI가 직접 맡긴 것이다.
 * 가리키는 부모가 목록에 없거나 순환하면 메인 AI가 맡긴 것으로 둔다 (버리지 않는다).
 */
export function buildLineage(session: JournalSession): LineageNode[] {
  const nodes = new Map<string, LineageNode>();
  for (const item of session.delegations) nodes.set(item.id, { id: item.id, role: item.role, children: [] });
  const roots: LineageNode[] = [];
  const reaches = (start: string, target: string): boolean => {
    const seen = new Set<string>();
    for (let current: string | undefined = start; current && !seen.has(current); ) {
      if (current === target) return true;
      seen.add(current);
      current = session.delegations.find((item) => item.id === current)?.parentId;
    }
    return false;
  };
  for (const item of session.delegations) {
    const node = nodes.get(item.id)!;
    const parent = item.parentId ? nodes.get(item.parentId) : undefined;
    // 자기 자신이나 자손을 부모로 가리키면(순환) 메인 AI가 맡긴 것으로 둔다
    if (parent && parent.id !== item.id && !reaches(parent.id, item.id)) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
