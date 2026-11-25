# teamcook — 작업 안내

> 서비스 이름은 **teamcook**으로 확정(2026-11-16). 슬로건: **"AI 팀을 레시피로 요리하세요"**. 옛 가칭은 agent-recipes.

> 이 파일과 `AGENTS.md`는 **같은 내용**이다. 하나를 고치면 다른 하나도 똑같이 고친다.
> 지시서와 전략 문서는 `지시서들/` 폴더에 있다(`PROJECT_BRIEF.md`, `MCP-strategy.md`, 단계별 지시서). 현재 상태와 다음 할 일은 `HANDOFF.md`에 있다.

## 한 줄 요약

멀티 에이전트를 쓰는 사람이 **AI 팀을 부리는 고용주**가 되게 하는 웹사이트(React, Vercel 배포). 내 프로젝트 폴더를 열면 숨김 폴더(`.codex/agents`, `.claude/agents`) 속 역할 파일을 **팀원 카드로 보여 주고(보이게)**, 맡길 일·권한을 고치면 **그 파일에 바로 저장하고(고치게)**, Claude Code·Codex가 남긴 대화 기록에서 **누구에게 무엇을 시켰고 무엇을 돌려받았는지 업무 일지로 보여 준다(보고받게)**. 레시피 책(검증된 팀 구성)과 공유 링크는 팀을 들이는 통로다.

**포지션: "실행은 Claude Code·Codex에서, 팀을 보고 고치고 보고받는 것은 여기서."** (2026-11-17 사용자 결정으로 '내 프로젝트 폴더 열기'가 중심이 됐다. 이유와 경과는 `HANDOFF.md`의 '방향 전환')

**문이 두 개다 (2026-11-18, `HANDOFF.md`의 '문 두 개').** 웹(처음 해 보는 사람: 레시피 추천·레시피 책, 요리 말투)과 작업실(`npx teamcook open`(저장소에서는 `npm run open`)이 띄운 내 컴퓨터 화면, 이미 팀을 돌리는 사람: 팀원·업무 일지, 회사 말투). 코드는 하나이고 `App.tsx`가 `isLocal()`로 틀을 고른다. 한 문에 기능을 더할 때는 그 문의 사람과 말투에 맞는지 먼저 본다. 주문서와 실습 기록은 화면에서 숨겼다(주소로만 열림).

## 핵심 원칙

1. 팀 설계는 하나로, 실행 경로는 사용자가 가진 플랜에 맞춰 자동으로.
2. 유료 구독이 하나라도 있으면 최대한 활용하고, 무료만 써도 어느 정도 쓸 수 있게.
3. 실행은 남(Codex, Claude Code, T3 Code, 1Code)에게, 팀 설계와 레시피는 우리가.
4. 초보자 전용이 아니다. 개발자에게도 쓸모 있으면서 문턱을 낮춘다. **화면과 문서는 한국어 우선.**

## 하지 않을 것 (비목표)

- 에이전트 실행·세션·스레드 관리 기능 (T3 Code, 1Code와 경쟁하지 않는다). 대화 기록은 **읽기만** 한다.
- 서비스 안에서 API 키로 에이전트를 돌리기 (2026-11-17 검토 후 하지 않기로 함: 구독을 못 쓰고 코드 작업을 못 한다)
- 자체 LLM 오케스트레이션 엔진
- 무료 웹 채팅 계정 자동 로그인·화면 긁기 (약관 위반)
- 복사·붙여넣기 '릴레이 모드'를 중심 기능으로 만들기 (마지막 대안일 뿐)
- 회원가입, 로그인, 서버 DB (공유는 URL만으로)
- **API 키 값을 받거나 저장하기** ('보유 여부' 체크만 한다)
- 사용자가 고르지 않은 폴더를 읽기. 예외는 사용자가 직접 `teamcook open`(내 컴퓨터 도우미)을 실행했을 때뿐이고, 그때도 `~/.claude/projects`와 `~/.codex/sessions`의 대화 기록 파일(`.jsonl`, `.jsonl.zst`)만 읽으며 처음 화면에 읽는 곳을 보여 준다. 기록 폴더에서는 대화 기록 파일만 읽고, 인증·설정 파일은 열지 않는다. 설정 파일(`.codex/config.toml`, `.claude/settings.json`)은 자동으로 고치지 않는다. 활동 요약(`/api/activity`)도 같은 기록 파일만 읽고, 도우미가 요약만 화면으로 보내며 디스크에 저장하지 않는다. 프로젝트 폴더의 파일 내용·이름 트리는 읽지 않는다(역할 파일·설정 두 개·`.teamcook/`만).

## 폴더 구조

