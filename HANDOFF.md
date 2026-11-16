# HANDOFF — 인계 문서

> 다음에 이어받는 모델(또는 사람)이 이 대화 없이도 작업을 이어갈 수 있게 쓰는 문서. 단계가 끝날 때마다 갱신한다.
> 먼저 읽을 것: `CLAUDE.md`(작업 규칙, 폴더 구조) → 이 문서 → 필요하면 `PROJECT_BRIEF.md`.

## 현재 상태 (2026-11-16 09:10 KST 기준)

- **0~4단계 완료.** 5단계 중 '실행 안내 페이지'까지 완료. '시간 남으면' 항목(흐름 캔버스, 꿀팁, 파일 끌어다 놓기)도 완료. **GitHub 올리기와 Vercel 배포는 아직** (사용자 계정 로그인이 필요해서 사용자가 해야 함. 아래 '사용자가 할 일' 참고).
- 배포 링크: (아직 없음)
- 저장소 링크: (아직 없음 — 로컬 git에만 커밋돼 있음)
- 확인된 것: `npm test` 96개 통과, `npm run typecheck` 통과, `npm run build` 통과, 브라우저(Edge 헤드리스)로 전체 흐름을 자동 실행해 콘솔 오류 0건.

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

### 3단계 · 편집기 + 내 AI 현황 + 내보내기 — 화면 완료, 실제 CLI 확인만 남음
- [x] 레시피를 만들고 새로고침해도 남아 있다 (자동 실행으로 확인)
- [x] '내 AI 현황'을 바꾸면 배지와 대안이 즉시 바뀐다 (자동 실행으로 확인)
- [ ] **zip을 테스트 프로젝트에 풀고 `codex`와 `claude`에서 에이전트가 인식되는지 — 사용자가 직접 확인해야 함.** (아래 '사용자가 할 일' 1번)

### 4단계 · 공유 링크 + 기본 레시피 + 갤러리 — 완료
- [x] 링크를 다른 브라우저(새 브라우저 컨텍스트)에서 열면 같은 레시피가 보인다
- [x] 공유받은 레시피에 내 플랜 기준 경로가 바로 표시된다
- [x] 필터를 켜면 플랜에 맞지 않는 레시피가 숨겨진다

### 5단계 · 실행 안내 + 배포 — 일부 완료
- [x] '어디서 돌리나요?' 페이지 (`src/pages/HowToRunPage.tsx`)
- [ ] GitHub 저장소 만들고 올리기 (사용자 계정 필요)
- [ ] Vercel 배포 (사용자 계정 필요)

### 시간 남으면 하는 것
- [x] 꿀팁: 편집기 아래에 팁 7개 + 카드별 경고(검토자가 편집 권한이면 경고 등) — `src/data/tips.ts`
- [x] 흐름 캔버스 (React Flow): `src/components/FlowCanvas.tsx`. 카드 = 상자, 넘겨주기 = 화살표, 상자에 경로 배지. 편집기에서는 상자 오른쪽 점에서 끌어 잇기, 화살표를 눌러 지우기. 자동 배치는 `src/lib/flowLayout.ts`(위치는 저장하지 않음). 화살표 라벨은 캔버스 아래 줄에서 고친다.
- [x] 파일 끌어다 놓기: 갤러리 맨 위 상자와 편집기의 '에이전트 카드' 영역에 파일을 놓으면 불러온다. (끌어다 놓기는 자동 실행으로 확인하지 못함. 파일 선택 버튼은 사용자의 실제 TOML 4개로 확인함.)

## 사용자가 할 일 (AI가 대신 못 하는 것)

1. **내보낸 zip이 실제 도구에서 인식되는지 확인** (5분)
   1. `npm run dev` → 브라우저에서 http://localhost:5173 → 기본 레시피 하나 열기 → `zip으로 내보내기`
   2. 빈 테스트 폴더를 만들고 zip 안의 `.codex`, `.claude` 폴더를 복사
   3. 그 폴더에서 `claude` 실행 → "어떤 서브에이전트가 있어?" 입력 → reviewer 등이 보이는지 확인
   4. 그 폴더에서 `codex` 실행 → "reviewer 에이전트에게 이 폴더를 한 줄로 요약하게 해 줘" 입력 → 서브에이전트가 도는지 확인 (`/subagents`)
   5. 안 되면 오류 메시지를 다음 모델에게 그대로 전달
