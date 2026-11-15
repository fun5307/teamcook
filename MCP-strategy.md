# 멀티 에이전트 협업 시각화 서비스 — 작업 전략

Nov 16, 2026 · @승우

## 한 줄 요약과 문제 정의

**한 줄 요약:** GPT(Codex)·Claude·Gemini·Grok 에이전트로 이뤄진 **AI 팀 레시피**를 설계하고, 내 플랜에 맞춰 실행 경로를 정하고, 링크 하나로 공유하는 웹사이트. 만든 레시피는 T3 Code, 1Code, 터미널 어디서든 그대로 돌아간다.

**핵심 원칙:** 실행은 남에게, 팀 설계와 레시피는 우리가. 팀 설계는 하나로, 실행 경로는 내가 가진 것에 맞춰 자동으로 정한다. 에이전트 실행·세션 관리는 Codex CLI·Claude Code와 T3 Code·1Code 같은 기존 도구에 맡기고 경쟁하지 않는다. 결과물은 웹사이트이고, Fable을 쓸 수 있는 11/16 하루 안에 MVP 배포까지 끝낸다.

지금 겪는 불편은 네 가지다.

1. **역할이 파일 속에 숨어 있다.** Codex는 `.codex/agents/*.toml`, Claude Code는 `.claude/agents/*.md`에 역할을 둔다. 위치도 형식도 다르다.
2. **협업 과정이 안 보인다.** 누가 누구에게 무엇을 넘겼는지가 터미널 로그로만 흘러간다.
3. **두 회사 모델을 섞는 법이 어렵다.** Claude가 Codex를 부르려면 MCP 서버 설정 같은 JSON 작업이 필요하다.
4. **어떤 도구나 기법을 써야 할지 판단 기준이 없다.** 선택지는 많은데 초보자용 안내가 없다.
5. **내 플랜으로 무엇을 쓸 수 있는지 모른다.** Claude 무료 플랜으로는 Claude Code를 쓸 수 없지만, ChatGPT 무료 계정으로는 Codex를 제한적으로 쓸 수 있다. 이런 차이가 회사마다 다르고 자주 바뀐다.

## 기존 도구 지형과 빈틈

비슷한 도구는 많지만, 대부분 개발자가 세션 여러 개를 동시에 돌리는 데 초점이 있다. 초보자가 역할을 설계하고 협업 과정을 이해하도록 돕는 도구는 비어 있다.

