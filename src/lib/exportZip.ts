// 레시피를 zip으로 내보낸다 (PROJECT_BRIEF.md 5.4).
//   <recipe-name>/
//   ├─ .codex/agents/*.toml
//   ├─ .codex/config.toml
//   ├─ .claude/agents/*.md
//   ├─ recipe.json   (다시 불러오기용 원본)
//   └─ RECIPE.md     (사람용 설명서)

import JSZip from 'jszip';
import { cardToClaudeMd } from '../converters/claude';
import { cardToCodexToml, recipeToCodexConfig } from '../converters/codex';
import type { ProviderData, Recipe, UserPlans } from '../types';
import { buildRecipeMd } from './recipeMd';

/** 파일·폴더 이름으로 쓸 수 없는 글자를 -로 바꾼다. 한글은 그대로 둔다. */
export function safeName(value: string, fallback: string): string {
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

/** zip에 들어갈 파일들을 { 경로: 내용 }으로 만든다. (테스트하기 쉽게 zip과 분리) */
export function buildRecipeFiles(
  recipe: Recipe,
  providers: ProviderData,
  plans?: UserPlans,
): Record<string, string> {
  const root = safeName(recipe.title, 'recipe');
  const files: Record<string, string> = {};
  const used = new Set<string>();

  for (const card of recipe.cards) {
    // 이름이 겹치면 뒤에 번호를 붙인다
    const base = safeName(card.name, 'agent');
    let fileName = base;
    for (let n = 2; used.has(fileName); n += 1) fileName = `${base}-${n}`;
    used.add(fileName);

    files[`${root}/.codex/agents/${fileName}.toml`] = cardToCodexToml(card);
    files[`${root}/.claude/agents/${fileName}.md`] = cardToClaudeMd(card);
  }

  files[`${root}/.codex/config.toml`] = recipeToCodexConfig(recipe);
  files[`${root}/recipe.json`] = `${JSON.stringify(recipe, null, 2)}\n`;
  files[`${root}/RECIPE.md`] = buildRecipeMd(recipe, providers, plans);
  return files;
}

/** 레시피 zip을 만든다. 브라우저에서는 new Blob([결과])로 내려받는다. */
export async function buildRecipeZip(
  recipe: Recipe,
  providers: ProviderData,
  plans?: UserPlans,
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(buildRecipeFiles(recipe, providers, plans))) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** 내려받을 zip 파일 이름 */
export function zipFileName(recipe: Recipe): string {
  return `${safeName(recipe.title, 'recipe')}.zip`;
}
