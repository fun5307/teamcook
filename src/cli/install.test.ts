import { describe, expect, it } from 'vitest';
import { codexTomlToCard } from '../converters/codex';
import { builtinRecipes } from '../data/recipes';
import { buildShareLink, encodeRecipe } from '../lib/share';
import { planInstall, recipeFromLink } from './install';

const [crossReview] = builtinRecipes;
const link = buildShareLink(crossReview, 'https://teamcook-eta.vercel.app/').url;

describe('teamcook add <링크> — 설치 계획', () => {
  it('공유 링크에서 레시피를 꺼낸다 (전체 주소, #r=…, 압축 문자열 모두)', () => {
    for (const input of [link, link.slice(link.indexOf('#')), encodeRecipe(crossReview)]) {
      expect(recipeFromLink(input)).toEqual({ ok: true, recipe: crossReview });
    }
  });

  it('에이전트 파일은 프로젝트 맨 위 폴더에, 설명서와 원본은 .teamcook/ 아래에 둔다', () => {
    const plan = planInstall(link);
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.files.map((file) => file.path).sort()).toEqual(
      [
        '.claude/agents/reviewer.md',
        '.claude/agents/writer.md',
        '.codex/agents/reviewer.toml',
        '.codex/agents/writer.toml',
        '.codex/config.toml',
        '.teamcook/Claude-작성-+-Codex-교차-검토/RECIPE.md',
        '.teamcook/Claude-작성-+-Codex-교차-검토/recipe.json',
      ].sort(),
    );
    const toml = plan.files.find((file) => file.path === '.codex/agents/reviewer.toml')!;
    expect(codexTomlToCard(toml.content).name).toBe('reviewer');
  });

  it('.codex/config.toml만 "절대 덮어쓰지 않음"으로 표시한다', () => {
    const plan = planInstall(link);
    if (!plan.ok) throw new Error(plan.error);
    const protectedFiles = plan.files.filter((file) => file.neverOverwrite).map((file) => file.path);
    expect(protectedFiles).toEqual(['.codex/config.toml']);
  });

  it('설치 경로가 프로젝트 폴더 밖으로 나가지 않는다', () => {
    const evil = { ...crossReview, title: '../../바깥', cards: [{ ...crossReview.cards[0], name: '../../../etc/x' }] };
    const plan = planInstall(encodeRecipe({ ...evil, handoffs: [] }));
    if (!plan.ok) throw new Error(plan.error);
    for (const file of plan.files) {
      expect(file.path.split('/')).not.toContain('..');
      expect(file.path.startsWith('/')).toBe(false);
    }
  });

  it('--codex-bridge를 주면 Codex 담당 카드의 Claude용 파일이 codex exec 다리가 된다', () => {
    const plan = planInstall(link, { codexBridge: true });
    if (!plan.ok) throw new Error(plan.error);
    const bridge = plan.files.find((file) => file.path === '.claude/agents/reviewer.md')!;
    expect(bridge.content).toContain('codex exec');
  });

  it('공유 링크가 아니거나 깨졌으면 친절한 오류를 돌려준다', () => {
    expect(planInstall('https://example.com/#/plans')).toMatchObject({ ok: false });
    expect(planInstall('https://example.com/#r=!!!!')).toMatchObject({ ok: false });
  });
});
