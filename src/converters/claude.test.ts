import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import type { AgentCard } from '../types';
import { cardToClaudeMd, claudeMdToCard, permissionFromTools } from './claude';
import { cardToCodexToml, codexTomlToCard } from './codex';
import { ConvertError } from './meta';

/** 머리말과 본문으로 나눠 "뜻이 같은지" 비교한다. */
function split(text: string) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n?/g, '\n'));
  if (!match) throw new Error('머리말이 없음');
  const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
  if (Array.isArray(frontmatter.tools)) frontmatter.tools = frontmatter.tools.join(', ');
  return { frontmatter, body: match[2].trim() };
}
function sameMd(a: string, b: string) {
  expect(split(a)).toEqual(split(b));
}

const BRIEF_EXAMPLE = `---
name: reviewer
description: 변경된 파일의 버그와 보안 문제를 검토할 때 사용
tools: Read, Grep, Glob
---

너는 코드 검토자다. 파일을 수정하지 말고, 문제를 파일 경로·줄 번호와 함께 보고하라.
`;

const OFFICIAL_EXAMPLE = `---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
`;

const baseCard: AgentCard = {
  id: 'card-1',
  name: 'writer',
  displayName: '작성자',
  role: '기능을 구현하고 테스트를 작성할 때 사용',
  instructions: '너는 구현 담당이다.\n\n- 작게 바꾼다\n- 테스트를 붙인다',
  preferredEngine: 'claude-code',
  model: 'sonnet',
  permission: 'edit',
  tags: ['writer'],
};

describe('Claude 변환기: 파일 → 카드 → 파일', () => {
  it('지시서 5.2의 예시를 읽기 전용 카드로 불러온다', () => {
    expect(claudeMdToCard(BRIEF_EXAMPLE, { id: 'x' })).toEqual({
      id: 'x',
      name: 'reviewer',
      displayName: 'reviewer',
      role: '변경된 파일의 버그와 보안 문제를 검토할 때 사용',
      instructions:
        '너는 코드 검토자다. 파일을 수정하지 말고, 문제를 파일 경로·줄 번호와 함께 보고하라.',
      preferredEngine: 'claude-code',
      permission: 'read-only',
    });
  });

  it('지시서 예시와 공식 문서 예시가 왕복 후에도 같은 뜻이다', () => {
    for (const example of [BRIEF_EXAMPLE, OFFICIAL_EXAMPLE]) {
      sameMd(cardToClaudeMd(claudeMdToCard(example)), example);
    }
  });

  it('공식 예시처럼 도구 순서가 기본과 달라도 순서를 지킨다', () => {
    const card = claudeMdToCard(OFFICIAL_EXAMPLE);
    expect(card.tools).toEqual(['Read', 'Glob', 'Grep']);
    expect(card.permission).toBe('read-only');
    expect(card.model).toBe('sonnet');
  });

  it('형식에 없는 필드는 extra.claude에 보존되고 다시 내보낼 때 살아난다', () => {
    const text = `---
name: db-reader
description: "읽기 전용 쿼리를 실행할 때 사용: 분석용"
tools:
  - Read
  - Bash(git diff:*, git log:*)
disallowedTools: Write, Edit
permissionMode: plan
maxTurns: 12
memory: project
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: ./scripts/validate.sh
---

본문입니다.
`;
    const card = claudeMdToCard(text);
    expect(card.tools).toEqual(['Read', 'Bash(git diff:*, git log:*)']);
    expect(card.permission).toBe('edit');
    expect(card.extra?.claude).toEqual({
      disallowedTools: 'Write, Edit',
      permissionMode: 'plan',
      maxTurns: 12,
      memory: 'project',
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: './scripts/validate.sh' }] },
        ],
      },
    });
    sameMd(cardToClaudeMd(card), text);
  });

  it('tools가 없으면 "제한 없음" 카드가 되고, 다시 내보낼 때도 tools를 쓰지 않는다', () => {
    const text = '---\nname: helper\ndescription: 무엇이든 돕는다\n---\n\n도와라.\n';
    const card = claudeMdToCard(text);
    expect(card.permission).toBe('full');
    expect(card.tools).toBeUndefined();
    expect(split(cardToClaudeMd(card)).frontmatter.tools).toBeUndefined();
  });

  it('윈도우 줄바꿈(CRLF)과 본문 속 --- 구분선도 처리한다', () => {
    const text = `${BRIEF_EXAMPLE}\n---\n\n구분선 아래 내용`.replace(/\n/g, '\r\n');
    const card = claudeMdToCard(text);
    expect(card.name).toBe('reviewer');
    expect(card.instructions).toContain('구분선 아래 내용');
    expect(card.instructions).not.toContain('\r');
  });
});

