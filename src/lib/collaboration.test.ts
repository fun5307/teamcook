// 조리법(협업 방식) 테스트: 옛 링크 호환, 조리법별 내보내기, 배지·실행 경로 반영.
// (BRIEF_collaboration-styles.md)

import { describe, expect, it } from 'vitest';
import { planInstall } from '../cli/install';
import { claudeMdToCard } from '../converters/claude';
import {
  AGENT_TEAMS_SETTINGS_JSON,
  COLLABORATIONS,
  COLLABORATION_IDS,
  collaborationOf,
  today,
} from '../data/collaboration';
import { providerData } from '../data/providers';
import { builtinRecipes } from '../data/recipes';
import type { Recipe, UserPlans } from '../types';
import { buildRecipeFiles } from './exportZip';
import { debatePrompt, runPrompt, starterPrompt, teamPrompt } from './recipeMd';
import { parseRecipe } from './recipeSchema';
import { fitsMyPlans, requiredPlans } from './requiredPlans';
import { resolveRecipe } from './resolvePath';
import { buildShareLink, decodeRecipe, encodeRecipe, readShareHash } from './share';

const [crossReview, , , featureTeam, decisionDebate] = builtinRecipes;

function plans(overrides: Partial<UserPlans> = {}): UserPlans {
  return { openai: 'none', anthropic: 'none', google: 'none', xai: 'none', apiKeys: {}, ...overrides };
}
const ALL_FREE = plans({ openai: 'free', anthropic: 'free', google: 'free', xai: 'free' });
const CLAUDE_PRO = plans({ anthropic: 'pro' });

/** 조리법 기능이 생기기 전의 레시피 모양 (collaboration·lastVerified 없음) */
function oldRecipe(): Recipe {
  const { collaboration: _c, lastVerified: _v, ...rest } = crossReview;
  return rest;
}

function paths(files: Record<string, string>): string[] {
  return Object.keys(files)
    .map((path) => path.slice(path.indexOf('/') + 1))
    .sort();
}

describe('옛 공유 링크 호환 (조리법 필드 없음)', () => {
  it('조리법이 없는 옛 링크가 그대로 열리고, 서브에이전트로 본다', () => {
    const old = oldRecipe();
    expect('collaboration' in old).toBe(false);
    const result = decodeRecipe(encodeRecipe(old));
    expect(result).toEqual({ ok: true, recipe: old });
    if (!result.ok) return;
    expect(result.recipe.schemaVersion).toBe(1);
    expect(collaborationOf(result.recipe)).toBe('subagents');
  });

  it('조리법 기능이 생기기 전에 실제로 만들어진 링크 문자열도 열린다', () => {
    // 2026-11-16 이전 형식 그대로: 최소한의 필드만 있는 schemaVersion 1 레시피
    const legacyJson = {
      schemaVersion: 1,
      id: 'r1',
      title: '옛 레시피',
      summary: '',
      useCase: '',
      cards: [
        {
          id: 'c1',
          name: 'reviewer',
          displayName: '검토자',
          role: '검토',
          instructions: '검토하라',
          preferredEngine: 'codex-cli',
          permission: 'read-only',
        },
      ],
      handoffs: [],
      settings: { maxThreads: 2, maxDepth: 1 },
    };
    const link = buildShareLink(legacyJson as Recipe, 'https://teamcook-eta.vercel.app/');
    const result = decodeRecipe(readShareHash(new URL(link.url).hash)!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.collaboration).toBeUndefined();
    expect(result.recipe.lastVerified).toBeUndefined();
    // 옛 레시피는 예전과 똑같이 Codex·Claude 파일로 내보내진다
    expect(paths(buildRecipeFiles(result.recipe, providerData))).toEqual([
      '.claude/agents/reviewer.md',
      '.codex/agents/reviewer.toml',
      '.codex/config.toml',
      'RECIPE.md',
      'recipe.json',
    ]);
  });

  it('모르는 조리법 값은 서브에이전트로 바꾼다', () => {
    const parsed = parseRecipe({ ...oldRecipe(), collaboration: 'swarm-9000' });
    expect(parsed.collaboration).toBe('subagents');
    expect(parseRecipe({ ...oldRecipe(), collaboration: 42 }).collaboration).toBe('subagents');
  });

  it('조리법과 확인 날짜가 링크를 거쳐도 그대로다', () => {
    for (const recipe of [featureTeam, decisionDebate]) {
      expect(decodeRecipe(encodeRecipe(recipe))).toEqual({ ok: true, recipe });
    }
    expect(featureTeam.collaboration).toBe('agent-team');
    expect(decisionDebate.collaboration).toBe('debate');
  });

  it('날짜 모양이 아닌 확인 날짜는 버린다', () => {
    expect(parseRecipe({ ...oldRecipe(), lastVerified: '어제쯤' }).lastVerified).toBeUndefined();
    expect(parseRecipe({ ...oldRecipe(), lastVerified: '<b>2026</b>' }).lastVerified).toBeUndefined();
    expect(parseRecipe({ ...oldRecipe(), lastVerified: '2026-11-16' }).lastVerified).toBe('2026-11-16');
  });
});

