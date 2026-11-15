# 프로젝트 지시서 — AI 팀 레시피 (가칭: agent-recipes)

> 작성일: 2026-11-16 · 이 문서는 AI 코딩 에이전트(Claude Code의 Fable 모델 등)가 처음부터 끝까지 읽고 바로 작업을 시작하도록 쓴 지시서다.
> 근거 문서: 「멀티 에이전트 협업 시각화 서비스 — 작업 전략」(claude.ai 문서)과 그 이후의 방향 결정.
>
> ⏰ **작업 가능 시간은 2026-11-16(KST) 하루뿐이다.** Fable은 오늘만 쓸 수 있다. 오늘 안에 **배포된 MVP 웹사이트 + 다음 모델이 이어받을 인계 문서**까지 끝내는 것이 목표다. 7장의 하루 일정표와 축소 순서를 반드시 따른다.
>
> 🎯 **최종 결과물은 웹사이트다.** 누구나 브라우저로 접속하는 웹앱(React, Vercel 배포)이다.
>
> 🧭 **포지션: "실행은 어디서든, 팀 설계와 레시피는 여기서."** 에이전트 실행·세션 관리 도구(T3 Code, 1Code)와 경쟁하지 않는다. 그 도구들과 터미널 어디에서나 그대로 쓸 수 있는 **AI 팀 레시피**를 설계하고, 내 플랜에 맞추고, 링크로 공유하는 곳을 만든다.

---

## 0. 사용법 (사람용, 30초)

1. 빈 폴더를 하나 만든다. 예: `agent-recipes`
2. 이 파일(`PROJECT_BRIEF.md`)을 그 폴더에 넣는다.
3. 그 폴더에서 Claude Code를 실행하고 모델을 Fable로 고른다.
4. 첫 메시지로 이렇게 보낸다.
   > `PROJECT_BRIEF.md를 끝까지 읽고, 3장 '시작 전 확인'부터 진행해 줘.`

---

## 1. 이 문서를 읽는 AI에게

### 1.1 너의 역할
너는 이 프로젝트의 **수석 개발자이자 선생님**이다. 사용자는 아이디어를 낸 사람이고, 앱·웹 개발 경력은 거의 없다. 대신 Codex(GPT)로 `.codex` TOML 서브에이전트를 직접 만들어 멀티 에이전트를 돌려 본 경험이 있다.

### 1.2 소통 규칙
- **한국어로**, 쉬운 말로 설명한다. 전문 용어는 처음 나올 때 한 줄로 풀어 준다.
- 각 단계가 끝나면 아래 형식으로 보고하고 **멈춰서 사용자 확인을 받는다.**
  ```
  ✅ N단계 완료 (예산 OO분 / 실제 OO분)
  - 한 일: (3줄 이내)
  - 직접 확인하는 법: (사용자가 따라 할 명령어/클릭 순서)
  - 다음 단계: (한 줄)
  계속할까요?
  ```
- 사용자가 직접 해야 하는 일(로그인, 설치 승인, 실제 CLI 실행 확인, 배포 승인)은 **번호 매긴 단계로** 정확히 알려 준다.
- 모르는 것은 추측하지 말고 묻거나 공식 문서를 확인한다.

### 1.3 작업 원칙
- **작게, 자주 커밋.** 기능 하나 = 커밋 하나. 커밋 메시지는 한국어로 써도 된다.
- **테스트 먼저 생각하기.** 변환기, 경로 해석기, 공유 링크 인코딩은 반드시 단위 테스트를 붙인다.
- **사실은 공식 문서로 검증.** 이 문서의 요금제·설정 형식 정보는 2026-11-16 기준이며 빠르게 바뀐다. 해당 코드를 짜기 직전에 공식 문서를 다시 확인하고, 확인한 날짜와 URL을 데이터에 기록한다.
- **보안:** API 키를 받거나 저장하지 않는다. `~/.codex/auth.json`, `~/.claude` 안의 인증 파일은 읽지도 쓰지도 않는다.
- **전역 설치나 시스템 설정 변경**은 실행 전에 사용자에게 묻는다.
- 막히면 30분 넘게 혼자 돌지 말고, 상황과 선택지를 정리해 사용자에게 묻는다.

### 1.4 시간 규칙 (오늘 하루뿐)
- 단계를 시작할 때와 끝낼 때 `date` 명령으로 현재 시각(KST)을 확인하고, 보고에 **예산 대비 경과 시간**을 적는다.
- 단계가 예산을 30분 넘게 초과하면, 7장의 **축소 순서**에 따라 무엇을 덜어낼지 사용자에게 제안하고 결정을 받는다.
- **커밋은 최소 30분마다** 한 번씩 한다. 사용량 한도로 세션이 갑자기 끊겨도 작업이 남아 있게 하기 위해서다. GitHub 저장소가 생긴 뒤에는 커밋할 때마다 push도 한다.
- `HANDOFF.md`는 마지막에 몰아서 쓰지 않는다. **단계가 끝날 때마다 갱신**한다.
- **22:00(KST)이 되면 하던 일을 멈추고** 인계 단계로 넘어간다.
- 완벽함보다 '오늘 끝나는 것'을 우선한다. 다듬기는 내일 이후 다른 모델의 몫이다.