| 분류 | 대표 예 | 하는 일 | 초보자 관점의 한계 |
| --- | --- | --- | --- |
| Codex 서브에이전트 (공식) | [Codex Subagents](https://developers.openai.com/codex/subagents) | `.codex/agents/` 또는 `~/.codex/agents/`에 에이전트당 TOML 파일 1개. `[agents]`에서 동시 실행 수(`max_threads`), 깊이(`max_depth`) 설정 | 파일을 직접 열어 고쳐야 함 |
| Claude Code 서브에이전트 (공식) | [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents) | `.claude/agents/`에 YAML 머리말이 붙은 Markdown 파일. `name`, `description` 필수, `tools`·`model` 등 선택 | 현재 `/agents` 명령은 파일을 직접 고치라고 안내만 함. Codex와 형식이 다름 |
| 두 모델 연결 | [codex-in-claude](https://pypi.org/project/codex-in-claude/), [claude-codex-review](https://github.com/goharanwar/claude-codex-review) | Codex CLI를 MCP 서버로 띄워 Claude가 검토나 작업을 맡김 | 설치와 JSON 설정을 터미널에서 해야 함 |
| 멀티 에이전트 GUI | [1Code](https://github.com/21st-dev/1code), [T3 Code](https://betterstack.com/community/guides/ai/t3-code/), CloudCLI, Claude Squad, [AgentsRoom](https://agentsroom.dev/claude-code-subagents) | Claude Code와 Codex 세션을 한 창에서 병렬 실행하고 git worktree로 분리 | 개발자용. 역할 설계, 협업 흐름 설명, 팁은 거의 없음 |
| 비주얼 에이전트 빌더 | Flowise, Langflow, n8n, Dify | 노드를 끌어다 API 기반 LLM 워크플로를 그림 | Codex·Claude Code 같은 코딩 에이전트 설정과 무관. 복잡해지면 디버깅이 어려움 |

**빈틈, 즉 우리의 차별점은 세 가지다.**

- **팀 레시피:** 역할 카드, 넘겨주기 흐름, 실행 설정을 하나로 묶어 링크로 공유하고, 가져와서 고쳐 쓴다.
- **“필요한 플랜” 배지와 필터:** 레시피마다 “ChatGPT 무료만으로 가능”, “Claude Pro 필요” 같은 배지를 자동으로 붙이고, “내 플랜으로 되는 레시피만 보기”를 제공한다.
- **실행 경로 사다리(구독 최적화):** 카드마다 내 플랜으로 쓸 수 있는 가장 좋은 경로를 고르고, 막힌 곳에는 🔒와 대안을 보여 준다.
- **어디서든 실행:** 내보낸 파일은 Codex·Claude Code의 표준 형식이라 T3 Code·1Code·터미널에서 그대로 적용된다.
- **한국어·꿀팁 내장:** 역할별 팁과 경고를 쉬운 한국어로 화면 안에서 준다.

### 포지션: 실행은 남에게, 팀 설계는 우리가

T3 Code와 1Code는 ‘작업마다 스레드를 열고 에이전트를 돌리는 관제탑’이다. T3 Code는 Claude Code, Codex, Cursor, Grok, OpenCode, Antigravity를 한 화면에서 다루고, 2026년 11월 초 GitHub 스타가 약 45,000개다([Decodo](https://decodo.com/blog/t3-code)). `npx t3@latest`로 로컬 실행까지 제공해, 실행 영역에서 정면 경쟁은 어렵다.

두 도구는 에이전트를 나란히 돌리고 결과를 비교하는 데 강하지만, 역할을 나눠 협업하는 팀 설계는 중심이 아니다. 또 실제 CLI를 그대로 실행하므로([Flavio Copes](https://flaviocopes.com/t3-code)), 우리가 만든 설정 파일은 그 안에서도 적용된다. 그래서 경쟁 대신 **그 위에 얹히는 레시피 레이어**가 된다. 경쟁자의 사용자가 곧 우리 사용자다.

리스크는 T3 Code가 역할 설계 기능을 추가하는 것이다. 가장 강한 방어는 레시피 데이터와 커뮤니티를 빨리 쌓는 것이다. 기능은 따라 할 수 있어도 쌓인 레시피는 따라 하기 어렵다.

## 타깃 사용자와 핵심 가치

첫 사용자는 나 같은 사람이다. AI 코딩 도구를 써 봤고 멀티 에이전트도 돌려 봤지만, 설정 파일과 터미널이 부담스럽고 모든 AI를 결제하지는 않는다. 다만 초보자 전용 도구는 아니다. 여러 AI를 섞어 쓰는 개발자에게도 형식 통일과 실행 경로 안내로 실제 쓸모가 있어야 한다. 목표는 문턱을 낮추는 것이다.

화면에서 ‘보이게’ 할 것은 세 가지로 좁힌다.

| 보여줄 것 | 사용자의 질문 | 화면 형태 |
| --- | --- | --- |
| 역할 | “우리 팀에 누가 있고, 각자 무슨 일을 하지?” | 에이전트 카드 (이름, 모델, 한 줄 역할, 권한) |
| 실행 경로 | “내 플랜으로 이 역할을 어떻게 돌리지?” | 카드의 경로 배지(①\~④)와 🔒 대안 문장 |
| 흐름 | “누가 누구에게 무엇을 넘기지?” | 카드를 잇는 화살표 순서도 |
| 결과 | “실제로 어떻게 돌았고, 무엇이 문제였지?” | 실행 기록 타임라인 + 팁 |

성공 기준은 하나로 잡는다: **개발 초보자가 10분 안에 자기 플랜에 맞는 ‘작성자 + 교차 검토자’ 팀을 만들어 실제로 돌릴 수 있는가.**

## 핵심 기능: MVP / 다음 / 나중

오늘 만드는 MVP는 에이전트를 **직접 실행하지 않는다.** 설계하고, 내 플랜에 맞는 실행 경로를 보여 주고, 파일로 내보내는 데까지 한다. 실행은 사용자 PC의 Codex·Claude Code가 맡고, 실행을 편하게 해 줄 로컬 동반 프로그램은 내일 이후에 붙인다.

| 기능 | 하는 일 | 언제 |
| --- | --- | --- |
| 변환기 | 카드 ↔ `.toml`·`.md` 왕복 변환 | 11/16 오늘 |
| 실행 경로 해석기 | 카드마다 경로 ①\~④를 자동으로 고르고 🔒와 대안을 표시. 무거운 역할은 유료, 가벼운 역할은 무료 한도에 배치 | 11/16 오늘 |
| 필요한 플랜 배지 | 레시피를 돌리는 데 필요한 최소 플랜 조합 계산 | 11/16 오늘 |
| 내 AI 현황 | 제공사별 플랜과 API 키 보유 여부 체크 (키 값은 받지 않음) | 11/16 오늘 |
| 레시피 편집기 + zip 내보내기 | 카드 편집, 경로 배지, 설정 파일과 `RECIPE.md`를 zip으로 | 11/16 오늘 |
| 레시피 공유 링크 | 서버 없이 URL에 레시피를 담아 공유, 열면 “당신 플랜으로 돌리면” 바로 표시 | 11/16 오늘 |
| 기본 레시피 3종 + 갤러리 필터 | “내 플랜으로 되는 레시피만 보기” | 11/16 오늘 |
| 실행 안내 페이지 | 터미널·T3 Code·1Code에서 레시피 쓰는 법 | 11/16 오늘 |
| 협업 흐름 캔버스, 꿀팁 패널 | 화살표로 넘겨주기 표시, 카드별 팁·경고 | 오늘, 시간이 남으면 |
| 레시피 허브 | 서버 저장 갤러리, 검색, 가져다 쓴 횟수, 포크 | 내일 이후 |
| 구독 최적화 고도화 | 내 플랜 조합으로 한도를 가장 오래 쓰는 역할 배치 제안 | 내일 이후 |
| Gemini·Grok 어댑터 | 설정 형식을 조사한 뒤 변환기에 추가 | 내일 이후 |
| 협업 리플레이 | 두 AI가 주고받은 과정을 재생하는 공유 링크 | 그 이후 |
| 로컬 동반 프로그램 | T3 Code와 겹쳐 우선순위 낮음. 필요하면 레시피 설치 명령 정도만 | 그 이후 |

### 실행 경로 사다리

유료 AI가 하나라도 있으면 그 구독으로 열리는 기능(예: Codex, Claude Code)을 최대한 활용한다. 해석기는 카드마다 아래 순서로, 위에서부터 쓸 수 있는 경로를 찾는다.

| 순위 | 경로 | 설명 |
| --- | --- | --- |
| ① | 구독 로그인 CLI | Codex, Claude Code, Grok Build 등. 유료 사용자의 기본 경로 |
| ② | API 키 (종량제) | 쓴 만큼 결제. 신규 가입 무료 크레딧 포함 |
| ③ | 무료 티어 | ChatGPT Free의 Codex 한도, Gemini API 무료 티어 등 |
| ④ | 수동 (마지막 대안) | 무료 웹 채팅에 프롬프트 복사·붙여넣기. 다른 경로가 전혀 없을 때만 |

예를 들어 검토자 카드가 Claude Code로 설정돼 있는데 사용자가 Claude Free라면, 화면에 “🔒 Claude Code는 Pro부터 → 대신 ChatGPT 무료 한도의 Codex로 교차 검토할 수 있어요”라고 보여 준다.

**제공사별 현황 (2026-11-16 조사, 구현 직전 공식 문서로 재확인)**

| 제공사 | 무료로 되는 것 | 유료로 열리는 것 |
| --- | --- | --- |
| OpenAI | ChatGPT Free 계정으로 Codex 제한적 사용, 한시적 제공이라는 보도 있음 ([InventiveHQ](https://inventivehq.com/blog/codex-subscription-options-guide)) | Go·Plus·Pro로 한도 증가 |
| Anthropic | Claude Code 불가, 콘솔 신규 계정에 약 5달러 API 크레딧 ([Morph](https://www.morphllm.com/claude-code-subscription)) | Pro 이상에서 Claude Code |
| Google | 개인 무료 로그인 Gemini CLI는 2026-06-18 종료 후 Antigravity CLI로 이전(한도 작음). Gemini API 무료 티어는 유지 ([Tembo](https://www.tembo.io/blog/gemini-cli-pricing)) | 유료 플랜·API 결제 |
| xAI | 무료 grok.com으로는 Grok Build 불가, 신규 API 계정에 25달러 크레딧 ([Amplifying](https://amplifying.ai/coding-agents/grok-build)) | SuperGrok, X Premium+에서 Grok Build |

이 정보는 코드에 넣지 않고 `providers.json` 하나에 모으며, 화면에 확인 날짜를 함께 표시한다. 무료 웹 계정을 대신 조종하거나 화면을 긁어 오는 자동화는 약관 위반이라 하지 않는다.

### 꿀팁 패널에 처음 넣을 내용 (조사 기반)

- **쓰는 모델과 검토하는 모델을 다르게:** 같은 모델이 자기 코드를 검토하면 자기 패턴을 닮아 놓치기 쉽다. 다른 회사 모델에게 검토를 맡기는 교차 검토가 흔한 패턴이다 ([MindStudio](https://www.mindstudio.ai/blog/openai-codex-plugin-claude-code-cross-provider-review)).
- **검토자는 읽기 전용:** 검토 역할에는 파일 수정 권한을 주지 않는다. Codex는 에이전트별로 샌드박스를 읽기 전용으로, Claude는 `tools` 목록으로 제한할 수 있다.
- **역할 설명(description)을 구체적으로:** Claude는 이 설명을 보고 언제 맡길지 정한다. “코드 검토”보다 “변경된 파일의 보안·버그를 검토할 때 사용”가 낫다.
- **넘겨줄 정보를 명시:** 서브에이전트는 따로 떨어진 대화창에서 일한다. 부모가 알려주지 않은 맥락은 모른다.
- **동시 실행 수는 작게 시작:** 에이전트가 늘수록 토큰 소비도 늘어난다. 2\~3개로 시작해 효과를 보고 늘린다.
- **검토 결과는 ‘주장’으로 다루기:** 다른 모델의 지적도 틀릴 수 있다. 작성자가 검증한 뒤 반영한다.

## 기술 스택과 구조

웹사이트 하나로 시작하고, 로그인·데이터베이스는 처음엔 쓰지 않는다. 코드는 직접 치기보다 Claude Code나 Codex에게 이 문서를 주고 만들게 하는 것이 기본 작업 방식이다. 이 서비스를 만드는 과정 자체가 첫 번째 멀티 에이전트 실험이 된다.

| 영역 | 추천 | 이유 |
| --- | --- | --- |
| 화면 | React + Vite + TypeScript | AI 코딩 도구가 가장 잘 다루는 조합, 예제가 가장 많음 |
| 디자인 | Tailwind CSS + shadcn/ui | 버튼·폼·카드를 가져다 쓰면 됨 |
| 흐름 캔버스 | React Flow | 노드와 화살표 편집기를 바로 제공 |
| 파일 변환 | `smol-toml`(TOML), `yaml`(머리말), `jszip` | 카드 데이터를 두 형식으로 읽고 쓰고 zip으로 묶기 |
| 요금제 데이터 | `providers.json` | 무료·유료 범위를 한 곳에 모아 바뀌면 여기만 고침 |
| 상태 저장 | localStorage (`zustand` + persist) | 서버·DB 없이 시작 |
| 테스트 | Vitest | 변환기와 경로 해석기를 검증 |
| 배포 | Vercel | GitHub에 올리면 자동으로 링크가 생김, 무료 요금제로 충분 |
| 로컬 동반 프로그램 (내일 이후) | Node.js CLI, `npx`로 실행 | 웹이 못 하는 내 PC 파일 쓰기와 CLI 감지를 맡음 |

핵심 설계 원칙은 **카드 데이터 한 가지를 중심에 두는 것**이다. 폼, 캔버스, 팁 패널은 모두 이 데이터를 읽고 쓴다. Codex·Claude 형식 변환은 파일 하나(`converters/`)에 모아, 도구의 설정 형식이 바뀌어도 그 파일만 고치면 되게 한다.

&#91;embedded content: 서비스 구조 · MVP는 실선, 다음 단계는 점선\]

오늘은 실선 부분만 만든다. 웹사이트는 파일과 실행 경로 안내를 만들 뿐이고, 실제 실행은 내 PC의 Codex CLI와 Claude Code가 맡는다. 점선은 내일 이후에 붙인다.

## 로드맵: 11/16 하루 + 그 이후

Fable을 쓸 수 있는 건 11/16 하루뿐이다. 그래서 오늘 안에 **배포된 MVP 웹사이트와 인계 문서**까지 끝낸다. 가장 어려운 두뇌(변환기, 실행 경로 해석기)를 먼저 만들고, 화면과 배포는 그 뒤에 한다.

&#91;embedded content: 단계별 로드맵 · 4단계, 관문 3개\]

시간은 작업 예산이며 식사·휴식은 빼고 계산했다. 늦어지면 캔버스 → 꿀팁 패널 → 끌어다 놓기 → 디자인 다듬기 순으로 덜어낸다. 변환기·해석기 테스트, 30분마다 커밋, `HANDOFF.md`는 덜어내지 않는다. 자세한 일정표는 `PROJECT_BRIEF.md` 7장에 있다.

## 리스크와 대응

가장 큰 리스크는 기술이 아니라 시간과 범위, 그리고 경쟁 도구와의 위치다. Fable을 쓸 수 있는 날은 하루뿐이고, 실행 기능까지 욕심내면 오늘 안에 끝내기 어렵다.

| 리스크 | 왜 문제인가 | 대응 |
| --- | --- | --- |
| 하루 안에 못 끝냄 | Fable은 11/16에만 쓸 수 있고, 사용량 한도로 세션이 끊길 수도 있음 | 두뇌 먼저 만들기, 축소 순서, 30분마다 커밋·push, 단계마다 `HANDOFF.md` 갱신, 22시 인계 시작 |
| 범위 과잉 | 실시간 실행·모니터링은 로컬 프로세스 제어가 필요해 난이도가 크게 오름 | 오늘은 설계·경로 안내·내보내기만. 로컬 동반 프로그램은 내일 이후 |
| 요금제·무료 범위 변화 | 개인 무료 Gemini CLI가 2026-06-18에 종료된 것처럼 갑자기 바뀜 | `providers.json`에만 두고, 화면에 확인 날짜·공식 링크 표시, 주기적 갱신을 운영 업무로 |
| 도구 설정 형식의 변화 | 두 도구 모두 빠르게 바뀜. Claude Code의 `/agents` 화면도 버전에 따라 달라짐 | 변환 코드를 `converters/` 한 곳에 모으고, 구현 직전 공식 문서 재확인 |
| 약관 위반 | 무료 웹 계정 자동 조종·화면 긁기는 계정 정지로 이어질 수 있음 | 하지 않음. 수동 복사는 마지막 대안으로만 |
| API 키 유출 | 브라우저 코드에 키를 넣으면 누구나 볼 수 있음 | 키 값은 받지 않고 ‘보유 여부’만 체크. 이후 기능도 서버 환경 변수나 로컬 프로그램에서만 |
| 경쟁 도구 | 1Code, T3 Code 등 비슷한 GUI가 이미 많음 | 실행 속도 경쟁이 아니라 ‘팀 설계 + 내 플랜에 맞춘 실행 경로 + 시각화’에 집중 |

열린 질문: Codex와 Claude Code의 로컬 세션 기록 파일 구조는 실행 기록 뷰어를 만들기 전에 실제 파일로 확인해야 한다.

## 오늘 바로 할 일

오늘 할 일은 지시서 `PROJECT_BRIEF.md`의 일정표를 따른다. 사람이 챙길 일은 아래와 같다.

- [ ] 시작 전: 빈 폴더에 `PROJECT_BRIEF.md`를 넣고, 예전 `.codex` TOML 1\~2개와 결제 중인 플랜 목록 준비
- [ ] 시작 전: 오늘 작업 가능한 시간과 쉬는 시간 정하기
- [ ] Claude Code를 Fable로 실행하고 “PROJECT\_BRIEF.md를 끝까지 읽고 3장부터 진행해 줘” 보내기
- [ ] 오전: 0\~1단계 보고를 받고 확인 (변환기 테스트 통과)
- [ ] 오후: 내보낸 zip을 테스트 프로젝트에 풀고 Codex·Claude에서 에이전트 인식 직접 확인
- [ ] 저녁: GitHub 계정 연결과 Vercel 배포 승인
- [ ] 22시: 인계 시작, `HANDOFF.md` 확인
- [ ] 자기 전: 내일 이어서 쓸 모델 정하기

## 출처

- [Codex — Subagents (OpenAI 공식 문서)](https://developers.openai.com/codex/subagents)
- [Codex — Advanced Configuration](https://developers.openai.com/codex/config-advanced)
- [Claude Code — Subagents (Anthropic 공식 문서)](https://code.claude.com/docs/en/sub-agents)
- [Codex 서브에이전트 TOML 정리 (issoh.co.jp)](https://www.issoh.co.jp/tech/details/11463/)
- [Codex CLI 요금제와 무료 플랜 (InventiveHQ)](https://inventivehq.com/blog/codex-subscription-options-guide)
- [Claude Code 구독 필요 플랜 (Morph)](https://www.morphllm.com/claude-code-subscription)
- [Gemini CLI 요금과 무료 로그인 종료 (Tembo)](https://www.tembo.io/blog/gemini-cli-pricing)
- [Grok Build 접근 조건과 API 크레딧 (Amplifying)](https://amplifying.ai/coding-agents/grok-build)
- [1Code (GitHub)](https://github.com/21st-dev/1code)
- [1Code 소개 (DEV Community)](https://dev.to/_46ea277e677b888e0cd13/1code-managing-multiple-ai-coding-agents-without-terminal-hell-14o4)
- [T3 Code (Better Stack)](https://betterstack.com/community/guides/ai/t3-code/)
- [AgentsRoom](https://agentsroom.dev/claude-code-subagents)
- [codex-in-claude (PyPI)](https://pypi.org/project/codex-in-claude/)
- [claude-codex-review (GitHub)](https://github.com/goharanwar/claude-codex-review)
- [교차 검토 패턴 설명 (MindStudio)](https://www.mindstudio.ai/blog/openai-codex-plugin-claude-code-cross-provider-review)
- [비주얼 에이전트 빌더 비교: Langflow vs Flowise vs n8n (Blck Alpaca)](https://blckalpaca.at/en/knowledge-base/ai-agents/ai-agent-frameworks-comparison/langflow-vs-flowise-vs-n8n)