```
src/
├─ types.ts                # Recipe, AgentCard, UserPlans 등 모든 데이터 모델
├─ data/
│  ├─ providers.json       # 요금제·무료 범위·엔진 정보 (여기만 고치면 됨, 확인 날짜·출처 필수)
│  ├─ providers.ts         # providers.json을 타입과 함께 내보냄
│  ├─ recipes.ts           # 기본 레시피 21종의 목록 (앞의 5종이 여기 있음. 순서 바꾸지 말 것, 새 것은 뒤에)
│  ├─ moreRecipes.ts       # 추가 레시피 16종(짧게 적는 make 도우미)과 첫 화면의 상황별 묶음 SHELVES. 레시피를 더하면 SHELVES에도 넣는다
│  ├─ recipeDetails.ts     # 기본 레시피의 학습 목표·성공 조건·역할별 산출물·완료 기준·확인 기록 (레시피를 더하면 여기도 채운다)
│  ├─ collaboration.ts     # 조리법(협업 방식: 서브에이전트·에이전트 팀·토론형) 문구, 공식 문서 확인 기록, 에이전트 팀 설정
│  ├─ cardTemplates.ts     # 카드 추가용 역할별 틀
│  └─ tips.ts              # 꿀팁과 카드 경고
├─ converters/             # 형식 변환은 전부 여기에만 (codex.ts, claude.ts, markdownAgents.ts = Antigravity·Grok, instructions.ts = 지시문에 산출물·완료 기준 덧붙이기)
├─ lib/
│  ├─ resolvePath.ts       # 실행 경로 해석기 (①~④, 🔒, 대안)
│  ├─ requiredPlans.ts     # '필요한 플랜' 배지, fitsMyPlans
│  ├─ share.ts             # 공유 링크 (#r=...)
│  ├─ recipeSchema.ts      # 바깥 데이터를 안전한 Recipe로 다듬기 (버전 변환도 여기)
│  ├─ router.ts            # hash 기반 화면 전환
│  ├─ recipeMd.ts          # RECIPE.md 생성
│  ├─ exportZip.ts         # zip 내보내기
│  ├─ exportCheck.ts       # 내보내기 전 점검 (수정 필요·확인 필요·참고). 화면과 ZIP 생성이 함께 쓴다
│  ├─ support.ts           # 도구·조리법이 실제로 해 주는 것: 권한을 지키는 수단, 실행 반영 범위 (설명은 여기에만 적는다)
│  ├─ verification.ts      # 확인 기록 이름표 (문서 확인 / 파일 생성 확인 / 실제 실행 확인)
│  ├─ order/               # 주문(작업 설계): types, draft(규칙 기반 초안), ops(작업 편집·참조 영향·범위), team(역할 제안), toRecipe(레시피 변환·점검·연결 상태), schema(저장·JSON), materials(자료 읽기), snapshot(실습 기록용 복사본)
│  ├─ workspace/           # 내 프로젝트 폴더: fs(폴더 읽기·쓰기, 테스트용 메모리 폴더), team(팀 읽기 scanTeam, 고친 것만 쓰기 planSave·applyChanges, 레시피 들이기 planHire)
│  ├─ journal/             # 업무 일지: claude·codex(대화 기록 해석, 형식은 문서에 없어 실제 기록에서 본 모양), read(기록 폴더 읽기), activity(활동 요약·이어하기 복사 걸러내기·권한 점검·위임 계보. 순수 함수), builtinAgents(Claude Code·Codex 기본 도우미 10종의 소개. 도구가 새 도우미를 더하면 여기에도 더한다. 없는 이름은 지어내지 않는다)
│  ├─ local/               # 내 컴퓨터 도우미(teamcook open)와 이야기하는 쪽: 도우미가 띄운 화면인지 알아보기, 도우미 너머의 폴더를 DirLike로 쓰기, 실시간 알림
│  ├─ practice/            # 실습 기록·비교 평가 (2차, 부가 기능. 진입은 components/practice/PracticePanel.tsx의 옆 패널). types, schema(읽기·버전), storage(저장 API, 화면과 분리), model(만들기·잠금·측정 검사), rubric, compare, report(Markdown), transfer(JSON), demo(GraphRAG 합성 데모)
│  ├─ plansSummary.ts      # 내 AI 현황 한 줄 요약 (추천 상자·레시피 책이 함께 씀)
│  ├─ suggest.ts           # "~하고 싶다"는 말에 레시피 제안 (AI 호출 없음: 낱말 + 내 플랜 + 사용량 여유, 고른 이유를 함께 돌려줌)
│  ├─ cost.ts              # 사용량 어림(가벼움·보통·무거움)과 내 여건에서 어디서 나가는지. 토큰·금액 숫자는 짐작하지 않는다
│  ├─ optimize.ts          # 구독 최적화 제안
│  ├─ startGuide.ts        # 레시피를 폴더에 들인 직후의 '시작하기' 안내: 도구별 시작 명령(cd 포함), 프롬프트의 '할 일' 칸 채우기. 화면은 pages/team/StartGuide.tsx. 복사까지만 하고 실행하지 않는다
│  └─ bridge.ts            # Claude Code → Codex 연결(codex exec)
├─ cli/                    # 설치 명령 (node teamcook.mjs add <링크>)과 내 컴퓨터 도우미 (node teamcook.mjs open, local/: 읽고 쓸 수 있는 곳 규칙 policy, 최근 프로젝트 찾기 discover, 이 컴퓨터 안에서만 열리는 server, activity = 기록을 읽어 활동 요약을 만드는 쪽). 빌드 결과는 루트의 cli/teamcook.mjs — 사용자가 이 파일을 GitHub에서 직접 받아 쓰므로 반드시 다시 빌드해 커밋
├─ store/                  # zustand + localStorage. useOrders = 주문('teamcook-orders', 저장 성공 시에만 화면 반영). useWorkspace = 연 폴더(손잡이는 IndexedDB에만 기억). useStore = 레시피·플랜('agent-recipes'), usePractice = 실습 기록('teamcook-practice', 저장 성공 시에만 화면 반영)
├─ components/             # 공용 부품 (RouteInfo, RecipeOverview, FlowCanvas 등). RecipeTile = 레시피 카드 한 장(레시피 책은 링크로, 팀원 들이기는 고르는 버튼으로 같은 카드를 쓴다)
│  └─ ui/                  # shadcn/ui 컴포넌트 (npx shadcn@latest add <이름>)
└─ pages/                  # Home(웹 첫 화면 #/: "어떤 일을 맡길까요?" + 추천 상자), Workshop(작업실 소개 #/workshop, 웹에서만), team/(팀원 #/team·활동 #/activity·업무 일지 #/journal, 작업실의 중심이자 웹의 맛보기, LocalProjects = 작업실의 최근 프로젝트, ActivityTab = 이 폴더에서 AI가 한 일, StartGuide = 레시피를 들인 뒤 시작 안내), Gallery(레시피 책 #/recipes), RecipeEditor, MyPlans(내 AI), SharedRecipe, HowToRun, Concepts(재료 사전 #/learn), order/(숨김: 주문 시작 #/orders/new, 주문 #/order/<id>, 목록 #/orders), practice/(숨김: 실습 기록 #/runs)
samples/codex/             # 사용자의 실제 Codex TOML (변환기 테스트용)
design/                    # 디자인 시안 (브라우저로 여는 HTML)과 적용 뒤 화면(shots/). 채택: 3차 시안 2 "레시피 카드"
```