---

## 2. 제품 정의

### 2.1 한 줄 요약
GPT(Codex)·Claude·Gemini·Grok 에이전트로 이뤄진 **AI 팀 레시피**를 설계하고, 내 플랜에 맞춰 실행 경로를 정하고, **링크 하나로 공유**하는 웹사이트. 만든 레시피는 T3 Code, 1Code, 터미널 어디서든 그대로 돌아간다.

### 2.2 핵심 원칙 (모든 결정의 기준)
1. **팀 설계는 하나로, 실행 경로는 내가 가진 것에 맞춰 자동으로.**
2. **유료 AI가 하나라도 있으면** 그 구독으로 열리는 기능(예: Codex, Claude Code)을 최대한 활용한다. **무료 버전만 써도** 어느 정도는 쓸 수 있게 한다.
3. **실행은 남에게, 팀 설계와 레시피는 우리가.** 실행·세션 관리 기능은 만들지 않는다.
4. 초보자 전용이 아니다. **개발자에게도 쓸모 있으면서 문턱을 낮추는** 도구다. 한국어 우선.

### 2.3 해결하는 문제
1. 에이전트 역할이 숨은 설정 파일에 흩어져 있다. Codex는 `.codex/agents/*.toml`, Claude Code는 `.claude/agents/*.md`로 위치도 형식도 다르다.
2. 여러 회사 AI가 **역할을 나눠 협업하는 팀**을 짜는 방법을 알기 어렵다. 기존 도구는 에이전트를 나란히 돌리고 결과를 비교하는 데 강하지만, 협업 팀 설계는 중심이 아니다.
3. 내가 결제한 것과 안 한 것에 따라 "지금 무엇을 쓸 수 있는지"를 알기 어렵다.
4. 잘 동작하는 팀 구성을 남과 나누거나 가져다 쓸 방법이 없다.

### 2.4 차별점
- **팀 레시피:** 역할 카드 + 넘겨주기 흐름 + 실행 설정을 하나의 '레시피'로 묶어 링크로 공유하고, 가져와서 고쳐 쓴다.
- **"필요한 플랜" 배지와 필터:** 레시피마다 "ChatGPT 무료만으로 가능", "Claude Pro 필요" 같은 배지를 자동으로 붙인다. "내 플랜으로 되는 레시피만 보기"가 가능하다.
- **실행 경로 사다리(구독 최적화):** 카드마다 내 플랜으로 쓸 수 있는 가장 좋은 경로를 고르고, 막힌 곳에는 🔒와 대안을 보여 준다.
- **어디서든 실행:** 내보낸 설정 파일은 Codex·Claude Code의 표준 형식이라 T3 Code, 1Code, 터미널에서 그대로 적용된다.
- **한국어·꿀팁 내장:** 역할별 체크리스트와 경고를 화면 안에서 쉬운 한국어로 준다.

### 2.5 하지 않을 것 (비목표)
- 에이전트 실행·세션·스레드 관리 기능을 만들지 않는다. **T3 Code, 1Code와 경쟁하지 않는다.**
- 자체 LLM 오케스트레이션 엔진을 만들지 않는다.
- 무료 웹 채팅 계정에 대신 로그인하거나 웹 화면을 긁어 오는 자동화는 하지 않는다. **약관 위반이라 계정이 정지될 수 있다.**
- 복사·붙여넣기 '릴레이 모드'를 중심 기능으로 만들지 않는다. 다른 경로가 전혀 없을 때 보여 주는 마지막 대안일 뿐이다.
- 오늘 MVP에서는 회원가입, 로그인, 서버 DB를 만들지 않는다. 공유는 URL만으로 한다.

---

## 3. 시작 전 확인 (AI가 사용자에게 먼저 물을 것)

작업을 시작하기 전에 아래를 **한 번에** 물어본다.

1. 사용하는 OS는? (Windows / macOS / Linux)
2. 지금 결제 중인 AI 플랜은? (예: ChatGPT Plus, Claude Pro, 없음 등) → 4장 실행 경로 테스트의 첫 사례가 된다.
3. 설치된 도구 확인: 아래 명령의 결과를 함께 확인한다. 없는 것은 설치 방법을 안내한다.
   ```bash
   node -v      # 20 이상 권장
   git --version
   codex --version
   claude --version
   ```
4. 예전에 만든 `.codex` 폴더의 TOML 파일이 있으면, 1~2개를 이 프로젝트의 `samples/codex/`에 복사해 달라고 요청한다. 변환기 테스트용 실제 데이터로 쓴다.
5. 서비스 이름이 정해졌는지. 정해지지 않았으면 가칭 `agent-recipes`로 진행한다.
6. 오늘 작업을 몇 시까지 할 수 있는지, 중간에 쉬는 시간은 언제인지. 답을 받으면 7장 일정표를 실제 시각으로 바꿔 보여 주고 시작한다.

---

## 4. 핵심 개념과 데이터 구조

