// 시각은 시간대가 있는 ISO 형식으로 저장하고(예: 2026-11-17T14:03:00+09:00), 화면에서는 사용자 지역 시간으로 보여 준다.

const pad = (value: number) => String(Math.abs(Math.trunc(value))).padStart(2, '0');

/** Date → 시간대가 붙은 ISO 문자열 (이 컴퓨터의 시간대 기준) */
export function toZonedIso(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}

export function nowIso(): string {
  return toZonedIso(new Date());
}

/** 시간대가 붙은 ISO 문자열인지 (Z 또는 +09:00 꼴) */
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function isZonedIso(value: unknown): value is string {
  return typeof value === 'string' && ZONED.test(value) && !Number.isNaN(Date.parse(value));
}

/** 화면 표시용. 예: '2026. 11. 17. 오후 2:03' */
export function formatLocal(iso: string | undefined): string {
  if (!iso || !isZonedIso(iso)) return '미확인';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** <input type="datetime-local">의 값('2026-11-17T14:03') → 시간대 붙은 ISO. 비었거나 잘못되면 undefined. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : toZonedIso(date);
}

/** 시간대 붙은 ISO → <input type="datetime-local">의 값 (사용자 지역 시간) */
export function toLocalInput(iso: string | undefined): string {
  if (!iso || !isZonedIso(iso)) return '';
  return toZonedIso(new Date(iso)).slice(0, 16);
}
