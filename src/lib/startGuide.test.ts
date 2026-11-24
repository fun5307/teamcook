import { describe, expect, it } from 'vitest';
import { builtinRecipes } from '../data/recipes';
import { runPrompt } from './recipeMd';
import { startCommandLines, startPrompt, startTools, TASK_PLACEHOLDERS, withTask } from './startGuide';

const byStyle = (style: 'subagents' | 'agent-team' | 'debate') =>
  builtinRecipes.find((recipe) => (recipe.collaboration ?? 'subagents') === style)!;

describe('시작 안내: 도구 고르기', () => {
  it('서브에이전트는 Claude Code·Codex, 에이전트 팀은 Claude Code만, 토론형은 도구 없음', () => {
    expect(startTools(byStyle('subagents'))).toEqual(['claude', 'codex']);
    expect(startTools(byStyle('agent-team'))).toEqual(['claude']);
    expect(startTools(byStyle('debate'))).toEqual([]);
  });
});

describe('시작 안내: 할 일 채우기', () => {
  it('기본 레시피 전부의 프롬프트에 "적으세요" 자리가 있다 (문장이 바뀌면 여기서 알린다)', () => {
    for (const recipe of builtinRecipes) {
      const prompt = runPrompt(recipe);
      expect(TASK_PLACEHOLDERS.some((placeholder) => prompt.includes(placeholder)), recipe.id).toBe(true);
    }
  });

  it('쓴 할 일이 자리에 들어가고 자리 문구는 사라진다', () => {
    for (const recipe of builtinRecipes) {
      const filled = startPrompt(recipe, '로그인 버그 고치기');
      expect(filled, recipe.id).toContain('로그인 버그 고치기');
      for (const placeholder of TASK_PLACEHOLDERS) expect(filled, recipe.id).not.toContain(placeholder);
    }
  });

  it('비어 있거나 공백뿐이면 프롬프트를 그대로 둔다', () => {
    const recipe = byStyle('subagents');
    expect(startPrompt(recipe, '')).toBe(runPrompt(recipe));
    expect(startPrompt(recipe, '   ')).toBe(runPrompt(recipe));
  });

  it('할 일에 $ 같은 글자가 있어도 그대로 들어간다', () => {
    expect(withTask(`할 일: ${TASK_PLACEHOLDERS[0]}`, '비용 $& 줄이기')).toBe('할 일: 비용 $& 줄이기');
  });
});

describe('시작 안내: 시작 명령', () => {
  it('프로젝트 경로를 알면 그 폴더로 이동한 뒤 도구를 시작한다', () => {
    expect(startCommandLines('claude', 'C:\\work\\my app')).toEqual(['cd "C:\\work\\my app"', 'claude']);
    expect(startCommandLines('codex', '/home/me/app')).toEqual(['cd "/home/me/app"', 'codex']);
  });

  it('경로를 모르면 도구 이름만 준다', () => {
    expect(startCommandLines('claude', null)).toEqual(['claude']);
    expect(startCommandLines('claude', '  ')).toEqual(['claude']);
  });

  it('셸이 따로 해석하는 글자가 든 경로는 명령에 넣지 않는다', () => {
    for (const path of ['/tmp/a"; rm -rf ~; "', '/tmp/$(whoami)', '/tmp/`id`', '/tmp/a\nb']) {
      expect(startCommandLines('claude', path), path).toEqual(['claude']);
    }
  });
});
