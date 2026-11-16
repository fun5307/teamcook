// 레시피 공유 링크. 서버 없이 URL 하나에 레시피를 담는다.
//   Recipe → JSON → lz-string 압축 → https://<도메인>/#r=<압축문자열>
// 주소의 # 뒤는 서버로 전송되지 않으므로, 레시피 내용은 링크를 가진 사람만 본다.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Recipe } from '../types';
import { RecipeFormatError, parseRecipe } from './recipeSchema';

/** 공유 링크의 # 뒤에 붙는 이름. 바꾸면 옛 링크가 깨지니 바꾸지 않는다. */
export const SHARE_HASH_KEY = 'r';

/** 이보다 길면 메신저·브라우저에서 잘릴 수 있어 경고한다. */
export const SHARE_WARN_LENGTH = 4000;

export interface ShareLink {
  url: string;
  length: number;
  /** 너무 길어서 경고가 필요한지 */
  tooLong: boolean;
}

export type DecodeResult = { ok: true; recipe: Recipe } | { ok: false; error: string };

/** 레시피 → 압축 문자열 */
export function encodeRecipe(recipe: Recipe): string {
  return compressToEncodedURIComponent(JSON.stringify(recipe));
}

/** 압축 문자열 → 레시피. 실패하면 사용자에게 보여 줄 오류 문장을 돌려준다. */
export function decodeRecipe(encoded: string): DecodeResult {
  const broken = '공유 링크가 손상됐거나 끝까지 복사되지 않았어요. 링크를 다시 받아 보세요.';
  if (!encoded) return { ok: false, error: broken };

  let json: string | null = null;
  try {
    json = decompressFromEncodedURIComponent(encoded);
  } catch {
    json = null;
  }
  if (!json) return { ok: false, error: broken };

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: broken };
  }

  try {
    return { ok: true, recipe: parseRecipe(raw) };
  } catch (error) {
    if (error instanceof RecipeFormatError) return { ok: false, error: error.message };
    return { ok: false, error: broken };
  }
}

/** 공유 링크를 만든다. baseUrl 예: 'https://teamcook.vercel.app/' */
export function buildShareLink(recipe: Recipe, baseUrl: string): ShareLink {
  const base = baseUrl.split('#')[0];
  const url = `${base}#${SHARE_HASH_KEY}=${encodeRecipe(recipe)}`;
  return { url, length: url.length, tooLong: url.length > SHARE_WARN_LENGTH };
}

/** 주소의 hash('#r=...')에서 압축 문자열을 꺼낸다. 공유 링크가 아니면 null. */
export function readShareHash(hash: string): string | null {
  const prefix = `#${SHARE_HASH_KEY}=`;
  if (!hash.startsWith(prefix)) return null;
  return hash.slice(prefix.length);
}
