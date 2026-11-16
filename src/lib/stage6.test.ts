// 6·7단계 기능 테스트: Antigravity·Grok 어댑터, 구독 최적화, Codex 연결(다리), 갤러리 검색.

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { claudeMdToCard } from '../converters/claude';
import { CODEX_READONLY_GUARD } from '../converters/codex';
import {
  antigravityMdToCard,
  cardToAntigravityMd,
  cardToGrokMd,
  detectMarkdownEngine,
  grokMdToCard,
} from '../converters/markdownAgents';
import { providerData } from '../data/providers';
import { builtinRecipes } from '../data/recipes';
import type { AgentCard, Recipe, UserPlans } from '../types';
import { codexBridgeMd, needsCodexBridge } from './bridge';
import { buildRecipeFiles } from './exportZip';
import { importFile } from './importFiles';
import { applyOptimization, optimizeRecipe } from './optimize';
import { resolveRecipe } from './resolvePath';

const [crossReview, planBuildReview, researchTeam] = builtinRecipes;

function plans(overrides: Partial<UserPlans> = {}): UserPlans {
  return { openai: 'none', anthropic: 'none', google: 'none', xai: 'none', apiKeys: {}, ...overrides };
}

function frontmatter(text: string): Record<string, unknown> {
  return parseYaml(/^---\n([\s\S]*?)\n---/.exec(text)![1]) as Record<string, unknown>;
}

const reviewer: AgentCard = {
  id: 'c1',
  name: 'reviewer',
  displayName: '검토자',
  role: '변경된 파일의 버그와 보안 문제를 검토할 때 사용',
  instructions: '너는 코드 검토자다.\n문제를 파일 경로와 함께 보고하라.',
  preferredEngine: 'antigravity-cli',
  model: 'pro',
  permission: 'read-only',
  tags: ['reviewer'],
};

// 공식 문서(antigravity.google/docs/subagents)의 예시
const ANTIGRAVITY_EXAMPLE = `---
name: code-auditor
description: Specialized subagent for security audits, static analysis, and code quality reviews.
tools:
  - view_file
  - grep_search
  - run_command
subagent: true
mainAgent: false
model: pro
commandExecutionPolicy: sandbox
skills:
  - skills/security-checklist
---

# System Prompt
You are an expert security auditor and code reviewer.
`;

describe('Antigravity 어댑터 (.agents/agents/*.md)', () => {
  it('읽기 전용 카드는 문서에 나온 읽기 도구 이름만 쓴다', () => {
    const fields = frontmatter(cardToAntigravityMd(reviewer));
    expect(fields).toMatchObject({ name: 'reviewer', model: 'pro', tools: ['view_file', 'grep_search'] });
  });

  it('카드 → 파일 → 카드가 같다 (읽기 전용·편집·제한 없음)', () => {
    for (const permission of ['read-only', 'edit', 'full'] as const) {
      const card: AgentCard = { ...reviewer, permission };
      expect(antigravityMdToCard(cardToAntigravityMd(card), { id: card.id })).toEqual(card);
    }
  });

  it('공식 문서 예시를 불러오고, 형식 전용 필드를 보존해 다시 내보낸다', () => {
    const card = antigravityMdToCard(ANTIGRAVITY_EXAMPLE);
    expect(card).toMatchObject({
      name: 'code-auditor',
      preferredEngine: 'antigravity-cli',
      model: 'pro',
      permission: 'edit', // run_command가 있으므로
    });
    expect(card.extra?.antigravity).toEqual({
      tools: ['view_file', 'grep_search', 'run_command'],
      subagent: true,
      mainAgent: false,
      commandExecutionPolicy: 'sandbox',
      skills: ['skills/security-checklist'],
    });
    expect(frontmatter(cardToAntigravityMd(card))).toEqual(frontmatter(ANTIGRAVITY_EXAMPLE));
  });

  it('다른 도구용 카드를 내보낼 때는 그 도구의 모델 이름을 쓰지 않는다', () => {
    const card: AgentCard = { ...reviewer, preferredEngine: 'claude-code', model: 'sonnet' };
    const text = cardToAntigravityMd(card);
    expect(frontmatter(text).model).toBeUndefined();
    expect(antigravityMdToCard(text, { id: card.id })).toEqual(card);
  });
});

