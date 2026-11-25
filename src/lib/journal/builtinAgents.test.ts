import { describe, expect, it } from 'vitest';
import { BUILTIN_AGENTS, builtinAgent } from './builtinAgents';

describe('builtinAgent', () => {
  it('Claude Code 기본 도우미 7종', () => {
    for (const name of ['web-fetch', 'Explore', 'Plan', 'general-purpose', 'claude', 'claude-code-guide', 'statusline-setup']) {
      expect(builtinAgent(name)?.tool, name).toBe('claude-code');
    }
    expect(builtinAgent('web-fetch')?.who).toContain('웹 페이지');
  });

  it('Codex 기본 도우미 3종', () => {
    for (const name of ['default', 'worker', 'explorer']) {
      expect(builtinAgent(name)?.tool, name).toBe('codex-cli');
    }
  });

  it('도구를 주면 그 도구의 도우미일 때만 돌려준다', () => {
    expect(builtinAgent('worker', 'codex-cli')).not.toBeNull();
    expect(builtinAgent('worker', 'claude-code')).toBeNull();
    expect(builtinAgent('Explore', 'codex-cli')).toBeNull();
  });

  it('모르는 이름은 지어내지 않고 null이다', () => {
    expect(builtinAgent('reviewer')).toBeNull();
    expect(builtinAgent('explore')).toBeNull(); // 이름이 정확히 같을 때만
    expect(builtinAgent('quality_review')).toBeNull();
  });

  it('Object 기본 속성 이름에 속지 않는다', () => {
    expect(builtinAgent('constructor')).toBeNull();
    expect(builtinAgent('toString')).toBeNull();
    expect(builtinAgent('__proto__')).toBeNull();
  });

  it('모든 항목에 소개·설명·불리는 때가 있다', () => {
    for (const [name, agent] of Object.entries(BUILTIN_AGENTS)) {
      expect(agent.who.length, name).toBeGreaterThan(5);
      expect(agent.detail.length, name).toBeGreaterThan(10);
      expect(agent.calledWhen.length, name).toBeGreaterThan(10);
    }
  });
});