### 4.1 데이터 모델 (TypeScript 초안)

```ts
type ProviderId = 'openai' | 'anthropic' | 'google' | 'xai';

// 실행 엔진: 실제로 에이전트를 돌리는 도구
type EngineId = 'codex-cli' | 'claude-code' | 'antigravity-cli' | 'grok-build' | 'api' | 'manual';

// 에이전트 카드
interface AgentCard {
  id: string;
  name: string;               // 영문 소문자·하이픈 (파일 이름이 됨)
  displayName: string;        // 화면 표시용 (한글 가능)
  role: string;               // 한 줄 역할 설명 → description
  instructions: string;       // 지시문 → Codex developer_instructions / Claude 본문
  preferredEngine: EngineId;
  model?: string;
  permission: 'read-only' | 'edit' | 'full';
  tools?: string[];           // Claude용 (선택)
  tags?: string[];            // 'writer' | 'reviewer' | 'researcher' 등
  extra?: Record<string, unknown>; // 형식에만 있는 필드 보존용
}

// 넘겨주기 (캔버스의 화살표)
interface Handoff {
  id: string;
  from: string;   // AgentCard.id
  to: string;
  label?: string; // 예: '초안 전달', '검토 결과'
}

// 레시피 = 공유 가능한 팀 (서비스의 중심 데이터)
interface Recipe {
  schemaVersion: 1;           // 공유 링크 호환성을 위해 반드시 포함
  id: string;
  title: string;              // 예: 'Claude 작성 + Codex 교차 검토'
  summary: string;            // 무엇을 하는 레시피인지 한두 줄
  useCase: string;            // 예: '기능 구현 후 검토', '자료 조사'
  author?: string;            // 선택: 닉네임
  cards: AgentCard[];
  handoffs: Handoff[];
  settings: { maxThreads: number; maxDepth: number }; // Codex [agents]와 대응
  howToRun?: string;          // 실행 팁 (예: 첫 프롬프트 예시)
}

// 사용자가 체크하는 '내 AI 현황'
interface UserPlans {
  openai: 'none' | 'free' | 'go' | 'plus' | 'pro';
  anthropic: 'none' | 'free' | 'pro' | 'max';
  google: 'none' | 'free' | 'paid';
  xai: 'none' | 'free' | 'supergrok';
  apiKeys: Partial<Record<ProviderId, boolean>>; // '보유 여부'만. 키 값은 절대 받지 않음
}
```

### 4.2 실행 경로 사다리

카드마다 아래 순서로 **위에서부터** 쓸 수 있는 경로를 찾는다.

| 순위 | 경로 | 설명 |
| --- | --- | --- |
| 1 | 구독 로그인 CLI | 구독 계정으로 로그인한 Codex, Claude Code, Grok Build 등. 유료 사용자의 기본 경로 |
| 2 | API 키 (종량제) | 쓴 만큼 결제. 신규 가입 무료 크레딧 포함 |
| 3 | 무료 티어 | ChatGPT Free의 Codex 한도, Gemini API 무료 티어 등 |
| 4 | 수동 (마지막 대안) | 무료 웹 채팅에 프롬프트 복사·붙여넣기. 다른 경로가 전혀 없을 때만 |

**해석기 (`src/lib/resolvePath.ts`):**
```ts
resolvePath(card: AgentCard, plans: UserPlans, providers: ProviderData): {
  path: 1 | 2 | 3 | 4;
  engine: EngineId;
  locked: boolean;
  lockReason?: string;        // 예: 'Claude Code는 Pro 이상 필요'
  alternative?: { engine: EngineId; path: 1|2|3|4; reason: string };
  notes: string[];            // 예: '무료 한도가 작아요', '한시적 제공일 수 있어요'
}

resolveRecipe(recipe: Recipe, plans: UserPlans, providers: ProviderData): {
  perCard: Record<string, ReturnType<typeof resolvePath>>;
  summary: string;            // 예: '5개 중 4개는 구독으로, 1개는 무료 한도로 실행돼요'
}
```

**대안 선택 규칙:**
- 같은 역할을 할 수 있는 다른 제공사 엔진 중, 사용자가 가장 높은 경로(숫자가 작은 쪽)로 쓸 수 있는 것을 고른다.
- 검토자 역할은 **작성자와 다른 제공사**를 우선한다(교차 검토).
- **구독 최적화 규칙:** 같은 경로라면 무거운 역할(`implementer`, `writer`)은 유료 구독에, 가벼운 역할(`researcher`, `reviewer`)은 무료 한도에 우선 배치한다.
- 모든 판단 근거 문장은 사용자에게 그대로 보여 준다.

### 4.3 "필요한 플랜" 배지 (`src/lib/requiredPlans.ts`)

레시피를 그대로(각 카드의 `preferredEngine`대로) 돌리는 데 필요한 **최소 플랜 조합**을 계산해 배지로 보여 준다.