describe('조리법 데이터', () => {
  it('세 조리법 모두 이름과 설명이 있고, 공식 문서를 본 조리법은 날짜와 주소가 있다', () => {
    expect(COLLABORATION_IDS).toEqual(['subagents', 'agent-team', 'debate']);
    for (const info of Object.values(COLLABORATIONS)) {
      expect(info.label).not.toBe('');
      expect(info.description.length).toBeGreaterThan(20);
    }
    const team = COLLABORATIONS['agent-team'];
    expect(team.experimental).toBe(true);
    expect(team.sourceUrl).toBe('https://code.claude.com/docs/en/agent-teams');
    expect(team.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('처음부터 있던 기본 레시피 5종은 확인 날짜가 있다 (추가분은 직접 확인한 뒤에 적는다)', () => {
    for (const recipe of builtinRecipes.slice(0, 5)) {
      expect(recipe.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('오늘 날짜를 YYYY-MM-DD로 만든다', () => {
    expect(today(new Date(2026, 10, 6))).toBe('2026-11-06');
  });
});

describe('조리법별 내보내기', () => {
  it('서브에이전트: 지금까지와 같다 (Codex + Claude 파일, 설정 파일 추가 없음)', () => {
    const files = buildRecipeFiles(crossReview, providerData);
    expect(paths(files)).toEqual([
      '.claude/agents/reviewer.md',
      '.claude/agents/writer.md',
      '.codex/agents/reviewer.toml',
      '.codex/agents/writer.toml',
      '.codex/config.toml',
      'RECIPE.md',
      'recipe.json',
    ]);
    const md = files[`${Object.keys(files)[0].split('/')[0]}/RECIPE.md`];
    expect(md).toContain('**조리법(협업 방식):** 서브에이전트');
    expect(md).toContain('**확인한 날:** 2026-11-16');
    expect(md).toContain(starterPrompt(crossReview));
  });

  it('에이전트 팀: Claude 파일 + 에이전트 팀을 켜는 .claude/settings.json만 넣는다', () => {
    const files = buildRecipeFiles(featureTeam, providerData);
    expect(paths(files)).toEqual([
      '.claude/agents/implementer_a.md',
      '.claude/agents/implementer_b.md',
      '.claude/agents/team_reviewer.md',
      '.claude/settings.json',
      'RECIPE.md',
      'recipe.json',
    ]);
    const root = Object.keys(files)[0].split('/')[0];
    // 공식 문서(2026-11-16)의 설정과 글자 그대로 같아야 한다
    expect(JSON.parse(files[`${root}/.claude/settings.json`])).toEqual({
      env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' },
    });
    expect(files[`${root}/.claude/settings.json`]).toBe(AGENT_TEAMS_SETTINGS_JSON);
    // 팀원 파일은 보통의 Claude 서브에이전트 정의다 (팀원을 만들 때 '에이전트 유형'으로 쓴다)
    const reviewer = claudeMdToCard(files[`${root}/.claude/agents/team_reviewer.md`], { id: 'ft-reviewer' });
    expect(reviewer.permission).toBe('read-only');
  });

  it('에이전트 팀: RECIPE.md에 팀원 소개 프롬프트, 실험 기능 경고, 병합 안내, 확인 방법이 있다', () => {
    const files = buildRecipeFiles(featureTeam, providerData, { plans: CLAUDE_PRO });
    const md = Object.entries(files).find(([path]) => path.endsWith('RECIPE.md'))![1];
    expect(md).toContain('에이전트 팀 (실험 기능)');
    expect(md).toContain(teamPrompt(featureTeam));
    expect(md).toContain('덮어쓰지 말고');
    expect(md).toContain('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
    expect(md).toContain('팀이 제대로 시작됐는지 확인하기');
    expect(md).toContain('https://code.claude.com/docs/en/agent-teams');
    expect(md).not.toContain('.codex');
  });

  it('에이전트 팀 프롬프트는 팀원마다 같은 이름의 에이전트 유형을 쓰게 한다', () => {
    const prompt = teamPrompt(featureTeam);
    expect(prompt).toContain('에이전트 팀을 만들어 줘');
    for (const card of featureTeam.cards) {
      expect(prompt).toContain(`- ${card.name} 에이전트 유형으로 팀원 1명`);
    }
    expect(prompt).toContain('implementer_a의 결과(변경 내용)를 team_reviewer에게 넘긴다');
    expect(runPrompt(featureTeam)).toBe(prompt);
  });

  it('에이전트 팀: 다른 도구용으로 적힌 모델 이름은 팀원 파일에 넣지 않는다', () => {
    const mixed: Recipe = {
      ...featureTeam,
      cards: [{ ...featureTeam.cards[0], preferredEngine: 'codex-cli', model: 'gpt-6.1-sol' }],
      handoffs: [],
    };
    const files = buildRecipeFiles(mixed, providerData);
    const md = Object.entries(files).find(([path]) => path.endsWith('implementer_a.md'))![1];
    expect(md).not.toContain('gpt-6.1-sol');
  });

  it('토론형: 설정 파일 없이 프롬프트만 넣는다', () => {
    const files = buildRecipeFiles(decisionDebate, providerData, { plans: ALL_FREE });
    expect(paths(files)).toEqual(['RECIPE.md', 'debate-prompt.txt', 'recipe.json']);
    const root = Object.keys(files)[0].split('/')[0];
    expect(files[`${root}/debate-prompt.txt`]).toBe(`${debatePrompt(decisionDebate)}\n`);
    expect(files[`${root}/RECIPE.md`]).toContain(debatePrompt(decisionDebate));
    expect(files[`${root}/RECIPE.md`]).toContain('설치할 것이 없어요');
  });

  it('토론 프롬프트에 네 역할과 진행 순서, 규칙이 들어 있다', () => {
    const prompt = debatePrompt(decisionDebate);
    for (const name of ['사회자', '조사', '검증', '반대자']) {
      expect(prompt).toContain(`[${name}]`);
    }
    expect(prompt).toContain('주제: (여기에 결정하고 싶은 것을 적으세요)');
    expect(prompt).toContain('1. [사회자] 역할이 먼저 주제와 판단 기준을 정리한다.');
    expect(prompt).toContain('[조사] 역할의 발언(근거)을 [검증] 역할이 이어받는다');
    expect(prompt).toContain('마지막에 [사회자] 역할이');
    expect(runPrompt(decisionDebate)).toBe(prompt);
    // 어느 도구에서나 붙여 쓸 수 있게: 특정 도구 이름이나 파일 경로가 없어야 한다
    expect(prompt).not.toMatch(/\.claude|\.codex|서브에이전트/);
  });

  it('조리법을 바꾸면 같은 카드로 내보내는 파일이 달라진다', () => {
    const asDebate: Recipe = { ...crossReview, collaboration: 'debate' };
    const asTeam: Recipe = { ...crossReview, collaboration: 'agent-team' };
    expect(paths(buildRecipeFiles(asDebate, providerData))).toEqual([
      'RECIPE.md',
      'debate-prompt.txt',
      'recipe.json',
    ]);
    expect(paths(buildRecipeFiles(asTeam, providerData, { codexBridge: true }))).toEqual([
      '.claude/agents/reviewer.md',
      '.claude/agents/writer.md',
      '.claude/settings.json',
      'RECIPE.md',
      'recipe.json',
    ]);
  });
});

describe('조리법과 필요한 플랜 배지', () => {
  it('에이전트 팀 기본 레시피: Claude Pro 필요', () => {
    const result = requiredPlans(featureTeam, providerData);
    expect(result.badges).toEqual(['Claude Pro 필요']);
    expect(result.allFree).toBe(false);
    expect(result.details[0].notes.join(' ')).toContain('실험 기능');
  });

  it('토론형 기본 레시피: 어느 AI든 무료로 가능', () => {
    const result = requiredPlans(decisionDebate, providerData);
    expect(result.badges).toEqual(['어느 AI든 무료로 가능']);
    expect(result.allFree).toBe(true);
  });

  it('에이전트 팀은 카드에 Codex가 적혀 있어도 Claude Code만 요구한다', () => {
    const asTeam: Recipe = { ...crossReview, collaboration: 'agent-team' };
    expect(requiredPlans(asTeam, providerData).badges).toEqual(['Claude Pro 필요']);
  });
});

describe('조리법과 실행 경로', () => {
  it('에이전트 팀 + Claude Pro: 모든 팀원이 구독으로 돌고, 실험 기능 경고가 붙는다', () => {
    const resolved = resolveRecipe(featureTeam, CLAUDE_PRO, providerData);
    expect(resolved.counts[1]).toBe(3);
    expect(resolved.styleLock).toBeUndefined();
    expect(resolved.styleNotes.join(' ')).toContain('실험 기능');
    for (const card of featureTeam.cards) {
      expect(resolved.perCard[card.id]).toMatchObject({ path: 1, engine: 'claude-code', locked: false });
      expect(resolved.perCard[card.id].alternative).toBeUndefined();
    }
    expect(fitsMyPlans(featureTeam, CLAUDE_PRO, providerData)).toBe('full');
  });

  it('에이전트 팀 + Claude Code 없음: 🔒, 대안은 서브에이전트 조리법으로 바꿔 쓰기', () => {
    const resolved = resolveRecipe(featureTeam, ALL_FREE, providerData);
    expect(resolved.styleLock?.switchTo).toBe('subagents');
    expect(resolved.styleLock?.reason).toContain('에이전트 팀은 Claude Code에서만');
    expect(resolved.styleLock?.suggestion).toContain("'서브에이전트'로 바꾸면");
    for (const card of featureTeam.cards) {
      const resolution = resolved.perCard[card.id];
      expect(resolution.locked).toBe(true);
      expect(resolution.alternative?.kind).toBe('fallback');
      expect(resolution.alternative?.reason).toContain("조리법을 '서브에이전트'로 바꾸면");
    }
    expect(fitsMyPlans(featureTeam, ALL_FREE, providerData)).toBe('with-alternatives');
  });

  it('에이전트 팀 + 아무 계정도 없음: 불가', () => {
    expect(fitsMyPlans(featureTeam, plans(), providerData)).toBe('no');
    expect(resolveRecipe(featureTeam, plans(), providerData).styleLock).toBeDefined();
  });

  it('에이전트 팀에서는 Codex 카드도 Claude Code 경로로 계산한다', () => {
    const asTeam: Recipe = { ...crossReview, collaboration: 'agent-team' };
    const resolved = resolveRecipe(asTeam, CLAUDE_PRO, providerData);
    expect(resolved.perCard['cr-reviewer']).toMatchObject({ engine: 'claude-code', locked: false });
    expect(resolved.crossReview).toBe('n/a');
  });

  it('토론형은 플랜과 상관없이 잠기지 않는다', () => {
    for (const myPlans of [plans(), ALL_FREE, CLAUDE_PRO]) {
      const resolved = resolveRecipe(decisionDebate, myPlans, providerData);
      expect(Object.values(resolved.perCard).every((item) => !item.locked)).toBe(true);
      expect(resolved.summary).toContain('프롬프트 하나만');
      expect(resolved.styleLock).toBeUndefined();
      expect(fitsMyPlans(decisionDebate, myPlans, providerData)).toBe('full');
    }
  });

  it('서브에이전트 조리법의 결과는 예전과 같다 (조리법 안내 없음)', () => {
    const resolved = resolveRecipe(crossReview, CLAUDE_PRO, providerData);
    expect(resolved.styleNotes).toEqual([]);
    expect(resolved.styleLock).toBeUndefined();
  });
});

describe('설치 명령과 조리법', () => {
  it('에이전트 팀: .claude/settings.json은 절대 덮어쓰지 않고 병합 안내를 붙인다', () => {
    const plan = planInstall(encodeRecipe(featureTeam));
    if (!plan.ok) throw new Error(plan.error);
    const settings = plan.files.find((file) => file.path === '.claude/settings.json')!;
    expect(settings.neverOverwrite).toBe(true);
    expect(settings.mergeHint).toContain('덮어쓰지 말고');
    expect(settings.mergeHint).toContain('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
    expect(plan.files.some((file) => file.path.startsWith('.codex/'))).toBe(false);
  });

  it('토론형: 프롬프트 파일은 .teamcook/ 아래에만 두고 프로젝트 설정은 건드리지 않는다', () => {
    const plan = planInstall(encodeRecipe(decisionDebate));
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.files.every((file) => file.path.startsWith('.teamcook/'))).toBe(true);
    expect(plan.files.some((file) => file.path.endsWith('/debate-prompt.txt'))).toBe(true);
  });
});
