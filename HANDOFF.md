# HANDOFF — teamcook 인계 문서

> 다음에 이어받는 모델(또는 사람)이 이 대화 없이도 작업을 이어갈 수 있게 쓰는 문서. 단계가 끝날 때마다 갱신한다.
> 먼저 읽을 것: `CLAUDE.md`(작업 규칙, 폴더 구조) → 이 문서 → 필요하면 `PROJECT_BRIEF.md`.

## 현재 상태 (2026-11-16 기준)

- **서비스 이름: teamcook** (확정). 슬로건: "AI 팀을 레시피로 요리하세요". 옛 가칭 agent-recipes.
- **0~5단계 완료.** '시간 남으면' 항목(흐름 캔버스, 꿀팁, 파일 끌어다 놓기)도 완료.
- **6·7단계 중 계정·API 키 없이 가능한 것 완료** (사용자 요청으로 당일 진행). 아래 '6·7단계 현황' 참고.
- 저장소: https://github.com/fun5307/teamcook (`main`에 push하면 Vercel이 자동으로 다시 배포)
- 배포 링크: https://teamcook-eta.vercel.app/
- **조리법(협업 방식) 추가 완료** (추가 지시서 `BRIEF_collaboration-styles.md`). 아래 '조리법 현황' 참고. **사용자의 실제 Claude Code 확인이 남아 있음.**
- 확인된 것: `npm test` 156개 통과, 타입 검사·빌드 통과, 브라우저 자동 실행으로 전체 흐름 콘솔 오류 0건. **사용자가 'Claude 작성 + Codex 교차 검토' zip을 내보내 실제 Claude Code·Codex에서 에이전트 인식을 확인함.**

## 단계별 DoD 체크 현황

### 0단계 · 준비 — 완료
- [x] `npm run dev`로 페이지가 뜬다
- [x] `npm test`가 실행된다
- [x] `CLAUDE.md`, `AGENTS.md`, `HANDOFF.md`가 있다

### 1단계 · 변환기 — 완료
- [x] 왕복 변환 테스트가 Codex·Claude 모두 통과 (`src/converters/*.test.ts`, 38개)
- [x] 사용자의 실제 TOML 샘플 4개를 카드로 불러온다 (`samples/codex/`)
- [x] 형식에 없는 필드가 `extra.codex` / `extra.claude`로 보존된다

### 2단계 · 경로 해석기 + 배지 — 완료
- [x] 전부 무료 / ChatGPT Plus만 / Claude Pro만 / 둘 다 유료 4개 유형 테스트 통과 (`src/lib/resolvePath.test.ts`)
- [x] 기본 레시피 3종 배지 테스트 통과

### 3단계 · 편집기 + 내 AI 현황 + 내보내기 — 완료
- [x] 레시피를 만들고 새로고침해도 남아 있다 (자동 실행으로 확인)
- [x] '내 AI 현황'을 바꾸면 배지와 대안이 즉시 바뀐다 (자동 실행으로 확인)
- [x] zip을 테스트 프로젝트에 풀고 `codex`와 `claude`에서 에이전트가 인식된다 (사용자가 직접 확인, 2026-11-16)

### 4단계 · 공유 링크 + 기본 레시피 + 갤러리 — 완료
- [x] 링크를 다른 브라우저(새 브라우저 컨텍스트)에서 열면 같은 레시피가 보인다
- [x] 공유받은 레시피에 내 플랜 기준 경로가 바로 표시된다
- [x] 필터를 켜면 플랜에 맞지 않는 레시피가 숨겨진다

