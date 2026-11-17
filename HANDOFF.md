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
- 확인된 것: `npm test` 220개 통과, 타입 검사·빌드 통과, 브라우저 자동 실행으로 전체 흐름 콘솔 오류 0건. **사용자가 'Claude 작성 + Codex 교차 검토' zip을 내보내 실제 Claude Code·Codex에서 에이전트 인식을 확인함.**

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

## 1차 개선: 설계·파일 반영·실행 확인을 구분하기 (2026-11-17, `teamcook-phase1-agent-prompt.md`)

> 이 작업은 지시서 원칙에 따라 **커밋·푸시·배포하지 않았다.** 사용자가 지시하면 올린다.

### 사용자 흐름
레시피 선택 → 학습 목표·성공 조건 확인 → 역할별 입력·산출물·완료 기준 → 전달 정보 → 실행 반영 범위 확인 → **내보내기 준비**(점검 → 파일 미리보기 → ZIP) → 외부 도구에서 첫 실습.

### 데이터 변경과 옛 형식 바꾸기
- `schemaVersion` 1 → **2**. 바꾸는 규칙은 `src/lib/recipeSchema.ts`의 `parseRecipe` 한 곳이고, 여러 번 적용해도 결과가 같다.
- 레시피에 추가: `learningObjective`, `sampleTask`, `successCriteria[]`, `prerequisites[]`, `verification[]`.
- 역할 카드에 추가: `requiredInputs[]`, `deliverables[]`(`{id, name, description?}`), `completionCriteria[]`, `boundaries[]`. "맡을 일"은 기존 `role`을 그대로 쓴다.
- 넘겨주기에 추가: `deliverableIds[]`. 보내는 쪽·받는 쪽은 원래 카드 id(`from`/`to`)였고, 추가 전달 설명은 기존 `label`을 그대로 쓴다.
- **확인 날짜(`lastVerified`)는 없앴다.** v1의 날짜는 `{id: 'legacy-date', kind: 'unclassified'}` 기록 하나로 옮긴다. 날짜는 보존하고 "실제 실행 성공"으로 올리지 않는다.
- 확인 기록의 종류: `docs`(문서 확인), `file`(파일 생성 확인), `run`(실제 실행 확인), `unclassified`(확인 방식 미기록). 출처: `user`, `auto`, `author`, `unknown`. 모르는 값은 "모름" 쪽으로 낮춘다.
- **더 새로운 버전은 읽지 않고 거절한다.** 저장소(`src/store/useStore.ts`)는 읽지 못한 항목을 버리지 않고 `unreadable`에 그대로 보관하고, 첫 화면에 안내한다.
- 옛 레시피는 새 항목이 없어도 열리고 고쳐지고 저장된다. **ZIP을 만들 때만** 필수 항목을 요구한다.
- TOML·Markdown: teamcook이 내보낸 파일은 메타 주석(`# teamcook: {...}`의 `spec`)으로 새 항목을 되살린다. 다른 도구로 만든 파일은 지시문을 그대로 두고 새 항목은 비운다.

### 지시문 만들기
- `src/converters/instructions.ts`의 `composeInstructions` 하나가 "원본 지시문 + 구조화된 항목"을 만든다. 편집 화면의 미리보기와 네 형식의 내보내기가 모두 이것을 쓴다. 원본 지시문은 바꾸지 않는다.
- 덧붙인 부분은 `--- 역할 카드에서 정한 내용 (teamcook이 덧붙임) ---` 줄로 시작하고, 다시 불러올 때 이 줄부터 잘라 원본을 되살린다.

