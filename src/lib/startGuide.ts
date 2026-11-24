// 레시피를 폴더에 들인 직후의 "시작하기" 안내에 쓰는 순수 로직.
// teamcook은 아무것도 실행하지 않는다. 사용자가 터미널에 붙여 넣을 명령과 프롬프트를 '준비해 줄' 뿐이다.

import { collaborationOf } from '../data/collaboration';
import type { Recipe } from '../types';
import { runPrompt } from './recipeMd';

export type StartTool = 'claude' | 'codex';

export const START_TOOL_LABELS: Record<StartTool, string> = { claude: 'Claude Code', codex: 'Codex' };

/** 프롬프트 속 "여기에 적으세요" 자리. recipeMd.ts의 프롬프트 문장과 같아야 한다(테스트가 확인한다). */
export const TASK_PLACEHOLDERS = ['(여기에 요청을 적으세요)', '(여기에 결정하고 싶은 것을 적으세요)'];

/**
 * 이 레시피를 시작할 수 있는 도구.
 * 에이전트 팀은 Claude Code 전용, 토론형은 설정 파일이 없어 쓰는 AI 채팅에 붙여 넣기만 한다(도구 없음).
 */
export function startTools(recipe: Recipe): StartTool[] {
  const style = collaborationOf(recipe);
  if (style === 'agent-team') return ['claude'];
  if (style === 'debate') return [];
  return ['claude', 'codex'];
}

/** 프롬프트의 "적으세요" 자리를 사용자가 쓴 할 일로 바꾼다. 비어 있으면 그대로 둔다. */
export function withTask(prompt: string, task: string): string {
  const text = task.trim();
  if (!text) return prompt;
  return TASK_PLACEHOLDERS.reduce((result, placeholder) => result.split(placeholder).join(text), prompt);
}

/** 붙여 넣기 위험한 글자(셸이 따로 해석하는 것)가 들어 있는 경로는 명령에 넣지 않는다 */
const UNSAFE_IN_COMMAND = /["`$\r\n]/;

/**
 * 터미널에 붙여 넣을 시작 명령(줄 단위). 프로젝트 경로를 알면 먼저 그 폴더로 이동한다.
 * 경로를 모르거나(웹의 폴더 열기는 전체 경로를 알려 주지 않는다) 안전하지 않으면 도구 이름만 돌려준다.
 */
export function startCommandLines(tool: StartTool, projectPath: string | null | undefined): string[] {
  const path = projectPath?.trim();
  if (!path || UNSAFE_IN_COMMAND.test(path)) return [tool];
  return [`cd "${path}"`, tool];
}

/** 화면에 보여 주고 복사할 시작 프롬프트 */
export function startPrompt(recipe: Recipe, task: string): string {
  return withTask(runPrompt(recipe), task);
}
