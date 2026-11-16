# teamcook — 작업 안내

> 서비스 이름은 **teamcook**으로 확정(2026-11-16). 슬로건: **"AI 팀을 레시피로 요리하세요"**. 옛 가칭은 agent-recipes.

> 이 파일과 `AGENTS.md`는 **같은 내용**이다. 하나를 고치면 다른 하나도 똑같이 고친다.
> 전체 지시서는 `PROJECT_BRIEF.md`, 전략은 `MCP-strategy.md`, 현재 상태와 다음 할 일은 `HANDOFF.md`에 있다.

## 한 줄 요약

GPT(Codex)·Claude 등의 에이전트로 이뤄진 **AI 팀 레시피**를 설계하고, 내 플랜에 맞춰 실행 경로를 정하고, **링크 하나로 공유**하는 웹사이트(React, Vercel 배포).

**포지션: "실행은 어디서든, 팀 설계와 레시피는 여기서."**

## 핵심 원칙

1. 팀 설계는 하나로, 실행 경로는 사용자가 가진 플랜에 맞춰 자동으로.
2. 유료 구독이 하나라도 있으면 최대한 활용하고, 무료만 써도 어느 정도 쓸 수 있게.
3. 실행은 남(Codex, Claude Code, T3 Code, 1Code)에게, 팀 설계와 레시피는 우리가.
4. 초보자 전용이 아니다. 개발자에게도 쓸모 있으면서 문턱을 낮춘다. **화면과 문서는 한국어 우선.**

## 하지 않을 것 (비목표)

- 에이전트 실행·세션·스레드 관리 기능 (T3 Code, 1Code와 경쟁하지 않는다)
- 자체 LLM 오케스트레이션 엔진
- 무료 웹 채팅 계정 자동 로그인·화면 긁기 (약관 위반)
- 복사·붙여넣기 '릴레이 모드'를 중심 기능으로 만들기 (마지막 대안일 뿐)
- 회원가입, 로그인, 서버 DB (공유는 URL만으로)
- **API 키 값을 받거나 저장하기** ('보유 여부' 체크만 한다)

## 폴더 구조

```
src/
├─ types.ts                # Recipe, AgentCard, UserPlans 등 모든 데이터 모델
├─ data/
│  ├─ providers.json       # 요금제·무료 범위·엔진 정보 (여기만 고치면 됨, 확인 날짜·출처 필수)
│  ├─ providers.ts         # providers.json을 타입과 함께 내보냄
│  ├─ recipes.ts           # 기본 레시피 20종의 목록 (앞의 5종이 여기 있음. 순서 바꾸지 말 것, 새 것은 뒤에)
│  ├─ moreRecipes.ts       # 추가 레시피 15종(짧게 적는 make 도우미)과 첫 화면의 상황별 묶음 SHELVES. 레시피를 더하면 SHELVES에도 넣는다
│  ├─ collaboration.ts     # 조리법(협업 방식: 서브에이전트·에이전트 팀·토론형) 문구, 공식 문서 확인 기록, 에이전트 팀 설정
│  ├─ cardTemplates.ts     # 카드 추가용 역할별 틀
│  └─ tips.ts              # 꿀팁과 카드 경고
├─ converters/             # 형식 변환은 전부 여기에만 (codex.ts, claude.ts, markdownAgents.ts = Antigravity·Grok)
├─ lib/
│  ├─ resolvePath.ts       # 실행 경로 해석기 (①~④, 🔒, 대안)
│  ├─ requiredPlans.ts     # '필요한 플랜' 배지, fitsMyPlans
│  ├─ share.ts             # 공유 링크 (#r=...)
│  ├─ recipeSchema.ts      # 바깥 데이터를 안전한 Recipe로 다듬기 (버전 변환도 여기)
│  ├─ router.ts            # hash 기반 화면 전환
│  ├─ recipeMd.ts          # RECIPE.md 생성
│  ├─ exportZip.ts         # zip 내보내기
│  ├─ optimize.ts          # 구독 최적화 제안
│  └─ bridge.ts            # Claude Code → Codex 연결(codex exec)
├─ cli/                    # 설치 명령 (node teamcook.mjs add <링크>). 빌드 결과는 루트의 cli/teamcook.mjs — 사용자가 이 파일을 GitHub에서 직접 받아 쓰므로 반드시 다시 빌드해 커밋
├─ store/                  # zustand + localStorage
├─ components/             # 공용 부품 (RouteInfo, RecipeOverview, FlowCanvas 등)
│  └─ ui/                  # shadcn/ui 컴포넌트 (npx shadcn@latest add <이름>)
└─ pages/                  # Gallery, RecipeEditor, MyPlans, SharedRecipe, HowToRun
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
- 공유 링크는 하위 호환을 지킨다 (`schemaVersion` 필수, 옛 버전 읽기 코드 유지).
- 레시피의 조리법은 `recipe.collaboration`을 직접 읽지 말고 `collaborationOf(recipe)`로 읽는다 (없으면 서브에이전트).
- 디자인은 "레시피 카드" 방향이다 (`HANDOFF.md`의 '디자인 방향'). 색·모서리·글꼴은 `src/index.css`에서만 고친다. 포인트 색은 토마토 빨강 하나, 보라색은 쓰지 않는다. 움직임은 절제한다(랜딩페이지식 화려한 효과 금지). 확인 날짜는 강조하지 않는다.
- 단계가 끝날 때마다 `HANDOFF.md`를 갱신한다.

## 자주 쓰는 명령

```bash
npm run dev        # 개발 서버 (http://localhost:5173)
npm test           # 단위 테스트 (Vitest)
npm run typecheck  # 타입 검사
npm run build      # 배포용 빌드 (dist/)
npm run build:cli  # 설치 명령 묶음 (cli/teamcook.mjs). src/cli나 변환기를 고치면 다시 빌드해서 함께 커밋
```

> Windows 주의: `npm test`는 `scripts/vitest.mjs`를 거쳐 실행한다. 드라이브 문자가 소문자(`c:\...`)인 터미널에서 Vitest 5가 실패하는 문제를 피하기 위해서다. `npx vitest`를 직접 실행하지 말 것.

## 현재 단계

(2026-11-16 기준) 0~5단계 완료(배포: https://teamcook-eta.vercel.app/, 저장소: fun5307/teamcook). 6·7단계 중 계정·API 키 없이 가능한 것(Antigravity·Grok 어댑터, 구독 최적화, 검색, Codex 연결 다리, 설치 명령)도 완료. 남은 것과 이유는 `HANDOFF.md`의 '6·7단계 현황'. 조리법(협업 방식)과 확인 날짜 표시도 추가 완료(`BRIEF_collaboration-styles.md`, `HANDOFF.md`의 '조리법 현황'). 에이전트 팀이 실제 Claude Code에서 시작되는지는 사용자 확인 대기.