describe('Claude 변환기: 카드 → 파일 → 카드', () => {
  it('편집 카드가 왕복 후에도 같다 (표시 이름·태그·모델 포함)', () => {
    expect(claudeMdToCard(cardToClaudeMd(baseCard), { id: baseCard.id })).toEqual(baseCard);
  });

  it('읽기 전용 카드는 읽기 도구만 받는다', () => {
    const card: AgentCard = { ...baseCard, permission: 'read-only', tags: ['reviewer'] };
    const md = cardToClaudeMd(card);
    expect(split(md).frontmatter.tools).toBe('Read, Grep, Glob');
    expect(claudeMdToCard(md, { id: card.id })).toEqual(card);
  });

  it('제한 없음 카드는 tools를 쓰지 않는다', () => {
    const card: AgentCard = { ...baseCard, permission: 'full' };
    const md = cardToClaudeMd(card);
    expect(split(md).frontmatter.tools).toBeUndefined();
    expect(claudeMdToCard(md, { id: card.id })).toEqual(card);
  });

  it('Codex용 카드를 Claude 형식으로 내보내면 GPT 모델 이름을 model에 쓰지 않는다', () => {
    const card: AgentCard = {
      ...baseCard,
      preferredEngine: 'codex-cli',
      model: 'gpt-6.1-sol',
      permission: 'read-only',
    };
    const md = cardToClaudeMd(card);
    expect(split(md).frontmatter.model).toBeUndefined();
    expect(claudeMdToCard(md, { id: card.id })).toEqual(card);
  });

  it('도구 목록과 권한이 어긋나도(사용자가 직접 지정) 권한을 잃지 않는다', () => {
    const card: AgentCard = { ...baseCard, permission: 'read-only', tools: ['Read', 'Bash'] };
    expect(claudeMdToCard(cardToClaudeMd(card), { id: card.id })).toEqual(card);
  });

  it('콜론·따옴표·#이 들어간 설명도 안전하게 왕복한다', () => {
    const card: AgentCard = {
      ...baseCard,
      role: '주의: "보안" 검토 # 주석 아님 - 변경된 파일만',
      instructions: '---\n본문이 구분선으로 시작해도 된다\n---\n끝',
    };
    expect(claudeMdToCard(cardToClaudeMd(card), { id: card.id })).toEqual(card);
  });

  it('extra.claude가 있는 카드도 왕복 후에 같다', () => {
    const card: AgentCard = { ...baseCard, extra: { claude: { maxTurns: 5, color: 'blue' } } };
    expect(claudeMdToCard(cardToClaudeMd(card), { id: card.id })).toEqual(card);
  });
});

describe('두 형식 사이 변환 (Codex ↔ Claude)', () => {
  it('Codex 파일을 불러와 Claude 형식으로 내보내도 이름·설명·지시문이 같다', () => {
    const toml =
      'name = "data_scout"\ndescription = "데이터 조사"\ndeveloper_instructions = "조사하라."\n';
    const card = codexTomlToCard(toml);
    const { frontmatter, body } = split(cardToClaudeMd(card));
    expect(frontmatter.name).toBe('data_scout');
    expect(frontmatter.description).toBe('데이터 조사');
    expect(body).toBe('조사하라.');
  });

  it('Claude 읽기 전용 카드를 Codex로 보냈다가 다시 읽어도 읽기 전용이다', () => {
    const card = claudeMdToCard(BRIEF_EXAMPLE, { id: 'x' });
    expect(codexTomlToCard(cardToCodexToml(card), { id: 'x' })).toEqual(card);
  });
});

describe('Claude 변환기: 권한 짐작과 오류 처리', () => {
  it('도구 목록으로 권한을 짐작한다', () => {
    expect(permissionFromTools(undefined)).toBe('full');
    expect(permissionFromTools(['Read', 'Grep', 'WebSearch'])).toBe('read-only');
    expect(permissionFromTools(['Read', 'Bash(git diff:*)'])).toBe('edit');
  });

  it('머리말이 없으면 친절한 오류를 낸다', () => {
    expect(() => claudeMdToCard('그냥 글')).toThrow(ConvertError);
    expect(() => claudeMdToCard('그냥 글')).toThrow(/머리말/);
  });

  it('필수 항목이 없으면 무엇이 없는지 알려 준다', () => {
    expect(() => claudeMdToCard('---\nname: a\n---\n본문')).toThrow(/description/);
  });
});
