import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import type { AgentCard, Recipe } from '../types';
import {
  CODEX_READONLY_GUARD,
  cardToCodexToml,
  codexConfigToSettings,
  codexTomlToCard,
  recipeToCodexConfig,
} from './codex';
import { ConvertError } from './meta';

/** 두 TOML이 "뜻이 같은지" 비교한다 (지시문 앞뒤 공백 차이는 무시). */
function sameToml(a: string, b: string) {
  const normalize = (text: string) => {
    const data = parse(text) as Record<string, unknown>;
    if (typeof data.developer_instructions === 'string') {
      data.developer_instructions = data.developer_instructions.replace(/\r\n?/g, '\n').trim();
    }
    return data;
  };
  expect(normalize(a)).toEqual(normalize(b));
}

const BRIEF_EXAMPLE = `name = "reviewer"
description = "변경된 파일의 버그와 보안 문제를 검토할 때 사용"
developer_instructions = """
너는 코드 검토자다. 파일을 수정하지 말고, 문제를 파일 경로·줄 번호와 함께 보고하라.
"""
`;

const baseCard: AgentCard = {
  id: 'card-1',
  name: 'reviewer',
  displayName: '검토자',
  role: '변경된 파일의 버그와 보안 문제를 검토할 때 사용',
  instructions: '너는 코드 검토자다.\n문제를 파일 경로·줄 번호와 함께 보고하라.',
  preferredEngine: 'codex-cli',
  model: 'gpt-6.1-sol',
  permission: 'read-only',
  tags: ['reviewer'],
};

describe('Codex 변환기: 파일 → 카드 → 파일', () => {
  it('지시서 5.1의 예시를 카드로 불러온다', () => {
    const card = codexTomlToCard(BRIEF_EXAMPLE, { id: 'x' });
    expect(card).toEqual({
      id: 'x',
      name: 'reviewer',
      displayName: 'reviewer',
      role: '변경된 파일의 버그와 보안 문제를 검토할 때 사용',
      instructions:
        '너는 코드 검토자다. 파일을 수정하지 말고, 문제를 파일 경로·줄 번호와 함께 보고하라.',
      preferredEngine: 'codex-cli',
      permission: 'full',
    });
  });

  it('지시서 예시가 왕복 변환 후에도 같은 뜻이다', () => {
    const card = codexTomlToCard(BRIEF_EXAMPLE);
    sameToml(cardToCodexToml(card), BRIEF_EXAMPLE);
  });

  it('공식 문서 예시(model, model_reasoning_effort, skills.config)가 왕복 후에도 같다', () => {
    const official = `name = "ui_fixer"
description = "Implementation-focused agent for small, targeted fixes after the issue is understood."
model = "gpt-6-luna"
model_reasoning_effort = "high"
developer_instructions = """
Own the fix once the issue is reproduced.
Make the smallest defensible change, keep unrelated files untouched, and validate only the behavior you changed.
"""

[[skills.config]]
path = "/Users/me/.agents/skills/docs-editor/SKILL.md"
enabled = false
`;
    const card = codexTomlToCard(official);
    expect(card.model).toBe('gpt-6-luna');
    expect(card.extra?.codex).toEqual({
      model_reasoning_effort: 'high',
      skills: {
        config: [{ path: '/Users/me/.agents/skills/docs-editor/SKILL.md', enabled: false }],
      },
    });
    sameToml(cardToCodexToml(card), official);
  });

  it('형식에 없는 필드는 extra.codex에 보존되고 다시 내보낼 때 살아난다', () => {
    const text = `name = "a"
description = "b"
nickname_candidates = ["Atlas", "Delta"]
developer_instructions = "c"

[features]
shell_tool = false
`;
    const card = codexTomlToCard(text);
    expect(card.extra?.codex).toEqual({
      nickname_candidates: ['Atlas', 'Delta'],
      features: { shell_tool: false },
    });
    sameToml(cardToCodexToml(card), text);
  });

  it('윈도우 줄바꿈(CRLF) 파일도 읽는다', () => {
    const card = codexTomlToCard(BRIEF_EXAMPLE.replace(/\n/g, '\r\n'));
    expect(card.instructions).not.toContain('\r');
    expect(card.name).toBe('reviewer');
  });
});