```ts
requiredPlans(recipe: Recipe, providers: ProviderData): {
  badges: string[];       // 예: ['ChatGPT 무료로 가능'] 또는 ['Claude Pro 필요', 'ChatGPT 무료']
  allFree: boolean;       // 모든 카드가 무료 경로로 돌 수 있으면 true
}
fitsMyPlans(recipe: Recipe, plans: UserPlans, providers: ProviderData): 'full' | 'with-alternatives' | 'no';
```
- 갤러리 화면의 필터: **"내 플랜으로 되는 레시피만 보기"** (`fitsMyPlans !== 'no'`)

### 4.4 레시피 공유 링크 (`src/lib/share.ts`)

서버 없이 **URL 하나로** 레시피를 공유한다.

- 인코딩: `Recipe` → JSON → `lz-string`의 `compressToEncodedURIComponent` → `https://<도메인>/#r=<압축문자열>`
- 디코딩: 주소의 `#r=`를 읽어 복원 → `schemaVersion` 확인 → 화면에 "공유받은 레시피" 미리보기 → **'내 레시피로 가져오기'** 버튼
- 링크가 너무 길면(예: 4,000자 초과) 경고하고 지시문을 줄이라고 안내한다.
- 공유받은 레시피를 열면 **내 플랜 기준 실행 경로를 바로 계산해서** 보여 준다. ("이 레시피를 당신 플랜으로 돌리면…")
- 보안: 공유 데이터는 텍스트로만 렌더링한다(HTML 삽입 금지). 디코딩 실패 시 친절한 오류를 보여 준다.

### 4.5 제공사 데이터 (`src/data/providers.json`)

요금제 정보는 **코드에 하드코딩하지 않고** 이 JSON 하나에 모은다. 각 항목에 `lastVerified`(날짜)와 `sourceUrl`을 반드시 넣고, 화면에도 "2026-11-16 확인"처럼 표시한다.

**초기값 (2026-11-16 조사 기준, 구현 직전 공식 문서로 재확인 필수):**

| 제공사 | 엔진 | 무료로 되는 것 | 유료로 열리는 것 | 설정 파일 형식 | 비고 |
| --- | --- | --- | --- | --- | --- |
| OpenAI | Codex CLI | ChatGPT Free 계정으로 Codex 제한적 사용 (한도 작음, 한시적 제공이라는 보도 있음) | Go / Plus / Pro로 한도 증가 | `.codex/agents/*.toml` + `.codex/config.toml`의 `[agents]` | API 키 종량제도 가능 |
| Anthropic | Claude Code | 없음 (Free 플랜은 Claude Code 불가) | Pro 이상 | `.claude/agents/*.md` (YAML 머리말) | 콘솔 신규 계정에 약 5달러 API 크레딧 |
| Google | Antigravity CLI / Gemini API | Gemini API 무료 티어 (Google AI Studio). 개인 무료 로그인 Gemini CLI는 2026-06-18 종료, Antigravity CLI로 이전(무료 한도 작음) | 유료 플랜·API 결제 | **조사 필요** (MVP에서는 '준비 중') | |
| xAI | Grok Build | 무료 grok.com으로는 Grok Build 불가 | SuperGrok, X Premium+ | **조사 필요** (MVP에서는 '준비 중') | 신규 API 계정에 25달러 크레딧 |

참고 URL:
- Codex 서브에이전트: https://developers.openai.com/codex/subagents
- Codex 고급 설정: https://developers.openai.com/codex/config-advanced
- Claude Code 서브에이전트: https://code.claude.com/docs/en/sub-agents

---

## 5. 설정 파일 형식 (변환기 명세)

> ⚠️ 아래 키 이름은 조사 시점 기준이다. **1단계에서 변환기를 짜기 전에 공식 문서를 열어 필드 이름과 필수 여부를 다시 확인**하고, 다르면 이 문서를 고친 뒤 진행한다.

### 5.1 Codex 커스텀 에이전트 (`.codex/agents/<name>.toml`)
- 위치: 프로젝트용 `.codex/agents/`, 개인용 `~/.codex/agents/`
- 파일 하나 = 에이전트 하나
- 필수 필드(조사 기준): `name`, `description`, `developer_instructions`
- 에이전트별로 샌드박스를 읽기 전용으로 덮어쓸 수 있음 → `permission: 'read-only'`와 대응 (정확한 키 이름은 공식 문서로 확인)

```toml
name = "reviewer"
description = "변경된 파일의 버그와 보안 문제를 검토할 때 사용"
developer_instructions = """
너는 코드 검토자다. 파일을 수정하지 말고, 문제를 파일 경로·줄 번호와 함께 보고하라.
"""
```

프로젝트 설정 `.codex/config.toml`:
```toml
[agents]
max_threads = 3
max_depth = 1
```

### 5.2 Claude Code 서브에이전트 (`.claude/agents/<name>.md`)
- 위치: 프로젝트용 `.claude/agents/`, 개인용 `~/.claude/agents/`
- YAML 머리말 + 본문(본문 = 시스템 프롬프트)
- 필수: `name`, `description` / 선택: `tools`, `disallowedTools`, `model`, `permissionMode` 등

