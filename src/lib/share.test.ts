import JSZip from 'jszip';
import { parse as parseToml } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { claudeMdToCard } from '../converters/claude';
import { codexTomlToCard } from '../converters/codex';
import { providerData } from '../data/providers';
import { builtinRecipes } from '../data/recipes';
import type { Recipe } from '../types';
import { buildRecipeFiles, buildRecipeZip, safeName, zipFileName } from './exportZip';
import { starterPrompt } from './recipeMd';
import { RecipeFormatError, parseRecipe } from './recipeSchema';
import {
  SHARE_WARN_LENGTH,
  buildShareLink,
  decodeRecipe,
  encodeRecipe,
  readShareHash,
} from './share';

const [crossReview, planBuildReview] = builtinRecipes;
const BASE = 'https://agent-recipes.example/';

describe('공유 링크: 인코딩 → 디코딩 왕복', () => {
  it.each(builtinRecipes.map((recipe) => [recipe.title, recipe] as const))(
    '%s 레시피가 링크를 거쳐도 똑같다',
    (_title, recipe) => {
      const link = buildShareLink(recipe, BASE);
      const encoded = readShareHash(new URL(link.url).hash);
      expect(encoded).not.toBeNull();
      const result = decodeRecipe(encoded!);
      expect(result).toEqual({ ok: true, recipe });
    },
  );

  it('링크는 #r= 뒤에 URL에 안전한 글자만 쓴다', () => {
    const link = buildShareLink(crossReview, BASE);
    expect(link.url.startsWith(`${BASE}#r=`)).toBe(true);
    expect(link.url.slice(BASE.length + 3)).toMatch(/^[A-Za-z0-9+\-$_.!*'()]+$/);
  });

  it('기본 레시피 3종은 길이 경고 없이 공유된다', () => {
    for (const recipe of builtinRecipes) {
      const link = buildShareLink(recipe, BASE);
      expect(link.tooLong).toBe(false);
      expect(link.length).toBeLessThanOrEqual(SHARE_WARN_LENGTH);
    }
  });

  it('지시문이 아주 길면 길이 경고를 켠다', () => {
    const long: Recipe = {
      ...crossReview,
      cards: crossReview.cards.map((card, index) => ({
        ...card,
        // 압축이 잘 안 되도록 매번 다른 글자를 넣는다
        instructions: Array.from({ length: 3000 }, (_, i) => String.fromCharCode(0xac00 + ((i * 7919 + index * 31) % 11000))).join(''),
      })),
    };
    expect(buildShareLink(long, BASE).tooLong).toBe(true);
  });

  it('이미 #이 붙은 주소를 줘도 링크가 하나의 #만 가진다', () => {
    const link = buildShareLink(crossReview, `${BASE}#/edit/abc`);
    expect(link.url.split('#')).toHaveLength(2);
  });

  it('공유 링크가 아닌 주소는 null', () => {
    expect(readShareHash('')).toBeNull();
    expect(readShareHash('#/plans')).toBeNull();
    expect(readShareHash('#r=abc')).toBe('abc');
  });
});

describe('공유 링크: 손상된 링크와 버전 처리', () => {
  it('깨진 문자열은 친절한 오류를 돌려준다 (예외를 던지지 않는다)', () => {
    for (const bad of ['', '!!!!', 'abc', encodeRecipe(crossReview).slice(0, 40)]) {
      const result = decodeRecipe(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('링크');
    }
  });

  it('레시피가 아닌 JSON은 거절한다', () => {
    const encoded = encodeRecipe({ hello: 'world' } as unknown as Recipe);
    expect(decodeRecipe(encoded).ok).toBe(false);
  });

  it('더 새로운 schemaVersion은 새로고침 안내를 준다', () => {
    const future = encodeRecipe({ ...crossReview, schemaVersion: 99 } as unknown as Recipe);
    const result = decodeRecipe(future);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('새로운 버전');
  });

  it('schemaVersion이 없으면 거절한다', () => {
    const { schemaVersion: _removed, ...rest } = crossReview;
    expect(() => parseRecipe(rest)).toThrow(RecipeFormatError);
  });
});

describe('바깥 데이터 다듬기 (parseRecipe)', () => {
  it('모르는 엔진·권한은 기본값으로, 모르는 필드는 버린다', () => {
    const recipe = parseRecipe({
      schemaVersion: 1,
      title: '테스트',
      evil: '<script>alert(1)</script>',
      cards: [
        { id: 'a', name: 'one', preferredEngine: 'unknown-engine', permission: 'root', hack: true },
        { id: 'a', name: 'two' },
        { name: '' },
        'not-a-card',
      ],
      handoffs: [
        { from: 'a', to: 'missing' },
        { from: 'a', to: 'a', label: '자기 자신' },
      ],
      settings: { maxThreads: 9999, maxDepth: 'x' },
    });
    expect(recipe).not.toHaveProperty('evil');
    expect(recipe.cards).toHaveLength(2);
    expect(recipe.cards[0]).toMatchObject({ preferredEngine: 'codex-cli', permission: 'full' });
    expect(recipe.cards[0]).not.toHaveProperty('hack');
    // 겹치는 id는 새로 만든다
    expect(recipe.cards[1].id).not.toBe('a');
    // 없는 카드를 가리키는 화살표는 버린다
    expect(recipe.handoffs).toHaveLength(1);
    expect(recipe.settings).toEqual({ maxThreads: 20, maxDepth: 1 });
  });

  it('HTML이 들어 있어도 글자 그대로 보관한다 (화면에서는 텍스트로만 그린다)', () => {
    const recipe = parseRecipe({
      schemaVersion: 1,
      title: '<img src=x onerror=alert(1)>',
      cards: [],
    });
    expect(recipe.title).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('zip 내보내기', () => {
  it('지시서 5.4의 구조대로 파일을 만든다', () => {
    const files = buildRecipeFiles(planBuildReview, providerData);
    expect(Object.keys(files).sort()).toEqual(
      [
        '기획-→-구현-→-검토-(Codex만)/.claude/agents/implementer.md',
        '기획-→-구현-→-검토-(Codex만)/.claude/agents/planner.md',
        '기획-→-구현-→-검토-(Codex만)/.claude/agents/reviewer.md',
        '기획-→-구현-→-검토-(Codex만)/.codex/agents/implementer.toml',
        '기획-→-구현-→-검토-(Codex만)/.codex/agents/planner.toml',
        '기획-→-구현-→-검토-(Codex만)/.codex/agents/reviewer.toml',
        '기획-→-구현-→-검토-(Codex만)/.codex/config.toml',
        '기획-→-구현-→-검토-(Codex만)/RECIPE.md',
        '기획-→-구현-→-검토-(Codex만)/recipe.json',
      ].sort(),
    );
  });

  it('내보낸 파일을 다시 읽으면 원래 카드가 된다', () => {
    const files = buildRecipeFiles(crossReview, providerData);
    const root = safeName(crossReview.title, 'recipe');
    for (const card of crossReview.cards) {
      const toml = files[`${root}/.codex/agents/${card.name}.toml`];
      const md = files[`${root}/.claude/agents/${card.name}.md`];
      expect(codexTomlToCard(toml, { id: card.id })).toEqual(card);
      expect(claudeMdToCard(md, { id: card.id })).toEqual(card);
    }
    expect(parseRecipe(JSON.parse(files[`${root}/recipe.json`]))).toEqual(crossReview);
    const config = parseToml(files[`${root}/.codex/config.toml`]) as { agents: unknown };
    expect(config.agents).toEqual({ max_concurrent_threads_per_session: 2 });
  });

  it('RECIPE.md에 필요한 플랜, 실행 방법(터미널·T3 Code·1Code), 내 플랜 경로가 들어간다', () => {
    const plans = { openai: 'free', anthropic: 'free', google: 'none', xai: 'none', apiKeys: {} } as const;
    const files = buildRecipeFiles(crossReview, providerData, { plans });
    const md = files[`${safeName(crossReview.title, 'recipe')}/RECIPE.md`];
    expect(md).toContain('# Claude 작성 + Codex 교차 검토');
    expect(md).toContain('Claude Pro 필요 · ChatGPT 무료');
    expect(md).toContain('터미널에서 Codex로');
    expect(md).toContain('터미널에서 Claude Code로');
    expect(md).toContain('T3 Code · 1Code');
    expect(md).toContain('codex --sandbox read-only');
    expect(md).toContain('내 플랜 기준 실행 경로');
    expect(md).toContain('🔒');
    expect(md).toContain('2026-11-16 확인');
  });

  it('이름이 겹치는 카드는 파일 이름에 번호를 붙인다', () => {
    const duplicated: Recipe = {
      ...crossReview,
      cards: [crossReview.cards[0], { ...crossReview.cards[0], id: 'other' }],
      handoffs: [],
    };
    const paths = Object.keys(buildRecipeFiles(duplicated, providerData));
    expect(paths.some((path) => path.endsWith('.codex/agents/writer.toml'))).toBe(true);
    expect(paths.some((path) => path.endsWith('.codex/agents/writer-2.toml'))).toBe(true);
  });

  it('실제 zip을 만들고 다시 풀 수 있다', async () => {
    const bytes = await buildRecipeZip(crossReview, providerData);
    const zip = await JSZip.loadAsync(bytes);
    const root = safeName(crossReview.title, 'recipe');
    const toml = await zip.file(`${root}/.codex/agents/reviewer.toml`)!.async('string');
    expect(codexTomlToCard(toml).name).toBe('reviewer');
    expect(zipFileName(crossReview)).toBe('Claude-작성-+-Codex-교차-검토.zip');
  });

  it('파일 이름에 쓸 수 없는 글자를 바꾼다', () => {
    expect(safeName('a/b\\c:d*e?"f<g>h|i', 'x')).toBe('a-b-c-d-e-f-g-h-i');
    expect(safeName('   ', 'recipe')).toBe('recipe');
    expect(safeName('../..', 'recipe')).toBe('recipe');
  });
});

describe('첫 프롬프트 예시', () => {
  it('넘겨주기 순서를 문장으로 만든다', () => {
    const prompt = starterPrompt(planBuildReview);
    expect(prompt).toContain('1. planner가 먼저 일한다.');
    expect(prompt).toContain('2. planner의 결과(작업 계획: 단계별 계획 (바꿀 파일, 할 일, 확인 방법))를 implementer에게 넘긴다.');
    expect(prompt).toContain('4. reviewer의 결과(검토 결과: 지적 목록 (위치, 이유))를 implementer에게 넘긴다.');
    // 산출물이나 설명이 없는 넘겨주기는 예전처럼 괄호 없이 적는다
    const plain = starterPrompt({
      ...planBuildReview,
      cards: planBuildReview.cards.map(({ deliverables: _d, ...card }) => card),
      handoffs: planBuildReview.handoffs.map(({ label: _l, deliverableIds: _i, ...handoff }) => handoff),
    });
    expect(plain).toContain('2. planner의 결과를 implementer에게 넘긴다.');
  });

  it('넘겨주기가 없으면 에이전트 이름만 나열한다', () => {
    const prompt = starterPrompt({ ...crossReview, handoffs: [] });
    expect(prompt).toContain('writer, reviewer');
  });
});
