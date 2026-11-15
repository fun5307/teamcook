/** 짧은 무작위 id. 예: newId('card') → 'card-3f9a1c2b' */
export function newId(prefix: string): string {
  const random = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `${prefix}-${random}`;
}