### 도구별 반영 범위와 권한을 지키는 수단 (`src/lib/support.ts`, 근거는 `converters/`의 생성 코드)
| 도구·조리법 | 읽기 전용을 고르면 | 표시 |
| --- | --- | --- |
| Claude Code | 설정의 `tools`를 Read, Grep, Glob으로 제한 | 도구 제한 |
| Claude Code, 도구 목록을 직접 적어 권한과 어긋남 | 적은 목록이 그대로 들어감 | 확인 필요 |
| Codex | 지시문 끝에 문장만 추가. 막으려면 `codex --sandbox read-only` | 지시문으로 안내 + 실행 환경 설정 필요 |
| Antigravity | `tools`를 읽기 도구로 적음 (실행해 보지 못함) | 도구 제한 + 확인 필요 |
| Grok Build | 지시문 끝에 문장만 추가 | 지시문으로 안내 + 확인 필요 |
| 토론형 | 설정 파일 없음 | 지시문으로 안내 |
- 작업 순서와 전달 정보는 **시작 프롬프트와 RECIPE.md에만** 들어간다. 사이트나 파일이 순서를 강제하지 않는다.
- 팀원끼리의 메시지: 에이전트 팀만 Claude Code가 제공한다. 서브에이전트끼리의 소통은 "도구마다 다르고 이 사이트는 설정하지 않는다"고 적는다.

### 내보내기 점검 규칙 (`src/lib/exportCheck.ts`의 `checkRecipe`)
- **같은 날 사용자가 "기준이 너무 빡빡하다"고 해서 차단 기준을 줄였다.** 지시서의 표보다 이 결정이 나중이다. 막는 것은 **만들어질 파일이 깨지는 경우뿐**이다.
- **고쳐야 해요(다운로드 차단):** `NO_CARDS`, `BAD_FILE_NAME`, `DUPLICATE_FILE`, `HANDOFF_BROKEN`, `TOOL_STYLE_MISMATCH`(에이전트 팀에 Claude Code가 아닌 역할). 이 다섯 가지가 전부다.
- **채우면 더 좋아요(허용):** `NO_OBJECTIVE`, `NO_SUCCESS_CRITERIA`, `CARD_NO_TASK`, `CARD_NO_DELIVERABLE`, `CARD_NO_CRITERIA`, `HANDOFF_EMPTY`, `HANDOFF_STALE_DELIVERABLE`(지워진 산출물, "재선택 필요"), `PERMISSION_INSTRUCTION_ONLY`. 같은 종류는 역할마다 따로 적지 않고 한 줄로 묶는다(예: "산출물을 적지 않은 역할: 작성자, 검토자").
- **알아 두세요:** `FLOW_CYCLE`, `ENV_UNCHECKED`, `ORDER_PROMPT_ONLY`. 내보내기 창 맨 아래 작은 글 한 줄로만 보인다.
- 토론형은 파일이 없으므로 파일 이름과 권한을 점검하지 않는다.
- 점검 결과는 `{level, code, message, target}`이고, `fieldDomId(target)`가 편집 화면의 입력 칸 id다. 코드는 화면 문구와 따로 둔다.
- `buildExportBundle`이 점검과 파일을 한 번에 만들고(`{root, files[{path, purpose, content, mergeNeeded}], issues, blocked}`), 미리보기와 `zipBundle`이 같은 묶음을 쓴다. 막힌 묶음은 `ExportBlockedError`를 던진다.
- **설치 명령(`cli/teamcook.mjs`)은 막지 않는다.** 옛 공유 링크를 계속 설치할 수 있게 `buildRecipeFiles`를 그대로 쓴다.

### 화면을 줄인 것 (같은 날, 사용자 요청: "길고 복잡하다, 사용자 친화적이어야 한다")
- **원칙:** 한 화면에 한 가지 일. 꼭 필요한 칸만 먼저, 선택 항목은 접어 둔다. 같은 안내를 역할마다 되풀이하지 않는다. 빨간 "필수" 경고를 쓰지 않는다.
- **편집 화면을 세 단계로 나눴다:** ① 팀 소개(제목, 설명, 조리법, 학습 목표) ② 역할 ③ 흐름과 시작. 아래에 "다음" 버튼이 있고, 칸을 다 채우지 않아도 넘어간다. 성공 조건·과제 예시·준비 조건·실행 팁·확인 기록은 ①의 "더 적기" 안에 접혀 있다.
- **역할 카드:** 이름, 맡을 일, 도구·권한, 지시문만 먼저 보인다. "산출물과 완료 기준"과 "자세히(권한이 지켜지는 방식, 파일에 들어갈 지시문, 고급 설정)"는 접혀 있다.
- **내보내기 창:** 맨 위에 "바로 받을 수 있어요"와 내려받기 버튼이 있다. "채우면 더 좋아요"와 "들어 있는 파일 미리 보기"는 접혀 있다. 점검 항목을 누르면 그 단계로 옮겨 가고 접힌 칸이 펼쳐진다.
- **상세 화면:** 학습 목표, 팀 구성(한 줄 요약 + "자세히"), 흐름, 시작 프롬프트만 펼쳐 둔다. 준비할 것, 실행 반영 범위 표, 확인 기록은 맨 아래 "더 알아보기"에 접혀 있다. 적혀 있지 않은 항목은 "없어요"라고 쓰지 않고 그냥 보이지 않는다.
- **갤러리 카드:** 고르는 데 필요한 것만 남겼다(제목, 설명, 필요한 플랜, 내 플랜으로 되는지).
- 길이(1280px 폭 기준): 편집 화면 ① 960px, ②(카드 하나 펼침) 1,729px, ③ 1,104px. 상세 화면 2,262px. 내보내기 창 627px.