**설계 원칙:** 모든 화면은 `Recipe` 데이터 하나를 읽고 쓴다. 제공사별 차이는 `converters/`와 `providers.json`에만 둔다.

## 작업 규칙

- 한국어로, 쉬운 말로 설명한다. 사용자는 앱·웹 개발 경력이 거의 없다.
- 작게, 자주 커밋한다 (기능 하나 = 커밋 하나, 한국어 커밋 메시지 가능).
- 변환기·경로 해석기·배지·공유 링크는 반드시 단위 테스트를 붙인다.
- 요금제·설정 형식 사실은 공식 문서로 확인하고, `providers.json`에 확인 날짜와 URL을 적는다.
- `~/.codex/auth.json`, `~/.claude` 안의 인증 파일은 읽지도 쓰지도 않는다.
- 전역 설치나 시스템 설정 변경은 실행 전에 사용자에게 묻는다.
- 공유 링크는 하위 호환을 지킨다 (`schemaVersion` 필수, 옛 버전 읽기 코드 유지). 지금 버전은 2이고, 옛 형식을 바꾸는 규칙은 `lib/recipeSchema.ts`의 `parseRecipe`에만 둔다.
- "설계한 것, 파일에 반영한 것, 실제로 실행해 확인한 것"을 섞지 않는다. 실행해 보지 않은 것을 "확인됨"이나 "지원"으로 적지 않는다. 확인 기록은 종류(문서·파일 생성·실제 실행)를 나눠 적는다.
- 실습 기록은 레시피와 따로 저장하고 레시피 공유 링크에 넣지 않는다. 사이트는 AI를 실행하지 않으므로 기록의 출처를 '자동 관측'으로 만들지 않고, 미확인 값을 0으로 바꾸지 않으며, 점수를 합산하거나 승자를 정하지 않는다.
- 개념 설명은 '재료' 비유(재료 = 에이전트, 조리법 = 협업 방식, 주방 = 실행 도구, 재료비 = 토큰)를 쓰되, 비유와 공식 문서로 확인한 사실을 나눠 적는다.
- 주문의 자동 정리는 AI 없는 규칙 기반이다. 자동으로 만든 요구·작업은 모두 '제안'이고 사용자가 확정한 것만 레시피에 들어간다. 원문·자료를 고치거나 빼도 정리 내용을 조용히 바꾸지 않는다. 주문 ID와 실습 기록 ID는 다른 것이다.
- 레시피의 조리법은 `recipe.collaboration`을 직접 읽지 말고 `collaborationOf(recipe)`로 읽는다 (없으면 서브에이전트).
- 디자인은 "레시피 카드" 방향이다 (`HANDOFF.md`의 '디자인 방향'). 색·모서리·글꼴은 `src/index.css`에서만 고친다. 포인트 색은 토마토 빨강 하나, 보라색은 쓰지 않는다. 움직임은 절제한다(랜딩페이지식 화려한 효과 금지). 스크롤 효과는 `Reveal` 부품의 '선이 그어지는' 한 가지 결만 쓴다. 개념 설명 화면은 줄글보다 도해·표를 먼저 쓴다. 확인 날짜는 강조하지 않는다.
- 화면은 사용자 친화적으로: 한 화면에 한 가지 일, 꼭 필요한 칸만 먼저 보이고 선택 항목은 접는다. 같은 안내를 되풀이하지 않는다. 내보내기를 막는 것은 파일이 깨지는 경우뿐이고, 나머지는 "채우면 더 좋아요"로만 알린다.
- 대화 기록을 요약·집계하는 기능은 가짜 기록 테스트만으로 끝내지 말고, **진짜 기록으로 한 번 숫자를 대조**한다(숫자·시간만 보고 내용은 화면에 옮기지 않는다). 이어하기(resume)로 복사된 줄 때문에 숫자가 5배쯤 부풀려진 것은 진짜 기록에서만 드러났다.
- 단계가 끝날 때마다 `HANDOFF.md`를 갱신한다.