describe('Grok Build 어댑터 (.grok/agents/*.md)', () => {
  const grokCard: AgentCard = { ...reviewer, preferredEngine: 'grok-build', model: undefined };
  delete grokCard.model;

  it('도구 이름을 만들어 쓰지 않고, 읽기 전용은 지시문 끝 문장으로 표현한다', () => {
    const text = cardToGrokMd(grokCard);
    expect(frontmatter(text).tools).toBeUndefined();
    expect(text.trim().endsWith(CODEX_READONLY_GUARD)).toBe(true);
  });

  it('카드 → 파일 → 카드가 같다', () => {
    for (const permission of ['read-only', 'edit', 'full'] as const) {
      const card: AgentCard = { ...grokCard, permission };
      expect(grokMdToCard(cardToGrokMd(card), { id: card.id })).toEqual(card);
    }
  });

  it('공식 문서 예시(name, description, tools)를 불러오고 tools를 보존한다', () => {
    const example =
      '---\nname: research-only\ndescription: Read MCP tools but not internal connectors\ntools: search_tool, use_tool, Read\n---\n\nResearch only.\n';
    const card = grokMdToCard(example);
    expect(card.extra?.grok).toEqual({ tools: ['search_tool', 'use_tool', 'Read'] });
    expect(frontmatter(cardToGrokMd(card)).tools).toEqual(['search_tool', 'use_tool', 'Read']);
  });
});

describe('.md 파일 형식 알아보기', () => {
  it('Antigravity·Grok·Claude 파일을 구분해서 불러온다', () => {
    expect(detectMarkdownEngine(ANTIGRAVITY_EXAMPLE)).toBe('antigravity-cli');
    expect(detectMarkdownEngine(cardToAntigravityMd(reviewer))).toBe('antigravity-cli');
    expect(detectMarkdownEngine(cardToGrokMd({ ...reviewer, preferredEngine: 'grok-build' }))).toBe('grok-build');
    expect(detectMarkdownEngine('---\nname: a\ndescription: b\ntools: Read, Grep\n---\n본문')).toBe('claude-code');
  });

  it('importFile이 형식에 맞는 변환기를 고른다', () => {
    const fromAntigravity = importFile('code-auditor.md', ANTIGRAVITY_EXAMPLE);
    expect(fromAntigravity.kind === 'card' && fromAntigravity.card.preferredEngine).toBe('antigravity-cli');
    const grokText = cardToGrokMd({ ...reviewer, preferredEngine: 'grok-build', model: undefined });
    const fromGrok = importFile('reviewer.md', grokText);
    expect(fromGrok.kind === 'card' && fromGrok.card).toMatchObject({
      preferredEngine: 'grok-build',
      permission: 'read-only',
    });
  });
});

describe('zip에 넣는 형식', () => {
  const root = (files: Record<string, string>) => Object.keys(files).map((path) => path.split('/')[1]);

  it('Codex·Claude만 쓰는 레시피에는 .agents·.grok 폴더를 넣지 않는다', () => {
    const folders = root(buildRecipeFiles(crossReview, providerData));
    expect(folders).not.toContain('.agents');
    expect(folders).not.toContain('.grok');
  });

  it('Antigravity·Grok 카드가 있으면 그 형식의 폴더도 넣는다', () => {
    const mixed: Recipe = {
      ...crossReview,
      cards: [
        { ...crossReview.cards[0], preferredEngine: 'antigravity-cli' },
        { ...crossReview.cards[1], preferredEngine: 'grok-build' },
      ],
    };
    const files = buildRecipeFiles(mixed, providerData);
    const folders = root(files);
    expect(folders).toContain('.agents');
    expect(folders).toContain('.grok');
    const md = Object.entries(files).find(([path]) => path.endsWith('RECIPE.md'))![1];
    expect(md).toContain('.agents/agents/*.md');
    expect(md).toContain('.grok/agents/*.md');
  });

  it('내 플랜의 대안이 Grok이면 Grok 형식도 함께 넣는다', () => {
    const files = buildRecipeFiles(researchTeam, providerData, { plans: plans({ xai: 'supergrok' }) });
    expect(root(files)).toContain('.grok');
  });
});