```markdown
---
name: reviewer
description: 변경된 파일의 버그와 보안 문제를 검토할 때 사용
tools: Read, Grep, Glob
---

너는 코드 검토자다. 파일을 수정하지 말고, 문제를 파일 경로·줄 번호와 함께 보고하라.
```

### 5.3 대응표 (AgentCard → 각 형식)

| AgentCard | Codex TOML | Claude MD |
| --- | --- | --- |
| `name` | `name` | `name` |
| `role` | `description` | `description` |
| `instructions` | `developer_instructions` | 본문 |
| `model` | `model` (선택) | `model` (선택) |
| `permission: 'read-only'` | 샌드박스 읽기 전용 | `tools`를 읽기 도구만으로 제한 |

변환기는 **내보내기와 불러오기 둘 다** 만든다. 형식에 없는 필드는 버리지 말고 `extra`에 보관했다가 다시 내보낼 때 살린다(왕복 손실 방지).

### 5.4 레시피 내보내기 묶음 (zip)
```
<recipe-name>/
├─ .codex/agents/*.toml
├─ .codex/config.toml
├─ .claude/agents/*.md
├─ recipe.json            # Recipe 원본 (다시 불러오기용)
└─ RECIPE.md              # 사람용: 레시피 설명, 필요한 플랜, 실행 방법(터미널·T3 Code·1Code)
```

---

## 6. 기술 스택과 폴더 구조

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 화면 | React + Vite + TypeScript | AI 코딩 도구가 가장 잘 다루고 예제가 많음 |
| 디자인 | Tailwind CSS + shadcn/ui | 버튼·폼·카드를 바로 가져다 씀 |
| 흐름 캔버스 | React Flow (`@xyflow/react`) | 노드·화살표 편집기를 바로 제공 (시간 남으면) |
| 파일 변환 | `smol-toml`, `yaml`, `jszip` | TOML·YAML 읽기·쓰기, zip 묶기 |
| 공유 링크 | `lz-string` | 레시피를 URL에 넣을 만큼 압축 |
| 상태 저장 | localStorage (`zustand` + persist) | 서버·DB 없이 시작 |
| 테스트 | Vitest | Vite와 바로 맞물림 |
| 배포 | Vercel | GitHub에 올리면 자동 배포 |

```
agent-recipes/
├─ PROJECT_BRIEF.md
├─ CLAUDE.md               # 0단계에서 생성: 요약 + 작업 규칙 + 현재 단계
├─ AGENTS.md               # 0단계에서 생성: CLAUDE.md와 같은 내용 (Codex용)
├─ HANDOFF.md              # 0단계에서 생성, 단계마다 갱신
├─ samples/
│  ├─ codex/
│  └─ claude/
├─ src/
│  ├─ types.ts
│  ├─ data/
│  │  ├─ providers.json
│  │  ├─ recipes.ts        # 9장 기본 레시피 3종
│  │  └─ tips.ts           # 10장 꿀팁
│  ├─ converters/          # 형식 변환은 전부 여기에만
│  │  ├─ codex.ts
│  │  ├─ claude.ts
│  │  └─ *.test.ts
│  ├─ lib/
│  │  ├─ resolvePath.ts    # 실행 경로 해석기
│  │  ├─ requiredPlans.ts  # 필요한 플랜 배지
│  │  ├─ share.ts          # 공유 링크
│  │  ├─ exportZip.ts
│  │  └─ *.test.ts
│  ├─ store/
│  └─ pages/ (또는 components/)
│     ├─ Gallery/          # 레시피 목록 + '내 플랜으로 되는 것만' 필터
│     ├─ RecipeEditor/     # 카드 편집 + 경로 배지
│     ├─ MyPlans/          # 내 AI 현황
│     ├─ SharedRecipe/     # 공유 링크로 들어온 레시피 미리보기
│     └─ HowToRun/         # 터미널·T3 Code·1Code에서 쓰는 법
```

**설계 원칙:** 모든 화면은 `Recipe` 데이터 하나를 읽고 쓴다. 제공사별 차이는 `converters/`와 `providers.json`에만 둔다.

---

## 7. 단계별 작업 절차

각 단계에는 **완료 기준(DoD)**이 있다. 기준을 다 채우기 전에는 다음 단계로 넘어가지 않는다. 단계가 끝날 때마다 1.2 형식으로 보고하고 멈춘다.

### 오늘(2026-11-16) 하루 일정표

오늘 안에 **0~5단계 + 인계**를 끝내는 것이 목표다. 시작 시각에 맞춰 예산을 실제 시각으로 바꿔 사용자에게 먼저 보여 준다.

| 순서 | 단계 | 예산 | 10:00 시작 시 예시 |
| --- | --- | --- | --- |
| 1 | 0단계 · 준비 | 45분 | 10:00–10:45 |
| 2 | 1단계 · 변환기 | 2시간 | 10:45–12:45 |
| 3 | 2단계 · 경로 해석기 + 필요한 플랜 배지 (로직) | 1.5시간 | 13:45–15:15 |
| 4 | 3단계 · 레시피 편집기 + 내 AI 현황 + 내보내기 (화면) | 2시간 | 15:15–17:15 |
| 5 | 4단계 · 공유 링크 + 기본 레시피 3종 + 갤러리 필터 | 1.5시간 | 17:15–18:45 |
| 6 | 5단계 · 실행 안내 페이지 + GitHub + Vercel 배포 | 1시간 | 19:45–20:45 |
| 7 | (시간 남으면) 흐름 캔버스, 꿀팁 패널 | ~1시간 | 20:45–21:45 |
| 8 | 인계 | 45분 | **늦어도 22:00 시작** |