## 자주 쓰는 명령

```bash
npm run dev        # 개발 서버 (http://localhost:5173)
npm test           # 단위 테스트 (Vitest)
npm run typecheck  # 타입 검사
npm run build      # 배포용 빌드 (dist/)
npm run build:cli  # 설치 명령 묶음 (cli/teamcook.mjs). src/cli나 변환기를 고치면 다시 빌드해서 함께 커밋
npm run open       # 내 컴퓨터 도우미 (먼저 npm run build). 최근 프로젝트·실시간 업무 일지
```

> Windows 주의: `npm test`는 `scripts/vitest.mjs`를 거쳐 실행한다. 드라이브 문자가 소문자(`c:\...`)인 터미널에서 Vitest 5가 실패하는 문제를 피하기 위해서다. `npx vitest`를 직접 실행하지 말 것.

## 현재 단계

(2026-11-16 기준) 0~5단계 완료(배포: https://teamcook-eta.vercel.app/, 저장소: fun5307/teamcook). 6·7단계 중 계정·API 키 없이 가능한 것(Antigravity·Grok 어댑터, 구독 최적화, 검색, Codex 연결 다리, 설치 명령)도 완료. 남은 것과 이유는 `HANDOFF.md`의 '6·7단계 현황'. 조리법(협업 방식)과 확인 날짜 표시도 추가 완료(`BRIEF_collaboration-styles.md`, `HANDOFF.md`의 '조리법 현황'). 에이전트 팀이 실제 Claude Code에서 시작되는지는 사용자 확인 대기. 1차 개선(학습 목표·역할별 산출물·전달 정보·내보내기 점검·파일 미리보기, `teamcook-phase1-agent-prompt.md`)도 구현 완료이며 기록은 `HANDOFF.md`의 '1차 개선'에 있다. 2차 개선(실습 기록·비교 평가, `지시서들/teamcook-phase2-agent-prompt.md`)도 배포했다. 실습 기록은 **부가 기능**이라 주 메뉴·레시피 화면에 넣지 않고 페이지 맨 아래(바닥글)의 "실습 기록" 옆 패널로만 들어간다. **3차 지시서(로컬 실행·A2A 실습)는 하지 않는다(사용자 결정).** 그 뒤 레시피 제안·사용량 어림·재료 사전을 추가했다(`HANDOFF.md`의 '레시피 제안·사용량 어림·재료 사전'). 1차 점검표와 기록은 `HANDOFF.md`의 '2차 개선'에 있다.