### 5단계 · 실행 안내 + 배포 — 완료
- [x] '어디서 돌리나요?' 페이지 (`src/pages/HowToRunPage.tsx`)
- [x] GitHub 저장소 만들고 올리기 (fun5307/teamcook)
- [x] Vercel 배포 (사용자가 완료)
- [ ] 배포된 주소(https://teamcook-eta.vercel.app/)에서 갤러리 → 편집 → 공유 링크 → 가져오기 → zip 내보내기를 한 번 직접 눌러 보기

### 시간 남으면 하는 것
- [x] 꿀팁: 편집기 아래에 팁 7개 + 카드별 경고(검토자가 편집 권한이면 경고 등) — `src/data/tips.ts`
- [x] 흐름 캔버스 (React Flow): `src/components/FlowCanvas.tsx`. 카드 = 상자, 넘겨주기 = 화살표, 상자에 경로 배지. 편집기에서는 상자 오른쪽 점에서 끌어 잇기, 화살표를 눌러 지우기. 자동 배치는 `src/lib/flowLayout.ts`(위치는 저장하지 않음). 화살표 라벨은 캔버스 아래 줄에서 고친다.
- [x] 파일 끌어다 놓기: 갤러리 맨 위 상자와 편집기의 '에이전트 카드' 영역에 파일을 놓으면 불러온다. (끌어다 놓기는 자동 실행으로 확인하지 못함. 파일 선택 버튼은 사용자의 실제 TOML 4개로 확인함.)

## 6·7단계 현황 (2026-11-16)

### 한 것
| 항목 | 내용 | 코드 | 확인 수준 |
| --- | --- | --- | --- |
| Gemini(Antigravity CLI) 어댑터 | `.agents/agents/<name>.md` 내보내기·불러오기. 읽기 전용은 문서에 나온 도구 이름(`view_file`, `grep_search`)만 사용 | `src/converters/markdownAgents.ts` | 형식은 공식 문서 예시로 테스트. **실제 Antigravity에서 실행해 보지 못함** |
| Grok Build 어댑터 | `.grok/agents/<name>.md` 내보내기·불러오기. 도구 이름 목록을 확인하지 못해 `tools`를 만들어 쓰지 않고, 읽기 전용은 지시문 끝 문장으로 표현 | 같은 파일 | 위치·형식·예시(name, description, tools)만 공식 문서로 확인. **실제 Grok Build에서 실행해 보지 못함** |
| 구독 최적화 고도화 | 내 플랜 조합에 맞게 카드의 도구를 다시 배치하는 제안 + '이대로 다시 배치' 버튼 | `src/lib/optimize.ts`, 편집기 화면 | 테스트 7개 + 브라우저 자동 실행 |
| 갤러리 검색 | 제목·설명·카드 이름 검색 | `src/pages/GalleryPage.tsx`의 `matchesQuery` | 브라우저 자동 실행 |
| 포크(고쳐서 다시 쓰기) | 기본·공유 레시피 '내 레시피로 가져오기', 편집기 '복제' | `cloneRecipe` | 브라우저 자동 실행 |
| 교차 모델 연결 도우미 | **Codex의 MCP 서버는 제거됐다**(공식 문서). 대신 Claude Code용 파일이 `codex exec`로 Codex에게 일을 넘기는 '다리' 내보내기 옵션(실험적) | `src/lib/bridge.ts`, 편집기의 스위치 | 파일 내용 테스트만. **실제로 Claude Code가 codex exec를 부르는 것은 실행해 보지 못함** |
| 레시피 설치 명령 | 설치 도구 파일 하나를 받아 `node teamcook.mjs add "<공유 링크>"`로 실행. 이미 있는 파일은 건너뛰고, `.codex/config.toml`은 절대 덮어쓰지 않음. 받는 명령은 `src/data/site.ts`의 `CLI_DOWNLOAD_COMMAND` | `src/cli/`, 빌드 결과 `cli/teamcook.mjs`(저장소에 포함), `npm run build:cli` | 테스트 6개 + GitHub에서 실제로 내려받아 설치 확인 (Windows의 Git Bash와 PowerShell) |
| 커뮤니티 제안 (서버 없는 임시 방법) | 공유 패널의 '커뮤니티 갤러리에 제안하기' → GitHub 이슈 작성 화면이 레시피 링크와 함께 열림 | `src/data/site.ts` | 링크 생성만 확인 |

### 하지 못한 것과 이유
- **레시피 허브 서버 저장, '가져다 쓴 횟수':** 데이터베이스가 필요하고, 만들려면 사용자 계정으로 가입·연결해야 한다(예: Vercel 저장소, Supabase). 계정이 준비되면 다음 모델이 이어서 한다. 그때까지는 위의 GitHub 이슈 제안 + `src/data/recipes.ts`에 직접 추가하는 방식으로 운영한다.
- **한국어 커뮤니티에 첫 레시피 공개:** 사용자가 직접 할 일.
- **협업 리플레이:** Codex·Claude Code의 세션 기록 파일 형식을 먼저 조사해야 한다. 기록 파일에는 사용자의 대화 내용이 들어 있어 허락 없이 열어 보지 않았다.
- **도구·기법 추천 (LLM API):** 서버 쪽 API 키가 필요하다(브라우저에 키를 넣으면 안 됨).
- **설치 명령의 npm 등록:** `npx github:fun5307/teamcook`은 **npm 12에서 기본으로 막혀 있어 실패한다**(오류 `EALLOWGIT`, 직접 확인함). 그래서 파일 하나를 받아 `node`로 실행하는 두 줄 방식으로 안내한다. `npx teamcook add …` 한 줄로 줄이려면 사용자가 npm에 등록해야 한다(이름 `teamcook`이 비어 있는지도 확인 필요). `package.json`의 `bin`은 이미 설정돼 있고 `"private": true`만 풀면 된다.

### 6·7단계에서 내린 결정
- `providers.json`의 Antigravity·Grok은 `status: "ready"`(내보내기 지원)로 바꿨다. 요금제 정보는 여전히 `confidence: "third-party"`라서, 이 도구가 쓰일 때는 "요금제 정보는 공식 문서로 확인하지 못했어요" 안내가 붙고, 대안을 고를 때 공식 확인 도구(Codex·Claude Code)보다 뒤로 밀린다.
- zip에는 Codex·Claude 형식을 항상 넣고, Antigravity·Grok 형식은 그 도구를 쓰는 카드가 있을 때(원래 설정이든 내 플랜의 대안이든)만 넣는다. (`exportEngines`)
- `.md` 파일은 세 도구가 같은 확장자를 쓴다. 불러올 때 `detectMarkdownEngine`이 머리말을 보고 고른다(Antigravity는 고유 항목·도구 이름, Grok은 우리가 넣은 주석의 `format: "grok"`).
- 형식 전용 필드는 `extra.antigravity`, `extra.grok`에 보관한다.

## 조리법(협업 방식) 현황 (2026-11-16, `BRIEF_collaboration-styles.md`)

방향: teamcook의 경쟁력은 **"지금 실제로 돌아가는, 확인 날짜가 찍힌 레시피"**다. 레시피가 서브에이전트 구조뿐 아니라 협업 방식까지 담는다.

### 결정 사항
| 항목 | 결정 |
| --- | --- |
| 필드 이름 | `Recipe.collaboration?: 'subagents' \| 'agent-team' \| 'debate'` (타입 이름 `Collaboration`), `Recipe.lastVerified?: string`(YYYY-MM-DD) |
| 기본값 | 조리법이 없으면 `'subagents'`. 읽을 때는 항상 `collaborationOf(recipe)`를 쓴다 (`src/data/collaboration.ts`) |
| schemaVersion | **1 그대로.** 둘 다 선택 필드라 옛 링크가 그대로 열린다 |
| 모르는 값 | `parseRecipe`가 모르는 조리법은 `'subagents'`로, 날짜 모양이 아닌 `lastVerified`는 버린다 |
| 저장 방식 | 편집기에서 서브에이전트를 고르면 `collaboration` 키를 아예 지운다 (옛 형식과 똑같은 링크가 되게) |
| 조리법 정보 위치 | 화면 문구, 주의 문장, 공식 문서 주소·확인 날짜, 내보낼 설정 내용 모두 `src/data/collaboration.ts` 한 곳 |
| 확인한 공식 문서 | https://code.claude.com/docs/en/agent-teams — **2026-11-16 확인.** 지시서의 조사 내용과 같았다 |

### 공식 문서에서 확인한 것 (에이전트 팀, 2026-11-16)
- 켜는 법: `settings.json`의 `env`에 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"`. 실험 기능이고 기본으로 꺼져 있다.
- 시작: 자연어로 팀원을 설명한다. **기존 서브에이전트 정의(`.claude/agents/*.md`)를 팀원의 '에이전트 유형'으로 쓸 수 있다** → 그래서 팀원 파일은 기존 Claude 변환기를 그대로 쓴다.
- 리더는 처음 연 대화창으로 고정 → **리더는 카드로 만들지 않고** 첫 프롬프트에서 "너는 리더다"라고 알려 준다.
- 화면 방식은 기본값(in-process)을 그대로 둔다. 어느 터미널에서나 되고, 나눠 보기는 tmux·iTerm2가 필요하다. `teammateMode`는 내보내지 않는다.
- 한계(화면과 RECIPE.md에 옮겨 적음): /resume 때 팀원이 되살아나지 않음, 할 일 완료 표시 누락, 종료가 느림, 세션당 팀 하나, 팀원이 팀을 만들 수 없음, 리더 고정.
- 문서에 **없던 것:** 최소 버전, Windows 관련 언급, 어느 플랜에서 되는지. 그래서 배지는 Claude Code를 쓸 수 있는 조건(Pro 이상 또는 API 키)을 그대로 쓴다.

### 조리법별 동작
| 조리법 | zip 내용 | 배지 | 실행 경로 |
| --- | --- | --- | --- |
| 서브에이전트 | 예전과 같음 | 예전과 같음 | 예전과 같음 |
| 에이전트 팀 | `.claude/agents/*.md` + `.claude/settings.json` + RECIPE.md(팀원 소개 프롬프트, 확인 절차) + recipe.json. **`.codex`는 넣지 않는다** | Claude Code 조건만 (카드에 다른 도구가 적혀 있어도) | 모든 카드를 Claude Code로 계산. 못 쓰면 🔒 + `styleLock`(대안: 서브에이전트 조리법으로 바꾸기) |
| 토론형 | RECIPE.md + `debate-prompt.txt` + recipe.json. 설정 파일 없음 | '어느 AI든 무료로 가능' | 잠기지 않음. `fitsMyPlans`는 항상 `full` |

- 설치 명령(`cli/teamcook.mjs`)은 `.claude/settings.json`을 `.codex/config.toml`처럼 **`--force`여도 덮어쓰지 않고** 병합 안내를 보여 준다.
- 사용자의 `~/.claude/settings.json`을 고치는 기능은 없다. 프로젝트 폴더용 파일만 내보낸다.
- 구독 최적화 제안과 'Codex 자동 호출'은 서브에이전트 조리법에서만 보인다.
- 기본 레시피 2종 추가: `builtin-feature-team`(에이전트 팀), `builtin-decision-debate`(토론형). **배열 순서를 바꾸지 말 것**(테스트가 앞의 3개를 순서대로 꺼내 쓴다).

### 지시서와 다르게 한 점
- 지시서 표는 에이전트 팀 zip에 "추가로 넣는 것"만 적었지만, **`.codex` 파일은 뺐다.** 에이전트 팀은 Claude Code 전용이라 Codex 파일이 섞이면 헷갈린다. 다른 도구에서 쓰려면 조리법을 서브에이전트로 바꿔 내보내면 된다.
- 토론형 zip에 `debate-prompt.txt`를 더했다(설정 파일이 아니라, 복사하기 쉬운 프롬프트 원문).
- A2A 개념 설명 단락은 넣지 않았다(지시서에서 "필요하면"이라고 한 항목).

### 미확인 항목
- **에이전트 팀이 실제 Claude Code에서 시작되는지 — 사용자 확인 필요.** 설정 내용과 프롬프트는 공식 문서대로 만들었지만 실행해 보지 못했다. 확인 절차는 내보낸 RECIPE.md의 '팀이 제대로 시작됐는지 확인하기'.
- **기본 레시피의 `lastVerified`는 지시서대로 전부 2026-11-16으로 채웠다.** 실제로 사용자가 돌려 본 것은 'Claude 작성 + Codex 교차 검토'뿐이다. 에이전트 팀 레시피가 사용자 확인에서 실패하면 날짜를 지우거나 고친 뒤 다시 찍어야 한다(`src/data/recipes.ts`의 `VERIFIED`).
- 토론 프롬프트를 실제 AI 채팅에 넣었을 때의 결과 품질.
- (확인됨) 배포 사이트 https://teamcook-eta.vercel.app/ 에서 갤러리 → 조리법 필터 → 편집 → 공유 링크 → zip, 옛 형식 링크 열기를 브라우저 자동 실행으로 확인했다(콘솔 오류 0건). 내려받은 zip을 실제 도구에 넣어 보는 것은 위의 사용자 확인 항목이다.

## 디자인 방향 (2026-11-16 결정)

- **방향: "포장 라벨"** (시안 C). 연한 진열대 바탕(`#E7EDEA`) 위에 흰 라벨, 검은 테두리와 굵은 줄, 글꼴은 IBM Plex Sans KR 하나. 색은 조리법 3종을 구분하는 띠(초록·보라·빨강)에만 쓴다.
- 시안 파일은 `design/` 폴더에 있다. `teamcook-design-options.html`(A·B·C 첫 화면), `teamcook-editor-options.html`(A·B·C 편집 화면), `teamcook-design-round2.html`(D 주문서, E 차림표). 채택한 것은 C, 나머지는 기록용이다.
- **확인 날짜는 강조하지 않는다 (사용자 결정).** 시안에 있던 점 글씨 도장은 쓰지 않고, 레시피 정보 표의 "확인한 날" 한 줄과 작은 회색 글자로만 적는다. 추가 지시서(`BRIEF_collaboration-styles.md`)의 "눈에 띄게"보다 이 결정이 나중이다.
- **지금 옮긴 것은 바탕까지다.** 색·글꼴·테두리, 위쪽 메뉴, 첫 화면(라벨 + "내용물" 표), 레시피 카드(색 띠 + "레시피 정보" 표), 제목 아래 굵은 줄. 편집·미리보기·내 AI 현황 화면은 바탕색과 제목 줄만 맞췄다. **세부 UI는 사용자가 직접 다듬기로 했다.**
- 고칠 곳: 색과 모서리는 `src/index.css`의 `:root`(조리법 띠 색은 `--style-*`), 굵은 줄은 같은 파일의 `.label-rule`·`.label-rule-sm`, 표는 `src/components/common.tsx`의 `FactTable`, 조리법 색은 `src/components/RouteInfo.tsx`의 `STYLE_COLORS`.
- 실행 경로 배지(①~④)와 안내 상자의 색(초록·하늘·노랑·빨강)은 예전 그대로다. 라벨 방향에 맞게 줄일지는 정하지 않았다.

## 사용자가 할 일 (1~3번은 2026-11-16에 완료. 기록으로 남겨 둠)

1. **내보낸 zip이 실제 도구에서 인식되는지 확인** (5분)
   1. `npm run dev` → 브라우저에서 http://localhost:5173 → 기본 레시피 하나 열기 → `zip으로 내보내기`
   2. 빈 테스트 폴더를 만들고 zip 안의 `.codex`, `.claude` 폴더를 복사
   3. 그 폴더에서 `claude` 실행 → "어떤 서브에이전트가 있어?" 입력 → reviewer 등이 보이는지 확인
   4. 그 폴더에서 `codex` 실행 → "reviewer 에이전트에게 이 폴더를 한 줄로 요약하게 해 줘" 입력 → 서브에이전트가 도는지 확인 (`/subagents`)
   5. 안 되면 오류 메시지를 다음 모델에게 그대로 전달
2. **GitHub에 올리기** — 아래 '배포 절차' 참고
3. **Vercel 배포** — 아래 '배포 절차' 참고
4. (완료) 공개 저장소에 `MCP-strategy.md`와 `samples/codex/`를 두어도 된다고 사용자가 확인함.
5. (완료) 무관한 파이썬 초기 파일(`pyproject.toml`, `.python-version`, `src/claude_mcp/`, `.venv/`)은 사용자 허락을 받아 지웠다.

### 배포 절차 (처음 하는 사람용)

1. https://github.com/new 에서 저장소를 만든다 (이름: `teamcook`, README 추가 체크는 **끄기**).
2. 이 폴더의 터미널에서:
   ```bash
   git remote add origin https://github.com/<내-아이디>/teamcook.git
   git push -u origin main
   ```
   (처음이면 브라우저 로그인 창이 뜬다.)
3. https://vercel.com 에 GitHub 계정으로 로그인 → **Add New… → Project** → 방금 만든 저장소 **Import**.
4. 설정은 자동 인식된다 (Framework: Vite, Build: `npm run build`, Output: `dist`). 그대로 **Deploy**.
5. 나온 주소(`https://….vercel.app`)를 이 문서의 '배포 링크'에 적는다. 이후에는 `git push`만 하면 자동으로 다시 배포된다.
6. 배포된 주소에서 확인: 갤러리 → 기본 레시피 → 내 레시피로 가져오기 → 링크 복사 → 시크릿 창에서 열기 → 가져오기 → zip 내보내기.

## 알려진 버그와 임시 처리

- **Vitest가 Windows 소문자 드라이브 경로(`c:\...`)에서 실패한다.** `npm test`는 `scripts/vitest.mjs`가 드라이브 문자를 대문자로 바꿔 다시 실행하는 방식으로 우회했다. `npx vitest`를 직접 실행하지 말 것.
- **Claude의 `permissionMode: plan`만 있고 `tools`가 없는 파일**을 불러오면 권한이 '제한 없음'으로 표시된다. `permissionMode`는 `extra.claude`에 보존되어 다시 내보낼 때는 그대로 나온다(표시만 부정확).
- **카드를 다른 형식의 파일 하나로만 주고받으면** 반대쪽 형식 전용 필드(`extra.claude` ↔ `extra.codex`)는 실리지 않는다. 온전한 보존은 `recipe.json`이 맡는다.
- `settings.maxDepth`는 데이터에는 있지만 화면에서 고칠 수 없고 내보내지도 않는다(Codex 공식 설정표에 대응 키가 없음).
- 빌드할 때 "chunk가 500kB보다 크다"는 경고가 나온다. 동작에는 문제없다. 나중에 화면별로 나눠 불러오면(코드 분할) 사라진다.
- T3 Code·1Code 안내는 소개 글 기준이며 직접 실행해 확인하지 못했다(화면에 그렇게 적어 둠).
- `npm audit`이 취약점 6개(낮음 2, 보통 4)를 보고한다. 전부 `shadcn` 패키지(컴포넌트 추가용 명령줄 도구)가 끌고 오는 `ts-morph` → `minimatch` 쪽이다. 브라우저에 실리는 코드가 아니라서 사이트 방문자에게는 영향이 없다. `npm audit fix --force`는 버전을 강제로 바꾸므로 실행하지 말 것.
- 화면 확인은 Edge 헤드리스 자동 실행으로 했다(프로젝트 밖 임시 폴더의 스크립트라 저장소에는 없음). 사람 눈으로 본 것은 아니니, 배포 후 한 번 직접 눌러 볼 것.

## 오늘 내린 결정과 그 이유

### 공식 문서 재확인 결과 (2026-11-16) — `PROJECT_BRIEF.md` 4.5·5장에도 반영함
| 항목 | 처음 조사 | 확인 결과 | 코드에서의 처리 |
| --- | --- | --- | --- |
| Codex 읽기 전용 | 에이전트별 샌드박스 덮어쓰기 가능 | **불가.** `sandbox_mode` 등은 부모 설정을 못 바꿈 | 지시문 끝에 `CODEX_READONLY_GUARD` 문장을 붙임. 불러올 때 떼어 냄. RECIPE.md에서 `codex --sandbox read-only` 안내 |
| Codex `[agents]` 키 | `max_threads`, `max_depth` | `max_concurrent_threads_per_session` (`max_threads`는 별칭), `max_depth`는 표에 없음 | 새 키로 내보내고, 불러올 때는 옛 키도 읽음 |
| ChatGPT Free로 Codex | CLI 제한적 사용 | **Free·Go는 데스크톱 앱 전용**, CLI는 Plus부터 | 경로 ③의 설명·주의 문장에 명시 |
| Claude 플랜 | Pro, Max | Pro, Max, **Ultra**, 콘솔 계정 | `UserPlans.anthropic`에 `'ultra'` 추가 |
| Codex 문서 주소 | developers.openai.com | **learn.chatgpt.com**으로 이동 (`.md`를 붙이면 원문) | `providers.json`의 `sourceUrl` |
| Google·xAI | 조사 필요 | 공식 문서 미확인, 제3자 자료만 | `status: "preparing"`, `confidence: "third-party"`, 화면에 경고 표시 |

### 데이터 모델에서 지시서 초안과 달라진 점
- `Permission`의 `'full'`은 "모든 권한"이 아니라 **"제한 없음 = 부모 세션 설정을 따름"**이다. 에이전트 파일은 권한을 줄이거나 부탁할 수만 있기 때문.
- `AgentCard.extra`는 `{ codex?: {...}, claude?: {...} }`로 나눴다. Codex 전용 필드가 Claude 파일로 새지 않게 하려는 것.
- `AgentCard.model`은 `preferredEngine`용이다. 다른 형식으로 내보낼 때는 `model` 필드에 쓰지 않는다(GPT 모델 이름이 Claude 파일에 들어가면 깨짐).
- **메타 주석:** 형식에 자리가 없는 카드 정보(표시 이름, 역할 태그, 권한, 원래 엔진)는 파일의 주석 한 줄 `# teamcook: {…}`에 싣는다. 주석이라 Codex·Claude Code는 무시한다. (`src/converters/meta.ts`)
- `resolvePath`에 선택 인자 `context.writerProviders`를 추가했다(교차 검토 판단용). `resolveRecipe`가 작성자를 먼저 정한 뒤 검토자를 다시 계산한다.
- `resolvePath` 결과: 막힌 카드는 `{ locked: true, path: 4, engine: 'manual', alternative: {...} }`. **실제로 쓰게 되는 경로는 `effectiveRoute()`로 얻는다.**
- `alternative.kind`: `'fallback'`(막혀서 필요한 대안) / `'suggestion'`(막히진 않았지만 더 나은 선택 — 교차 검토, 구독 최적화).
- 플랜이 `'none'`(안 써요)이면 무료 경로도 없다고 본다. 그래야 갤러리 필터가 의미가 있다. 대신 "무료 계정을 만들면 쓸 수 있어요" 안내 문장을 준다.
- 대안으로는 `status: "ready"`(설정 파일 내보내기 지원)인 엔진만 추천한다. 지금은 Codex와 Claude Code뿐.
- 기본 레시피 3번(조사원 + 정리원)은 전부 Claude Code로 구성했다(배지가 3종 모두 다르게 나오도록).

### 이름 변경 (agent-recipes → teamcook)
- 화면 제목, 문서, `package.json`, 기본 레시피의 만든 사람, 내보낸 파일의 주석을 모두 teamcook으로 바꿨다.
- **일부러 옛 이름을 남긴 곳 두 군데:** ① `src/store/useStore.ts`의 localStorage 저장 이름 `agent-recipes` (바꾸면 이미 저장된 레시피가 사라짐), ② `src/converters/meta.ts`가 읽는 옛 주석 `# agent-recipes: {…}` (새 파일은 `# teamcook: {…}`로 쓰고, 옛 주석도 계속 읽음).
- 프로젝트 폴더 이름(`c:claude-MCP`)과 `PROJECT_BRIEF.md`·`MCP-strategy.md` 본문은 바꾸지 않았다(당시 기록).

### 공유 링크
- 형식: `<주소>#r=<lz-string compressToEncodedURIComponent(JSON)>`, `schemaVersion: 1` (`src/types.ts`의 `RECIPE_SCHEMA_VERSION`).
- 들어온 데이터는 `src/lib/recipeSchema.ts`의 `parseRecipe`로 다듬는다(모르는 필드 버림, 길이 제한, 엔진·권한 검증). **버전을 올릴 때는 여기에 옛 버전 → 새 버전 변환을 추가한다.**
- 화면 전환도 hash 기반(`#/edit/<id>`, `#/plans`, `#/how`, `#/recipe/<기본레시피id>`)이라 Vercel에 별도 설정이 필요 없다. (`src/lib/router.ts`)
- 기본 레시피의 공유 링크 길이는 약 2,000자. 4,000자를 넘으면 경고한다.

### 화면
- shadcn/ui는 CLI로 설치했다(`components.json`, 스타일 `radix-nova`). 컴포넌트 추가: `npx shadcn@latest add <이름>`. `cn` 함수는 shadcn이 만든 npm 패키지 `cn`에서 온다.
- 선택 상자는 shadcn Select 대신 브라우저 기본 `<select>`(`NativeSelect`)를 썼다. 단순하고 모바일에서 편해서.
- 처음 온 사람의 기본 플랜은 "ChatGPT·Claude 무료"로 가정하고, 안내 문구로 '내 AI 현황' 설정을 권한다.
- zip에는 모든 카드를 **Codex 형식과 Claude 형식 둘 다** 넣는다(한쪽 도구만 있어도 팀 전체를 쓸 수 있게).
- 넘겨주기 흐름은 설정 파일에 담을 곳이 없어서, `RECIPE.md`의 '첫 프롬프트 예시'(`starterPrompt`)로 만든다.

## 내일 할 일 순서

1. 배포된 사이트에서 전체 흐름을 한 번 직접 눌러 본다. 새로 붙은 기능 중 실제 도구로 확인하지 못한 것(Antigravity·Grok 파일 인식, 'Codex 자동 호출' 다리, macOS·Linux에서의 설치 명령)을 사용자와 함께 확인한다.
2. 흐름 캔버스 다듬기: 캔버스 안에서 화살표 라벨 바로 고치기, 상자를 눌러 그 카드 편집 열기.
3. 디자인 다듬기, 코드 분할로 빌드 경고 없애기(jszip·yaml·smol-toml을 내보내기·불러오기 때만 불러오기).
4. 레시피 허브 서버 저장(사용자가 데이터베이스 계정을 준비한 뒤), 협업 리플레이(세션 기록 형식 조사부터, 사용자 허락 필요), 도구 추천(서버 쪽 API 키 필요).
5. `providers.json`은 주기적으로 공식 문서와 대조해 `lastVerified`를 갱신한다.

## 다음 모델에게 주는 주의점

- **포지션을 지킨다:** 에이전트 실행·세션 관리 기능을 만들지 않는다. 우리는 T3 Code·1Code·터미널 위에 얹히는 '레시피' 레이어다.
- **데이터는 `Recipe` 하나:** 모든 화면이 이것만 읽고 쓴다. 화면 전용 상태를 따로 저장하지 않는다.
- **제공사별 차이는 두 곳에만:** 형식은 `src/converters/`, 요금제 사실은 `src/data/providers.json`. 화면이나 해석기에 요금제 이름을 하드코딩하지 않는다.
- **API 키 값을 받지 않는다.** '보유 여부' 체크만. 인증 파일(`~/.codex/auth.json`, `~/.claude`)은 읽지도 쓰지도 않는다.
- **공유 링크 하위 호환:** `#r=`와 `schemaVersion`을 바꾸지 않는다. 구조를 바꾸면 버전을 올리고 `parseRecipe`에 변환을 추가한다.
- **공유 데이터는 남이 만든 것:** 반드시 텍스트로만 그린다. `dangerouslySetInnerHTML`을 쓰지 않는다.
- **테스트 먼저:** 변환기·해석기·배지·공유 링크를 고치면 테스트도 함께 고친다. `CODEX_READONLY_GUARD` 문장을 바꾸면 예전에 내보낸 파일을 다시 읽을 때 권한이 복원되지 않으니, 바꿀 때는 옛 문장도 인식하게 한다.
- `CLAUDE.md`와 `AGENTS.md`는 같은 내용이다. 하나를 고치면 다른 하나도 고친다.
- 사용자에게는 한국어로, 쉬운 말로 설명한다.
