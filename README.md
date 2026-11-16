# teamcook

**AI 팀을 레시피로 요리하세요.**

실행은 어디서든, 팀 설계와 레시피는 여기서.

사이트: https://teamcook-eta.vercel.app/

GPT(Codex)·Claude 에이전트로 이뤄진 **AI 팀 레시피**를 설계하고, 내 요금제에 맞는 실행 경로를 확인하고, 링크 하나로 공유하는 웹사이트입니다. 만든 레시피는 Codex·Claude Code의 표준 설정 파일로 내보내져서 터미널, T3 Code, 1Code 어디서든 그대로 쓸 수 있습니다.

## 할 수 있는 것

- **팀 설계:** 작성자·검토자·조사원 같은 역할 카드와 넘겨주기 흐름으로 팀을 짭니다.
- **실행 경로 확인:** 카드마다 내 플랜으로 쓸 수 있는 가장 좋은 경로(① 구독 ② API 키 ③ 무료 한도 ④ 수동)를 보여 주고, 막힌 곳에는 🔒와 대안을 알려 줍니다.
- **필요한 플랜 배지:** 레시피마다 "ChatGPT 무료로 가능", "Claude Pro 필요" 같은 배지가 자동으로 붙습니다.
- **공유:** 서버 없이 링크 하나에 레시피를 담아 나눕니다.
- **구독 최적화:** 내 플랜 조합에 맞게 역할을 어느 도구에 둘지 제안합니다.
- **내보내기·불러오기:** `.codex/agents/*.toml`, `.claude/agents/*.md`, `recipe.json`, 설명서(`RECIPE.md`)를 zip으로 내보내고, 기존 파일을 불러옵니다.

로그인도, 서버 저장도, API 키 입력도 없습니다. 모든 데이터는 내 브라우저에만 저장됩니다.

## 레시피를 프로젝트에 바로 설치

```bash
cd 내-프로젝트
node -e "fetch('https://raw.githubusercontent.com/fun5307/teamcook/main/cli/teamcook.mjs').then(r=>r.text()).then(t=>require('fs').writeFileSync('teamcook.mjs',t))"
node teamcook.mjs add "<공유 링크>"
```

첫 줄은 설치 도구 파일 하나를 내려받고, 둘째 줄이 레시피를 설치합니다 (Node.js 20 이상).

이미 있는 파일은 건드리지 않습니다(`--force`로 덮어쓰기, `--dry-run`으로 미리 보기).

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 단위 테스트
npm run build      # 배포용 빌드 (dist/)
```

Node.js 20 이상이 필요합니다.

## 문서

- `CLAUDE.md` / `AGENTS.md` — 작업 규칙과 폴더 구조 (AI 코딩 도구용)
- `HANDOFF.md` — 현재 상태, 결정 사항, 다음 할 일
- `PROJECT_BRIEF.md` — 전체 지시서
- `MCP-strategy.md` — 전략 문서

요금제·설정 형식 정보는 2026-11-16에 공식 문서로 확인했습니다. 빠르게 바뀌는 정보이니 결제 전에는 각 회사의 공식 페이지를 확인하세요.