2. **GitHub에 올리기** — 아래 '배포 절차' 참고
3. **Vercel 배포** — 아래 '배포 절차' 참고
4. **공개 전에 확인:** `MCP-strategy.md`(이름이 적혀 있음)와 `samples/codex/`(직접 쓴 프롬프트 4개)를 공개 저장소에 올려도 되는지. 싫으면 비공개 저장소로 만들거나 두 항목을 지우고 커밋한다. (`samples/codex`를 지우면 `src/converters/codex.test.ts`의 샘플 테스트가 "샘플이 1개 이상 있다"에서 실패하니, 다른 예시 TOML을 하나 넣어 둘 것.)
5. 루트에 남아 있는 `pyproject.toml`, `.python-version`, `src/claude_mcp/`, `.venv/`는 이 프로젝트와 무관한 파이썬 초기 파일로 보인다. 일부러 커밋하지 않았다. 필요 없으면 지워도 된다.

### 배포 절차 (처음 하는 사람용)

1. https://github.com/new 에서 저장소를 만든다 (이름 예: `agent-recipes`, README 추가 체크는 **끄기**).
2. 이 폴더의 터미널에서:
   ```bash
   git remote add origin https://github.com/<내-아이디>/agent-recipes.git
   git push -u origin main
   ```
   (처음이면 브라우저 로그인 창이 뜬다.)
3. https://vercel.com 에 GitHub 계정으로 로그인 → **Add New… → Project** → 방금 만든 저장소 **Import**.
4. 설정은 자동 인식된다 (Framework: Vite, Build: `npm run build`, Output: `dist`). 그대로 **Deploy**.
5. 나온 주소(`https://….vercel.app`)를 이 문서의 '배포 링크'에 적는다. 이후에는 `git push`만 하면 자동으로 다시 배포된다.
6. 배포된 주소에서 확인: 갤러리 → 기본 레시피 → 내 레시피로 가져오기 → 링크 복사 → 시크릿 창에서 열기 → 가져오기 → zip 내보내기.

## 알려진 버그와 임시 처리

- **Vitest가 Windows 소문자 드라이브 경로(`c:\...`)에서 실패한다.** `npm test`는 `scripts/vitest.mjs`가 드라이브 문자를 대문자로 바꿔 다시 실행하는 방식으로 우회했다. `npx vitest`를 직접 실행하지 말 것.
- **Codex에서 에이전트가 실제로 인식되는지는 미확인.** `codex debug prompt-input`으로는 확인할 수 없었다(도구 목록이 출력에 없음). 형식은 2026-11-16 공식 문서의 예시와 같다.
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
- **메타 주석:** 형식에 자리가 없는 카드 정보(표시 이름, 역할 태그, 권한, 원래 엔진)는 파일의 주석 한 줄 `# agent-recipes: {…}`에 싣는다. 주석이라 Codex·Claude Code는 무시한다. (`src/converters/meta.ts`)
- `resolvePath`에 선택 인자 `context.writerProviders`를 추가했다(교차 검토 판단용). `resolveRecipe`가 작성자를 먼저 정한 뒤 검토자를 다시 계산한다.
- `resolvePath` 결과: 막힌 카드는 `{ locked: true, path: 4, engine: 'manual', alternative: {...} }`. **실제로 쓰게 되는 경로는 `effectiveRoute()`로 얻는다.**
- `alternative.kind`: `'fallback'`(막혀서 필요한 대안) / `'suggestion'`(막히진 않았지만 더 나은 선택 — 교차 검토, 구독 최적화).
- 플랜이 `'none'`(안 써요)이면 무료 경로도 없다고 본다. 그래야 갤러리 필터가 의미가 있다. 대신 "무료 계정을 만들면 쓸 수 있어요" 안내 문장을 준다.
- 대안으로는 `status: "ready"`(설정 파일 내보내기 지원)인 엔진만 추천한다. 지금은 Codex와 Claude Code뿐.
- 기본 레시피 3번(조사원 + 정리원)은 전부 Claude Code로 구성했다(배지가 3종 모두 다르게 나오도록).

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

1. 위 '사용자가 할 일' 1~3번이 끝났는지 확인하고, 실제 CLI 확인에서 나온 문제를 고친다 (가장 먼저).
2. 흐름 캔버스 다듬기: 캔버스 안에서 화살표 라벨 바로 고치기, 상자를 눌러 그 카드 편집 열기.
3. 디자인 다듬기, 코드 분할로 빌드 경고 없애기(jszip·yaml·smol-toml을 내보내기·불러오기 때만 불러오기).
4. 그다음은 `PROJECT_BRIEF.md` 6단계(레시피 허브: 서버 저장, 검색, 포크 / Gemini·Grok 어댑터 / 구독 최적화 고도화).
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
