import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { builtinRecipes } from '../../data/recipes';
import { StartGuide } from './StartGuide';

const pick = (style: 'subagents' | 'agent-team' | 'debate') =>
  builtinRecipes.find((recipe) => (recipe.collaboration ?? 'subagents') === style)!;

const html = (style: 'subagents' | 'agent-team' | 'debate', path: string | null, settingsSkipped = false) =>
  renderToStaticMarkup(createElement(StartGuide, { recipe: pick(style), projectPath: path, settingsSkipped }));

describe('시작하기 안내 화면', () => {
  it('서브에이전트: 도구 두 개를 고르고, 경로를 알면 cd 명령이 보인다', () => {
    const out = html('subagents', 'C:\\work\\app');
    expect(out).toContain('Claude Code');
    expect(out).toContain('Codex');
    expect(out).toContain('cd &quot;C:\\work\\app&quot;');
    expect(out).toContain('프롬프트 복사');
    expect(out).not.toContain('전체 경로를 몰라요');
  });

  it('경로를 모르면(웹의 폴더 열기) cd 없이 안내 문구를 보인다', () => {
    const out = html('subagents', null);
    expect(out).not.toContain('cd &quot;');
    expect(out).toContain('전체 경로를 몰라요');
  });

  it('에이전트 팀: Claude Code만, 새로 시작하라는 안내가 있고 설정이 이미 있으면 병합 안내가 뜬다', () => {
    const plain = html('agent-team', '/home/me/app');
    expect(plain).not.toContain('>Codex<');
    expect(plain).toContain('새로 시작');
    expect(plain).not.toContain('border-amber-200');
    expect(html('agent-team', '/home/me/app', true)).toContain('border-amber-200');
  });

  it('토론형: 시작 명령 단계 없이 주제와 프롬프트만 보인다', () => {
    const out = html('debate', '/home/me/app');
    expect(out).not.toContain('cd &quot;');
    expect(out).toContain('맡길 주제');
    expect(out).toContain('AI 채팅에 붙여 넣기');
  });
});
