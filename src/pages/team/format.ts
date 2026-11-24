// 작업실 화면(업무 일지·활동)이 함께 쓰는 보기 좋게 바꾸는 함수들.
// 값이 없을 때 0이 아니라 '모름'으로 보여 주는 것이 원칙이다.

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export const fmtDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }) : '');

export const fmtDuration = (ms?: number | null) => {
  if (ms === undefined || ms === null) return '모름';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
};

export const fmtTokens = (value?: number | null) => (value === undefined || value === null ? '모름' : value.toLocaleString('ko-KR'));

/** 큰 숫자를 한국식으로 짧게: 9,876 → '9,876', 1,707,669 → '170.8만', 230,000,000 → '2.3억'. 없으면 '모름'. */
export const fmtCompact = (value?: number | null) => {
  if (value === undefined || value === null) return '모름';
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (value >= 100_000_000) return `${trim(value / 100_000_000)}억`;
  if (value >= 10_000) return `${trim(value / 10_000)}만`;
  return value.toLocaleString('ko-KR');
};
