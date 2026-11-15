// 브라우저에서 파일 내려받기·읽기·복사.

export function downloadBytes(bytes: Uint8Array, fileName: string, type: string): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** 클립보드에 복사한다. 실패하면 false (그럴 땐 화면의 링크를 직접 복사하게 안내). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