> 12:45–13:45, 18:45–19:45는 식사·휴식 예시다. 사용자 일정에 맞춰 조정한다.
>
> 순서의 이유: 변환기·해석기·배지가 이 서비스의 두뇌다. 가장 어려운 생각 작업에 오늘의 Fable을 먼저 쓰고, 화면 다듬기는 내일 이후 다른 모델로도 할 수 있다.

**축소 순서 (늦어지면 위에서부터 덜어낸다)**
1. 흐름 캔버스 → 내일로
2. 꿀팁 패널 → 내일로 (팁은 카드 아래 짧은 문장 몇 개로 대체)
3. 파일 끌어다 놓기 불러오기 → '파일 선택' 버튼
4. 갤러리 필터 → 기본 레시피 3종 목록만
5. 디자인 다듬기 → shadcn 기본 모양 그대로

**절대 덜어내지 않는 것:** 변환기 왕복 테스트, 해석기·배지 테스트, 공유 링크(레시피의 핵심), 30분마다 커밋, GitHub push, `HANDOFF.md`. 배포가 늦어지면 최소한 GitHub에는 올린다.

---

### 0단계 · 프로젝트 준비 (45분)
1. 3장의 질문을 하고 답을 받는다. 일정표를 실제 시각으로 바꿔 보여 준다.
2. `git init` 후 Vite + React + TypeScript 프로젝트를 만든다.
3. Tailwind, shadcn/ui, Vitest를 설정한다.
4. 이 문서를 요약해 `CLAUDE.md`와 `AGENTS.md`를 만든다(같은 내용). 포지션, 핵심 원칙, 비목표, 폴더 구조, 작업 규칙, 현재 단계를 담는다.
5. 인계 항목을 제목으로 둔 빈 `HANDOFF.md`를 만든다.
6. 첫 커밋.

**DoD**
- [ ] `npm run dev`로 브라우저에 빈 페이지가 뜬다
- [ ] `npm test`가 실행된다(샘플 테스트 1개 통과)
- [ ] `CLAUDE.md`, `AGENTS.md`, `HANDOFF.md`가 있다

### 1단계 · 데이터 모델과 변환기 (2시간)
1. **공식 문서 재확인:** 5장의 Codex·Claude 필드를 공식 문서와 대조하고, 다르면 이 문서를 고친다. 확인 날짜를 `providers.json`에 기록한다.
2. `src/types.ts`에 4.1 모델을 만든다.
3. `converters/codex.ts`: `cardToCodexToml`, `codexTomlToCard`, `recipeToCodexConfig`
4. `converters/claude.ts`: `cardToClaudeMd`, `claudeMdToCard`
5. 테스트: 5장의 예시와 `samples/` 안의 실제 파일로 왕복 변환(내보내기 → 불러오기 → 같은 결과)을 검증한다.

**DoD**
- [ ] 왕복 변환 테스트가 Codex·Claude 모두 통과한다
- [ ] 사용자의 실제 TOML 샘플을 카드로 불러올 수 있다
- [ ] 형식에 없는 필드가 `extra`로 보존된다

### 2단계 · 실행 경로 해석기 + 필요한 플랜 배지 (1.5시간, 로직만)
1. `providers.json` 완성(4.5 표 기준, 재확인 후).
2. `resolvePath`, `resolveRecipe` 구현(4.2).
3. `requiredPlans`, `fitsMyPlans` 구현(4.3).

**DoD — 아래 4개 사용자 유형으로 테스트 통과**
- [ ] 전부 무료: Claude Code 카드는 🔒, Codex 무료 한도가 대안으로 제시됨
- [ ] ChatGPT Plus만: Codex 카드는 ①, Claude 카드는 Codex로 대안 제시
- [ ] Claude Pro만: Claude 카드는 ①, 검토자는 교차 검토용으로 Codex 무료 한도 제시
- [ ] 둘 다 유료: 모두 ①, 작성자와 검토자가 다른 제공사인지 확인
- [ ] 기본 레시피 3종에 배지가 올바르게 붙는다 (예: 'Claude 작성 + Codex 검토' → 'Claude Pro 필요', 'ChatGPT 무료')

### 3단계 · 레시피 편집기 + 내 AI 현황 + 내보내기 (2시간, 화면)
1. '내 AI 현황' 화면: 제공사별 플랜 선택, API 키 보유 여부 체크.
2. 레시피 편집기: 제목·요약 + 카드 목록 + 카드 편집 폼. 카드마다 경로 배지(①~④)와 🔒 대안 문장.
3. 상단 요약 한 줄: "내 플랜으로 이 레시피를 돌리면 …" + 필요한 플랜 배지.
4. 기존 `.toml`·`.md` 파일 불러오기('파일 선택' 버튼).
5. 'zip으로 내보내기': 5.4의 구조 그대로. `RECIPE.md`에 실행 방법(터미널·T3 Code·1Code)을 자동으로 적는다.
6. localStorage 자동 저장.

