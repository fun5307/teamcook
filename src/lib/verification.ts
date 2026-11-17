// 확인 기록을 화면과 설명서에 적을 때 쓰는 이름표.
// 문서 확인, 파일 생성 확인, 실제 실행 확인을 섞어 쓰지 않으려고 한곳에 둔다.

import type {
  VerificationKind,
  VerificationRecord,
  VerificationResult,
  VerificationSource,
} from '../types';

export const KIND_LABELS: Record<VerificationKind, string> = {
  docs: '문서 확인',
  file: '파일 생성 확인',
  run: '실제 실행 확인',
  unclassified: '확인 방식 미기록',
};

export const KIND_HINTS: Record<VerificationKind, string> = {
  docs: '공식 문서의 설정 형식과 맞는지 확인했어요. 실행해 본 것은 아니에요.',
  file: '설정 파일과 설명서가 만들어지는 것을 확인했어요. 실행해 본 것은 아니에요.',
  run: '실제 도구에서 돌려 보고 적은 기록이에요.',
  unclassified: '예전 형식의 날짜만 남아 있어요. 무엇을 어떻게 확인했는지는 기록이 없어요.',
};

export const RESULT_LABELS: Record<VerificationResult, string> = {
  success: '성공',
  failure: '실패',
  'n/a': '해당 없음',
};

export const SOURCE_LABELS: Record<VerificationSource, string> = {
  user: '사용자 기록',
  auto: '자동 점검',
  author: '만든 쪽 기록',
  unknown: '출처 모름',
};

/** 한 줄 요약. 예: '파일 생성 확인 · 2026-11-16 · 성공 · 자동 점검' */
export function verificationLine(record: VerificationRecord): string {
  const parts = [KIND_LABELS[record.kind], record.checkedAt];
  if (record.kind !== 'unclassified') parts.push(RESULT_LABELS[record.result]);
  parts.push(SOURCE_LABELS[record.source]);
  return parts.join(' · ');
}

/** 도구·버전·환경을 적은 것만 이어 붙인다. 없으면 빈 문자열 (짐작해서 채우지 않는다). */
export function verificationDetail(record: VerificationRecord): string {
  return [record.tool, record.toolVersion, record.environment].filter(Boolean).join(', ');
}

/** 실제 도구에서 돌려 성공했다는 기록이 하나라도 있는지 */
export function hasSuccessfulRun(records: VerificationRecord[] | undefined): boolean {
  return (records ?? []).some((record) => record.kind === 'run' && record.result === 'success');
}