describe('구독 최적화 제안', () => {
  it('Claude Pro + ChatGPT 무료: Codex만 쓰는 팀의 무거운 역할을 Claude로 옮긴다', () => {
    const mine = plans({ openai: 'free', anthropic: 'pro' });
    const result = optimizeRecipe(planBuildReview, mine, providerData);
    const byCard = Object.fromEntries(result.changes.map((change) => [change.cardId, change]));
    // 구현 담당(무거운 역할) → 유료 구독인 Claude Code
    expect(byCard['pbr-implementer']).toMatchObject({ from: 'codex-cli', to: 'claude-code' });
    expect(byCard['pbr-implementer'].reason).toContain('무거운 역할');
    // 검토자는 작성자(Claude)와 다른 회사인 Codex 무료 한도에 그대로 둔다
    expect(byCard['pbr-reviewer']).toBeUndefined();

    const after = resolveRecipe(applyOptimization(planBuildReview, result), mine, providerData);
    expect(after.crossReview).toBe('ok');
    expect(after.perCard['pbr-implementer']).toMatchObject({ locked: false, path: 1 });
  });

  it('둘 다 유료: Codex만 쓰는 팀의 검토자를 Claude로 옮겨 교차 검토를 만든다', () => {
    const mine = plans({ openai: 'pro', anthropic: 'max' });
    const result = optimizeRecipe(planBuildReview, mine, providerData);
    expect(result.changes).toEqual([
      expect.objectContaining({ cardId: 'pbr-reviewer', from: 'codex-cli', to: 'claude-code' }),
    ]);
    expect(result.changes[0].reason).toContain('다른 회사');
  });

  it('둘 다 유료이고 이미 교차 검토인 팀은 바꿀 것이 없다', () => {
    const result = optimizeRecipe(crossReview, plans({ openai: 'pro', anthropic: 'max' }), providerData);
    expect(result.changes).toEqual([]);
    expect(result.summary).toContain('바꿀 것이 없어요');
  });

  it('ChatGPT Plus만: Claude 카드를 쓸 수 있는 Codex로 옮긴다', () => {
    const result = optimizeRecipe(researchTeam, plans({ openai: 'plus', anthropic: 'free' }), providerData);
    expect(result.changes).toHaveLength(3);
    expect(result.changes.every((change) => change.to === 'codex-cli')).toBe(true);
  });

  it('Claude Pro + ChatGPT 무료: 조사원(가벼운 역할)은 무료 한도로 옮겨 유료 한도를 아낀다', () => {
    const result = optimizeRecipe(researchTeam, plans({ openai: 'free', anthropic: 'pro' }), providerData);
    const moved = result.changes.map((change) => change.cardId).sort();
    expect(moved).toEqual(['rt-facts', 'rt-risks']);
    expect(result.changes[0].reason).toContain('유료 한도를 아낄');
  });

  it('쓸 수 있는 도구가 없으면 아무것도 제안하지 않는다', () => {
    const result = optimizeRecipe(crossReview, plans(), providerData);
    expect(result.changes).toEqual([]);
  });

  it('적용하면 도구가 바뀐 카드의 모델 이름을 지운다', () => {
    const recipe: Recipe = {
      ...planBuildReview,
      cards: planBuildReview.cards.map((card) => ({ ...card, model: 'gpt-6.1-sol' })),
    };
    const mine = plans({ openai: 'pro', anthropic: 'max' });
    const applied = applyOptimization(recipe, optimizeRecipe(recipe, mine, providerData));
    const moved = applied.cards.find((card) => card.id === 'pbr-reviewer')!;
    expect(moved.preferredEngine).toBe('claude-code');
    expect(moved.model).toBeUndefined();
    expect(applied.cards.find((card) => card.id === 'pbr-planner')!.model).toBe('gpt-6.1-sol');
  });
});

describe('Claude Code에서 Codex 부르기 (codex exec 다리)', () => {
  it('Claude 카드와 Codex 카드가 섞인 레시피에서만 쓴다', () => {
    expect(needsCodexBridge(crossReview)).toBe(true);
    expect(needsCodexBridge(planBuildReview)).toBe(false);
    expect(needsCodexBridge(researchTeam)).toBe(false);
  });

  it('다리 파일은 Bash로 codex exec를 실행하게 하고, 읽기 전용 카드는 read-only 샌드박스를 쓴다', () => {
    const text = codexBridgeMd(crossReview.cards[1]);
    expect(frontmatter(text)).toMatchObject({ name: 'reviewer', tools: 'Bash, Read' });
    expect(text).toContain('codex exec --sandbox read-only "reviewer 에이전트에게');
    // Claude Code가 읽을 수 있는 올바른 서브에이전트 파일이어야 한다
    expect(claudeMdToCard(text).name).toBe('reviewer');
  });

  it('옵션을 켜면 Codex 담당 카드의 Claude용 파일만 다리로 바뀐다', () => {
    const off = buildRecipeFiles(crossReview, providerData);
    const on = buildRecipeFiles(crossReview, providerData, { codexBridge: true });
    const path = (name: string) => Object.keys(on).find((key) => key.endsWith(`.claude/agents/${name}.md`))!;
    expect(on[path('reviewer')]).toContain('codex exec');
    expect(off[path('reviewer')]).not.toContain('codex exec');
    expect(on[path('writer')]).toBe(off[path('writer')]);
    // Codex용 파일과 recipe.json은 그대로
    const toml = Object.keys(on).find((key) => key.endsWith('.codex/agents/reviewer.toml'))!;
    expect(on[toml]).toBe(off[toml]);
    const md = Object.entries(on).find(([key]) => key.endsWith('RECIPE.md'))![1];
    expect(md).toContain('Claude Code에서 Codex 자동 호출');
  });

  it('섞이지 않은 레시피에서는 옵션을 켜도 아무것도 바뀌지 않는다', () => {
    expect(buildRecipeFiles(planBuildReview, providerData, { codexBridge: true })).toEqual(
      buildRecipeFiles(planBuildReview, providerData),
    );
  });
});