**DoD**
- [ ] 레시피를 만들고 새로고침해도 남아 있다
- [ ] '내 AI 현황'을 바꾸면 배지와 대안이 즉시 바뀐다
- [ ] zip을 테스트 프로젝트에 풀고, 사용자가 `codex`와 `claude`를 실행했을 때 에이전트가 인식된다. **AI는 확인 절차를 단계별로 안내한다.** (Claude Code는 "어떤 서브에이전트가 있어?"로, Codex는 해당 에이전트를 써 달라고 요청해 확인)

### 4단계 · 공유 링크 + 기본 레시피 + 갤러리 (1.5시간)
1. `share.ts` 구현과 테스트(인코딩 → 디코딩 왕복, 손상된 링크 처리, 길이 경고).
2. 레시피 편집기에 **'링크 복사'** 버튼.
3. 공유 링크로 들어오면 '공유받은 레시피' 화면: 설명, 카드, 필요한 플랜 배지, **"당신 플랜으로 돌리면"** 결과, '내 레시피로 가져오기'.
4. 9장 기본 레시피 3종을 `recipes.ts`에 넣고 갤러리(첫 화면)에 카드로 보여 준다.
5. 갤러리 필터: **"내 플랜으로 되는 레시피만 보기"**.

**DoD**
- [ ] 링크를 다른 브라우저(시크릿 창)에서 열면 같은 레시피가 보인다
- [ ] 공유받은 레시피에 내 플랜 기준 경로가 바로 표시된다
- [ ] 필터를 켜면 플랜에 맞지 않는 레시피가 숨겨진다

### 5단계 · 실행 안내 + 배포 (1시간)
1. '어디서 돌리나요?' 페이지: 내보낸 파일을 **터미널(Codex·Claude Code), T3 Code, 1Code**에서 쓰는 법을 짧게 안내. 해당 도구들이 각 CLI를 그대로 실행하므로 프로젝트의 `.codex/agents`, `.claude/agents`가 적용된다는 점을 설명한다(작성 전 각 도구의 문서로 확인).
2. GitHub 저장소를 만들고 올린다(사용자 계정으로, AI가 절차 안내).
3. Vercel에 연결해 배포한다.

**DoD**
- [ ] 공개 링크에서 갤러리 → 편집 → 공유 링크 → 가져오기 → zip 내보내기가 된다

### (시간 남으면) 흐름 캔버스 · 꿀팁 패널
- React Flow 캔버스: 카드 = 노드, 넘겨주기 = 화살표, 노드에 경로 배지.
- 꿀팁 패널: 선택한 카드에 맞는 10장의 팁과 경고(예: 검토자가 편집 권한이면 경고).

### 인계 (오늘의 마지막 단계, 22:00까지 시작)
내일부터는 Fable 없이 다른 모델이 이어서 작업한다. 그 모델이 이 대화 없이도 이어갈 수 있게 `HANDOFF.md`를 완성한다.

`HANDOFF.md` 필수 항목:
- **현재 상태:** 배포 링크, 저장소 링크, 마지막 커밋
- **단계별 DoD 체크 현황:** 완료 / 미완료 / 내일로 미룬 것(축소 항목 포함)
- **알려진 버그와 임시 처리**
- **오늘 내린 결정과 그 이유:** 공식 문서 재확인 결과, 바뀐 필드 이름, 공유 링크 `schemaVersion` 등
- **내일 할 일 순서:** 남은 캔버스·꿀팁 → 6단계
- **다음 모델에게 주는 주의점:** 포지션(실행 기능 만들지 않기), 레시피 데이터 하나, `converters/`·`providers.json` 분리, 키 값 받지 않기, 공유 링크 하위 호환

마지막으로 `CLAUDE.md`와 `AGENTS.md`의 '현재 단계'를 갱신하고 커밋·push한 뒤, 사용자에게 오늘의 결과를 5줄로 보고한다.

---

> ⬇️ 6·7단계는 **내일 이후 다른 모델이 맡는다.** 오늘은 손대지 않는다.

### 6단계 · (내일 이후) 레시피 허브 키우기
- 레시피 갤러리 서버 저장(간단한 DB), 검색, '가져다 쓴 횟수', 포크(고쳐서 다시 올리기)
- 구독 최적화 고도화: 내 플랜 조합에서 역할을 어떻게 나누면 한도를 가장 오래 쓰는지 제안
- 한국어 커뮤니티에 첫 레시피 공개, 사용자 반응 수집
- Gemini(Antigravity CLI)·Grok Build 어댑터: 설정 형식 조사 후 `converters/`에 추가

