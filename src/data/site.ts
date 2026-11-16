// 사이트 밖 주소 모음.

/** 소스 저장소 */
export const REPO_URL = 'https://github.com/fun5307/teamcook';

/** 공유 링크의 레시피를 프로젝트에 바로 설치하는 명령 (cli/teamcook.mjs) */
export function installCommand(shareUrl: string): string {
  return `npx github:fun5307/teamcook add "${shareUrl}"`;
}

/** 레시피를 커뮤니티 갤러리에 제안하는 GitHub 이슈 작성 주소 (서버 없이 운영하는 방법) */
export function suggestRecipeUrl(title: string, summary: string, shareUrl: string): string {
  const body = [
    '### 레시피 설명',
    summary || '(설명을 적어 주세요)',
    '',
    '### 공유 링크',
    shareUrl,
    '',
    '### 직접 돌려 본 환경',
    '(예: Claude Pro + ChatGPT 무료, Windows)',
  ].join('\n');
  const params = new URLSearchParams({ title: `[레시피] ${title}`, body, labels: 'recipe' });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
