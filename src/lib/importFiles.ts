// 사용자가 고른 파일(.toml, .md, .json)을 카드나 레시피로 바꾼다.

import { claudeMdToCard } from '../converters/claude';
import {
  antigravityMdToCard,
  detectMarkdownEngine,
  grokMdToCard,
} from '../converters/markdownAgents';
import { codexTomlToCard } from '../converters/codex';
import type { AgentCard, Recipe } from '../types';
import { parseRecipe } from './recipeSchema';
import { suggestTags } from './roles';

export type ImportResult =
  | { kind: 'card'; fileName: string; card: AgentCard }
  | { kind: 'recipe'; fileName: string; recipe: Recipe }
  | { kind: 'error'; fileName: string; message: string };

/** 파일 하나(이름 + 내용)를 해석한다. 실패해도 예외를 던지지 않고 오류 결과를 돌려준다. */
export function importFile(fileName: string, text: string): ImportResult {
  const lower = fileName.toLowerCase();
  try {
    if (lower.endsWith('.toml')) {
      return { kind: 'card', fileName, card: withTags(codexTomlToCard(text)) };
    }
    if (lower.endsWith('.md')) {
      // .md는 Claude·Antigravity·Grok이 함께 쓰는 확장자라, 내용을 보고 형식을 고른다
      const engine = detectMarkdownEngine(text);
      const card =
        engine === 'antigravity-cli'
          ? antigravityMdToCard(text)
          : engine === 'grok-build'
            ? grokMdToCard(text)
            : claudeMdToCard(text);
      return { kind: 'card', fileName, card: withTags(card) };
    }
    if (lower.endsWith('.json')) {
      return { kind: 'recipe', fileName, recipe: parseRecipe(JSON.parse(text)) };
    }
    return {
      kind: 'error',
      fileName,
      message: '지원하지 않는 파일이에요. Codex(.toml), Claude·Antigravity·Grok(.md), 레시피(recipe.json)만 불러올 수 있어요.',
    };
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? 'JSON 형식을 읽을 수 없어요.'
        : error instanceof Error
          ? error.message
          : '파일을 읽을 수 없어요.';
    return { kind: 'error', fileName, message };
  }
}

/** 태그가 없는 카드는 이름과 설명으로 역할을 짐작해 붙인다. */
function withTags(card: AgentCard): AgentCard {
  if (card.tags && card.tags.length > 0) return card;
  const tags = suggestTags(card.name, card.role);
  return tags.length > 0 ? { ...card, tags } : card;
}