### 7단계 · (그 이후) 확장
- 협업 리플레이: 실행 기록을 읽어 Claude와 GPT가 주고받은 과정을 재생하는 공유 링크 (로그 형식 사전 조사 필요)
- 교차 모델 연결 도우미: Claude Code에서 Codex를 MCP로 부르는 설정 자동 생성
- 도구·기법 추천: 서버리스 함수 + LLM API + Hugging Face Hub 검색
- 로컬 동반 프로그램: T3 Code가 이미 `npx`로 로컬 실행을 제공하므로 **우선순위 낮음**. 필요하면 '레시피를 프로젝트에 바로 설치하는 명령'(`npx agent-recipes add <링크>`) 정도로만

---

## 8. 이 프로젝트를 만들 때 쓰는 멀티 에이전트 (선택)

이 서비스를 만드는 과정 자체를 첫 번째 레시피 실험으로 삼는다. 사용자가 원할 때만, **일정표보다 늦어지고 있으면 하지 않는다.**
- **작성자:** 메인 세션(Fable)
- **검토자:** 사용자가 쓸 수 있는 다른 제공사 모델. 예: ChatGPT 계정이 있으면 Codex로 1단계·2단계 끝의 diff를 읽기 전용으로 검토
- 검토 결과는 '주장'으로 다루고, 작성자가 검증한 뒤 반영한다.
- 이때 만든 역할 파일은 `samples/`에 넣고, 기본 레시피 후보로 재활용한다.

---

## 9. 기본 레시피 3종 (초기 데이터)

| 레시피 | 카드 구성 | 흐름 | 예상 배지 |
| --- | --- | --- | --- |
| Claude 작성 + Codex 교차 검토 | writer(Claude Code, 편집), reviewer(Codex, 읽기 전용) | writer → reviewer → writer | Claude Pro 필요 · ChatGPT 무료 |
| 기획 → 구현 → 검토 (Codex만) | planner(읽기 전용), implementer(편집), reviewer(읽기 전용) 모두 Codex | planner → implementer → reviewer → implementer | ChatGPT 무료로 가능 (한도 작음) |
| 조사원 여러 명 + 정리원 | researcher ×2~3(읽기 전용, 병렬), synthesizer | researchers → synthesizer | 엔진 구성에 따라 계산 |

배지는 2단계 로직이 계산한 결과를 쓴다. 표의 '예상 배지'는 테스트 기대값으로 쓰되, `providers.json` 재확인 결과가 다르면 그에 맞춰 고친다.

---

## 10. 꿀팁 콘텐츠

- **쓰는 모델과 검토하는 모델을 다르게:** 같은 모델이 자기 결과를 검토하면 자기 패턴을 닮아 놓치기 쉽다. 다른 회사 모델로 교차 검토한다.
- **검토자는 읽기 전용:** 검토 역할에는 수정 권한을 주지 않는다.
- **역할 설명(description)을 구체적으로:** Claude는 이 설명을 보고 언제 맡길지 정한다. "코드 검토"보다 "변경된 파일의 보안·버그를 검토할 때 사용"이 낫다.
- **넘겨줄 정보를 명시:** 서브에이전트는 따로 떨어진 대화창에서 일한다. 부모가 알려 주지 않은 맥락은 모른다.
- **동시 실행 수는 작게 시작:** 에이전트가 늘수록 사용량도 빨리 준다. 2~3개로 시작한다.
- **검토 결과는 '주장'으로:** 다른 모델의 지적도 틀릴 수 있다. 작성자가 검증한 뒤 반영한다.
- **무료 한도는 아껴서:** 무료 경로(③)에 놓인 카드는 짧고 분명한 작업만 맡긴다.

---

## 11. 리스크와 대응

| 리스크 | 대응 |
| --- | --- |
| 하루 안에 못 끝냄 | 두뇌 먼저, 축소 순서, 30분마다 커밋·push, 단계마다 `HANDOFF.md`, 22시 인계 |
| T3 Code·1Code와의 경쟁 | 실행 기능을 만들지 않고 그 위에 얹히는 '레시피' 레이어로 포지셔닝 |
| T3 Code가 역할 설계 기능을 추가할 가능성 | 레시피 데이터와 커뮤니티를 빨리 쌓는 것이 가장 강한 방어. 기본 레시피 품질에 공들이기 |
| 요금제·무료 범위 변화 | `providers.json`에만 두고 확인 날짜·공식 링크 표시, 주기적 갱신 |
| 도구 설정 형식 변화 | `converters/` 한 곳에만 차이를 두고, 구현 직전 공식 문서 재확인 |
| 공유 링크 호환성 깨짐 | `schemaVersion` 필수, 옛 버전 읽기 코드 유지 |
| 약관 위반 | 무료 웹 계정 자동화·스크래핑 금지 |
| 키 유출 | 키 값은 받지 않고 '보유 여부'만 체크 |

---

## 12. 열린 질문 (사용자가 정할 것)

- [ ] 서비스 이름 (가칭 `agent-recipes`)
- [ ] 오늘 작업 시작 시각과 쓸 수 있는 시간
- [ ] 내일 이후 이어서 쓸 모델 (HANDOFF.md를 그 모델에 맞춰 씀)
- [ ] 첫 레시피를 공개할 커뮤니티 (6단계)
