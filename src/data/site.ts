// 사이트 밖 주소 모음.

/** 소스 저장소 */
export const REPO_URL = 'https://github.com/fun5307/teamcook';

/** 설치 도구 파일(cli/teamcook.mjs)을 내려받을 주소 */
export const CLI_URL = 'https://raw.githubusercontent.com/fun5307/teamcook/main/cli/teamcook.mjs';

/**
 * 설치 도구를 내려받는 명령. Node.js만 있으면 Windows·macOS·Linux 어디서나 같은 한 줄로 된다.
 * (npm 12부터 `npx github:…`가 기본으로 막혀 있어서 이 방식을 쓴다. npm에 등록하면 `npx teamcook add …`로 줄일 수 있다.)
 */
export const CLI_DOWNLOAD_COMMAND = `node -e "fetch('${CLI_URL}').then(r=>r.text()).then(t=>require('fs').writeFileSync('teamcook.mjs',t))"`;

/** 공유 링크의 레시피를 프로젝트에 바로 설치하는 명령 두 줄 (받기 → 설치) */
export function installCommand(shareUrl: string): string {
  return `${CLI_DOWNLOAD_COMMAND}\nnode teamcook.mjs add "${shareUrl}"`;
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