### 실제로 확인한 범위
- 단위 테스트 220개(이번에 `src/lib/phase1.test.ts` 38개 추가), 타입 검사, 웹·CLI 빌드 통과. 시작 전 기준은 179개 통과였고 기존 실패는 없었다.
- 로컬 브라우저 자동 실행으로 최종 시나리오 확인: v1로 저장된 레시피 열기 → 빠진 항목 표시 → 점검에서 차단 → 점검 항목을 눌러 입력 칸으로 이동 → 보완 → 새로고침 뒤 유지 → 통과 → 미리보기 → ZIP → ZIP 안의 경로·내용이 미리보기와 같음 → RECIPE.md에 성공 조건과 첫 실행 절차. 콘솔 오류 0건. 화면은 `design/shots/p1-*.png`.
- **실제 에이전트 실행은 하지 않았다.** 설정 파일이 만들어지는 것까지만 확인했다. 기본 레시피 21종 중 실제 도구에서 확인된 것은 사용자가 2026-11-16에 돌린 'Claude 작성 + Codex 교차 검토' 하나뿐이고, 그것도 에이전트 인식까지다.

### 알려진 제한
- 화면 낭독기로 직접 들어 보지는 않았다. 이름표, 키보드 이동, Esc로 닫기, 점검 항목에서 초점 이동은 자동 실행으로 확인했다.
- GraphRAG 예제는 설계 예제다(실행하지 않음). 과제 예시의 주제 3개는 예로 넣은 것이다.
- 내보내기 창은 무엇이 들어가는지 한 줄로만 보여 준다. 그 창에서 도구를 바꾸는 기능은 없다(역할의 도구는 편집 화면에서 바꾼다).
- 기본 레시피 21종 중 가장 긴 공유 링크가 3,971자다(경고 기준 4,000자). 기본 레시피에 내용을 더 넣으면 테스트가 실패한다.

### 2·3차에 연결할 지점 (이번에는 만들지 않음)
- 레시피·역할·산출물·넘겨주기·확인 기록에 모두 고정 id가 있고, 고칠 때 id를 다시 만들지 않는다. `Recipe`는 그대로 JSON으로 저장할 수 있어 실행 시점의 복사본으로 남길 수 있다.
- 실행 기록 화면, 로그 수집, 비교 평가, 사용량 계측, 자동 재시도·분기, CLI 자동 호출, A2A는 만들지 않았다. 화면 버튼에 CLI 호출이나 외부 전송을 넣지 않았다.
- 나중에 실제 실행 연동을 넣더라도 지금의 "프롬프트로 안내되는 흐름"을 실행 규칙으로 바꾸지 말고 별도 기능으로 다룬다. 역할 카드는 A2A Agent Card와 다른 개념이다.

## 첫 화면 구성과 기본 레시피 20종 (2026-11-16)

