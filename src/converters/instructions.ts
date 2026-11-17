// 역할 카드의 구조화된 항목(받을 입력, 필수 산출물, 완료 기준, 작업 경계)을
// 지시문 뒤에 덧붙이는 곳. 화면의 '생성될 지시문 미리보기'와 실제 내보내기가
// 모두 composeInstructions 하나만 쓴다. 사용자가 쓴 원본 지시문은 바꾸지 않는다.

import type { AgentCard, Deliverable } from '../types';
import { type CardMeta, normalizeText } from './meta';

/** 덧붙인 부분의 시작을 알리는 줄. 다시 불러올 때 이 줄부터 잘라 원본 지시문을 되살린다. */
export const STRUCT_MARKER = '--- 역할 카드에서 정한 내용 (teamcook이 덧붙임) ---';

type SpecFields = Pick<AgentCard, 'requiredInputs' | 'deliverables' | 'completionCriteria' | 'boundaries'>;

function list(title: string, items: string[] | undefined): string[] {
  const clean = (items ?? []).map((item) => item.trim()).filter(Boolean);
  return clean.length > 0 ? ['', `[${title}]`, ...clean.map((item) => `- ${item}`)] : [];
}

function deliverableLine(item: Deliverable): string {
  return item.description?.trim() ? `${item.name.trim()}: ${item.description.trim()}` : item.name.trim();
}

/** 구조화된 항목만 글로 옮긴 것. 항목이 하나도 없으면 빈 문자열. 순서는 항상 같다. */
export function structuredBlock(card: SpecFields): string {
  const lines = [
    ...list('받을 입력', card.requiredInputs),
    ...list(
      '필수 산출물 (끝날 때 반드시 내놓는다)',
      (card.deliverables ?? []).filter((item) => item.name.trim()).map(deliverableLine),
    ),
    ...list('완료 기준 (모두 만족해야 끝난 것이다)', card.completionCriteria),
    ...list('하지 않을 일', card.boundaries),
  ];
  return lines.length > 0 ? [STRUCT_MARKER, ...lines.slice(1)].join('\n') : '';
}

/** 실제 설정 파일에 들어갈 지시문: 원본 지시문 + 구조화된 항목 */
export function composeInstructions(card: Pick<AgentCard, 'instructions'> & SpecFields): string {
  const original = normalizeText(card.instructions);
  const block = structuredBlock(card);
  if (!block) return original;
  return original ? `${original}\n\n${block}` : block;
}

/** 메타 주석에 구조화된 항목을 싣는다 (다시 불러올 때 되살리려고). */
export function addSpecMeta(meta: CardMeta, card: SpecFields): void {
  const spec: NonNullable<CardMeta['spec']> = {};
  if (card.requiredInputs?.length) spec.inputs = card.requiredInputs;
  if (card.deliverables?.length) spec.deliverables = card.deliverables;
  if (card.completionCriteria?.length) spec.criteria = card.completionCriteria;
  if (card.boundaries?.length) spec.boundaries = card.boundaries;
  if (Object.keys(spec).length > 0) meta.spec = spec;
}

/**
 * 불러온 지시문에서 덧붙인 부분을 떼어 원본을 되살리고, 메타 주석의 구조화된 항목을 카드에 넣는다.
 * 메타 주석이 없으면(다른 도구로 만든 파일) 지시문을 그대로 둔다. 구조화된 항목은 비어 있게 된다.
 */
export function restoreSpec(card: AgentCard, meta: CardMeta): AgentCard {
  if (!meta.spec) return card;
  const next = { ...card };
  const at = next.instructions.indexOf(STRUCT_MARKER);
  if (at >= 0) next.instructions = next.instructions.slice(0, at).trimEnd();
  if (meta.spec.inputs) next.requiredInputs = meta.spec.inputs;
  if (meta.spec.deliverables) next.deliverables = meta.spec.deliverables;
  if (meta.spec.criteria) next.completionCriteria = meta.spec.criteria;
  if (meta.spec.boundaries) next.boundaries = meta.spec.boundaries;
  return next;
}
