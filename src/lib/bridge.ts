// 교차 모델 연결 도우미 (PROJECT_BRIEF.md 7단계).
//
// 원래 계획은 "Claude Code에서 Codex를 MCP 서버로 부르기"였지만,
// 2026-11-16 확인 결과 Codex의 MCP 서버(`codex mcp-server`)는 제거됐다.
//   https://learn.chatgpt.com/docs/mcp-server
// 그래서 Codex의 비대화형 실행 명령 `codex exec`를 쓴다:
// Claude Code용 서브에이전트가 직접 일하지 않고, Bash로 `codex exec`를 실행해
// 같은 이름의 Codex 에이전트에게 일을 넘기고 결과를 그대로 돌려준다.

import { stringify as stringifyYaml } from 'yaml';
import type { AgentCard, Recipe } from '../types';

/** Claude Code 카드와 Codex 카드가 섞인 레시피에서만 다리가 의미가 있다. */
export function needsCodexBridge(recipe: Recipe): boolean {
  const engines = new Set(recipe.cards.map((card) => card.preferredEngine));
  return engines.has('claude-code') && engines.has('codex-cli');
}

/** Codex 담당 카드를 Claude Code에서 부르기 위한 '다리' 서브에이전트 파일 내용 */
export function codexBridgeMd(card: AgentCard): string {
  const sandbox = card.permission === 'read-only' ? 'read-only' : 'workspace-write';
  const frontmatter = {
    name: card.name,
    description: `${card.role} (Codex에게 맡겨서 처리한다)`,
    tools: 'Bash, Read',
  };
  const body = [
    `너는 '${card.displayName || card.name}' 역할의 연결 담당이다. 이 역할의 실제 작업은 OpenAI Codex가 한다.`,
    '너는 직접 분석하거나 고치지 말고, 아래 순서대로 Codex에게 일을 넘기고 결과를 전달만 한다.',
    '',
    '1. 부모에게서 받은 요청을 한 문단으로 정리한다. 필요한 파일 경로와 맥락을 빠짐없이 넣는다',
    '   (Codex는 이 대화를 볼 수 없다).',
    '2. 아래 명령을 Bash로 실행한다. `<요청>` 자리에 1번에서 정리한 내용을 넣는다.',
    '',
    '```bash',
    `codex exec --sandbox ${sandbox} "${card.name} 에이전트에게 다음 일을 맡기고, 그 결과를 그대로 보고해 줘: <요청>"`,
    '```',
    '',
    '3. Codex가 출력한 결과를 요약하거나 고치지 말고 그대로 부모에게 전달한다.',
    '4. 명령이 실패하면(설치·로그인 문제, 사용량 한도 등) 오류 메시지를 그대로 전달하고 멈춘다.',
    '   직접 대신 처리하지 않는다.',
  ].join('\n');
  const head = `# teamcook: ${JSON.stringify({ bridge: 'codex-exec' })}`;
  return `---\n${head}\n${stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n\n${body}\n`;
}
