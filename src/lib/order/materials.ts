// 주문 자료 읽기: 붙여 넣은 글, 텍스트 파일(.txt·.md, UTF-8), 링크(주소만).
// 파일은 브라우저에서 읽고 어디로도 보내지 않는다. 링크에는 접속하지 않는다. 새 추출 엔진(PDF·이미지 등)은 없다.

import { newId } from '../id';
import { MATERIAL_LIMITS, type Material } from './types';

export function textMaterial(name: string, content: string): Material {
  return { id: newId('mat'), name: name.trim() || '붙여 넣은 글', kind: 'text', status: 'read', content, size: content.length };
}

export type LinkResult = { ok: true; material: Material } | { ok: false; error: string };

export function linkMaterial(url: string): LinkResult {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: '주소 형식이 아니에요. https://로 시작하는 주소를 넣어 주세요.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { ok: false, error: 'http·https 주소만 넣을 수 있어요.' };
  return { ok: true, material: { id: newId('mat'), name: parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname : ''), kind: 'link', status: 'reference', url: trimmed } };
}

/** 파일 하나를 읽는다. 지원하지 않거나 너무 크거나 UTF-8이 아니면 '읽지 못함' 자료로 돌려준다. */
export async function fileMaterial(file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Material> {
  const base: Material = { id: newId('mat'), name: file.name, kind: 'file', status: 'failed', size: file.size };
  const lower = file.name.toLowerCase();
  if (!MATERIAL_LIMITS.extensions.some((ext) => lower.endsWith(ext))) {
    return { ...base, error: '.txt와 .md 파일만 읽을 수 있어요. 다른 문서는 필요한 부분을 복사해 "글 붙여 넣기"로 넣어 주세요.' };
  }
  if (file.size > MATERIAL_LIMITS.fileBytes) {
    return { ...base, error: `파일이 1MB를 넘어요(${(file.size / 1024 / 1024).toFixed(1)}MB). 필요한 부분만 붙여 넣어 주세요.` };
  }
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (!content.trim()) return { ...base, error: '파일이 비어 있어요.' };
    return { ...base, status: 'read', content };
  } catch {
    return { ...base, error: 'UTF-8 글자로 읽지 못했어요. 메모장에서 UTF-8로 저장하거나 내용을 붙여 넣어 주세요.' };
  }
}

export const MATERIAL_STATUS_LABELS: Record<Material['status'], string> = {
  read: '읽음',
  reference: '주소만 저장 (접속하지 않음)',
  failed: '읽지 못함',
};
