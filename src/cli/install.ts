// '레시피를 프로젝트에 바로 설치하는 명령'의 두뇌 (PROJECT_BRIEF.md 7단계).
// 파일을 실제로 쓰는 부분(main.ts)과 나눠서, 여기는 "무엇을 어디에 쓸지"만 정한다(테스트하기 쉽게).

import { AGENT_TEAMS_MERGE_HINT } from '../data/collaboration';
import { providerData } from '../data/providers';
import { buildRecipeFiles, safeName } from '../lib/exportZip';
import { decodeRecipe, readShareHash } from '../lib/share';
import type { Recipe } from '../types';

export interface InstallFile {
  /** 프로젝트 폴더 기준 경로. 예: '.codex/agents/reviewer.toml' */
  path: string;
  content: string;
  /** true면 이미 있는 파일을 절대 덮어쓰지 않는다 (--force여도). 예: .codex/config.toml */
  neverOverwrite: boolean;
  /** 이미 있어서 건너뛰었을 때 보여 줄 안내 (직접 옮겨 적는 방법) */
  mergeHint?: string;
}

/** --force여도 덮어쓰지 않는 파일과, 그때 보여 줄 안내 */
const PROTECTED_FILES: Record<string, string> = {
  '.codex/config.toml': '이미 있는 .codex/config.toml은 덮어쓰지 않아요. [agents] 부분만 직접 옮겨 적으세요.',
  '.claude/settings.json': AGENT_TEAMS_MERGE_HINT,
};

export type InstallPlan =
  | { ok: true; recipe: Recipe; files: InstallFile[] }
  | { ok: false; error: string };

/** 공유 링크(또는 # 뒤 문자열)에서 레시피를 꺼낸다. */
export function recipeFromLink(link: string): { ok: true; recipe: Recipe } | { ok: false; error: string } {
  const trimmed = link.trim();
  const hashIndex = trimmed.indexOf('#');
  const encoded =
    hashIndex >= 0 ? readShareHash(trimmed.slice(hashIndex)) : trimmed.replace(/^r=/, '');
  if (!encoded) {
    return { ok: false, error: 'teamcook 공유 링크가 아니에요. 주소에 #r= 이 들어 있어야 해요.' };
  }
  return decodeRecipe(encoded);
}

/** 링크의 레시피를 프로젝트에 설치할 때 쓸 파일 목록을 만든다. */
export function planInstall(link: string, options: { codexBridge?: boolean } = {}): InstallPlan {
  const decoded = recipeFromLink(link);
  if (!decoded.ok) return decoded;
  const { recipe } = decoded;

  const exported = buildRecipeFiles(recipe, providerData, { codexBridge: options.codexBridge });
  const folder = `.teamcook/${safeName(recipe.title, 'recipe')}`;
  const files: InstallFile[] = [];
  for (const [fullPath, content] of Object.entries(exported)) {
    // zip용 경로의 맨 앞 폴더(<레시피 이름>/)를 떼어 낸다
    const relative = fullPath.slice(fullPath.indexOf('/') + 1);
    if (!relative.startsWith('.')) {
      // 설명서와 원본은 프로젝트 맨 위를 어지럽히지 않게 .teamcook/ 아래에 둔다
      files.push({ path: `${folder}/${relative}`, content, neverOverwrite: false });
    } else {
      const mergeHint = PROTECTED_FILES[relative];
      files.push(
        mergeHint
          ? { path: relative, content, neverOverwrite: true, mergeHint }
          : { path: relative, content, neverOverwrite: false },
      );
    }
  }
  return { ok: true, recipe, files };
}