describe('Codex 변환기: 카드 → 파일 → 카드', () => {
  it('읽기 전용 카드가 왕복 후에도 같다 (표시 이름·태그·권한 포함)', () => {
    const toml = cardToCodexToml(baseCard);
    expect(codexTomlToCard(toml, { id: baseCard.id })).toEqual(baseCard);
  });

  it('읽기 전용 카드는 지시문 끝에 "수정하지 마라" 문장이 붙는다', () => {
    const data = parse(cardToCodexToml(baseCard)) as Record<string, string>;
    expect(data.developer_instructions.trim().endsWith(CODEX_READONLY_GUARD)).toBe(true);
    // Codex가 덮어쓰기를 무시하는 sandbox_mode는 쓰지 않는다
    expect(data.sandbox_mode).toBeUndefined();
  });

  it('편집·제한 없음 카드가 왕복 후에도 같다', () => {
    for (const permission of ['edit', 'full'] as const) {
      const card: AgentCard = { ...baseCard, permission, tags: ['implementer'] };
      expect(codexTomlToCard(cardToCodexToml(card), { id: card.id })).toEqual(card);
    }
  });

  it('Claude용 카드를 Codex 형식으로 내보내면 Claude 모델 이름을 model에 쓰지 않는다', () => {
    const card: AgentCard = {
      ...baseCard,
      preferredEngine: 'claude-code',
      model: 'sonnet',
      tools: ['Read', 'Grep'],
    };
    const toml = cardToCodexToml(card);
    expect((parse(toml) as Record<string, unknown>).model).toBeUndefined();
    expect(codexTomlToCard(toml, { id: card.id })).toEqual(card);
  });

  it('따옴표·역슬래시·삼중 따옴표가 들어간 지시문도 안전하게 왕복한다', () => {
    const card: AgentCard = {
      ...baseCard,
      permission: 'full',
      role: '경로 "C:\\temp" 를 다루는 역할',
      instructions: '경로는 C:\\Users\\me 이다.\n"""삼중 따옴표"""도 쓴다.\n끝이 따옴표"',
    };
    expect(codexTomlToCard(cardToCodexToml(card), { id: card.id })).toEqual(card);
  });

  it('extra.codex가 있는 카드도 왕복 후에 같다', () => {
    const card: AgentCard = {
      ...baseCard,
      extra: { codex: { model_reasoning_effort: 'high', features: { apps: false } } },
    };
    expect(codexTomlToCard(cardToCodexToml(card), { id: card.id })).toEqual(card);
  });
});

describe('Codex 변환기: 사용자의 실제 TOML 샘플 (samples/codex)', () => {
  const dir = path.resolve(process.cwd(), 'samples/codex');
  const files = readdirSync(dir).filter((file) => file.endsWith('.toml'));

  it('샘플이 1개 이상 있다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s 를 카드로 불러오고 다시 내보내도 뜻이 같다', (file) => {
    const original = readFileSync(path.join(dir, file), 'utf8');
    const card = codexTomlToCard(original);
    expect(card.name).toBe(file.replace(/\.toml$/, ''));
    expect(card.role.length).toBeGreaterThan(5);
    expect(card.instructions.length).toBeGreaterThan(50);
    expect(card.preferredEngine).toBe('codex-cli');
    sameToml(cardToCodexToml(card), original);
  });
});

describe('Codex 변환기: 오류 처리', () => {
  it('필수 항목이 없으면 무엇이 없는지 알려 준다', () => {
    expect(() => codexTomlToCard('name = "a"')).toThrow(ConvertError);
    expect(() => codexTomlToCard('name = "a"')).toThrow(/description, developer_instructions/);
  });

  it('TOML이 아니면 친절한 오류를 낸다', () => {
    expect(() => codexTomlToCard('이건 TOML이 아님 ===')).toThrow(/TOML 형식/);
  });
});

describe('Codex 프로젝트 설정 (.codex/config.toml)', () => {
  const recipe = {
    title: '테스트 레시피',
    settings: { maxThreads: 3, maxDepth: 1 },
  } as Recipe;

  it('동시 실행 수를 공식 키 이름으로 내보낸다', () => {
    const data = parse(recipeToCodexConfig(recipe)) as { agents: Record<string, number> };
    expect(data.agents).toEqual({ max_concurrent_threads_per_session: 3 });
  });

  it('새 키와 옛 키(max_threads)를 모두 읽는다', () => {
    expect(codexConfigToSettings(recipeToCodexConfig(recipe))).toEqual({ maxThreads: 3 });
    expect(codexConfigToSettings('[agents]\nmax_threads = 5\nmax_depth = 2')).toEqual({
      maxThreads: 5,
      maxDepth: 2,
    });
  });
});

describe('메타 주석 이름 (teamcook, 옛 이름 agent-recipes)', () => {
  it('새로 내보내는 파일은 "# teamcook:" 주석을 쓴다', () => {
    expect(cardToCodexToml(baseCard).startsWith('# teamcook: {')).toBe(true);
  });

  it('이름을 바꾸기 전에 내보낸 "# agent-recipes:" 파일도 그대로 읽는다', () => {
    const old = cardToCodexToml(baseCard).replace('# teamcook:', '# agent-recipes:');
    expect(codexTomlToCard(old, { id: baseCard.id })).toEqual(baseCard);
  });
});