- **첫 화면을 "무엇을 하려고 하나요?"로 바꿨다 (사용자 요청).** 검색창과 전체 목록을 먼저 보여 주던 구성을 버리고, 상황 6가지(새로 만들기, 고치고 지키기, 검토하기, 알아보기, 글 쓰기, 결정하기)를 먼저 고르게 한다. 고르기 전에는 상황마다 3개씩만 보이고, 고르면 그 상황의 레시피만 보인다.
- 검색 칸은 작게 옆으로 옮겼고, 내 플랜·조리법 조건은 "조건" 버튼 안에 접었다. 검색이나 조건을 쓰면 상황 묶음 대신 "찾은 레시피 N가지" 목록이 나온다. "내 AI 현황"은 표지 아래 작은 한 줄이다.
- **기본 레시피를 5종에서 20종으로 늘렸다.** 추가분 15종은 `src/data/moreRecipes.ts`에 있고, 같은 파일의 `SHELVES`가 상황별 묶음이다. 모든 기본 레시피는 정확히 한 묶음에 들어가야 한다(테스트가 확인한다).
- **추가분 15종은 실제 도구에서 돌려 보지 않았다.** 설정 형식만 맞췄다. 그래서 `lastVerified`를 적지 않았고, 직접 확인한 레시피부터 날짜를 넣으면 된다. 도구는 일부러 Codex·Claude Code·프롬프트(토론형)만 썼다(요금제 정보를 공식 문서로 확인한 도구).
- 에디토리얼 쿡북 방향(DESIGN.md)은 시안 단계에서 사용자가 취소했다. 파일도 지웠다. 이유: 색·글꼴만 바뀌고 화면 구성이 같아서 나아진 것이 없었다.

## 디자인 방향 (2026-11-16 결정, 같은 날 한 번 바뀜)

- **지금 방향: "레시피 카드"** (`design/teamcook-design-round3.html`의 시안 2). 따뜻한 종이색 바탕(`#FAF7F2`)에 흰 카드, 얇은 선과 둥근 모서리. 제목은 명조(Hahmlet), 본문은 고딕(IBM Plex Sans KR). **포인트 색은 토마토 빨강(`#C63C26`) 하나**이고 주 버튼, 번호, 작은 제목, 메뉴 밑줄에만 쓴다.
- 앞서 "포장 라벨"(시안 C)을 먼저 적용했다가 사용자가 "레시피 카드"로 바꿨다. 라벨용 굵은 줄(`.label-rule`)과 표(`FactTable`)는 지웠다.
- **레시피 카드 구조:** 조리법(작은 색 점 + 이름, "2인분") → 제목 → 설명 → "재료"(필요한 플랜과 도구) → "만드는 순서"(넘겨주기 흐름을 번호로, 3줄까지) → 내 플랜 표시. `src/pages/GalleryPage.tsx`의 `RecipeTile`.
- **위쪽 메뉴:** "레시피", "내 AI 현황" 두 개만 있고, 마우스를 올리면 밑줄이 왼쪽에서부터 그어진다. "어디서 돌리나요?" 화면은 그대로 있고, 메뉴 오른쪽의 작은 **"도움말"** 링크로 들어간다(사용자 요청).
- **움직임은 세 가지뿐:** 메뉴 밑줄, 레시피 카드가 3px 들리는 것, 버튼이 눌리는 것. 모두 `src/index.css` 아래쪽에 있고, "움직임 줄이기" 설정에서는 꺼진다. 랜딩페이지식 화려한 효과는 쓰지 않는다(사용자 결정).
- **확인 날짜는 강조하지 않는다 (사용자 결정).** 갤러리 카드에는 날짜가 없고, 레시피 화면과 편집 화면에 작은 회색 글자로만 나온다. 추가 지시서(`BRIEF_collaboration-styles.md`)의 "눈에 띄게"보다 이 결정이 나중이다.
- 보라색은 쓰지 않는다. 에이전트 팀의 점 색은 강황색(`--style-agent-team`)이다.
- 고칠 곳: 색·모서리·글꼴은 `src/index.css`의 `:root`와 `@theme`, 조리법 점 색은 `--style-*`와 `src/components/RouteInfo.tsx`의 `STYLE_COLORS`, 메뉴는 `src/App.tsx`.
- 아직 손대지 않은 것: 실행 경로 배지(①~④)와 안내 상자의 색(초록·하늘·노랑·빨강)은 예전 그대로다. 편집 화면은 색·글꼴·모서리만 바뀌었고 배치는 그대로다(시안 3 "주방 작업대" 배치를 섞는 안이 있었으나 정하지 않음).
- 시안 파일은 모두 `design/`에 있다(1차 A·B·C, 편집 화면 A·B·C, 2차 D·E, 3차 1·2·3). `design/shots/`는 적용 뒤 찍은 화면이다.

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
