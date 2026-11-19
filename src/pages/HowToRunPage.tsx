// '어디서 돌리나요?' 화면: 레시피 파일을 어디에 넣고, 어느 도구에서 돌리고, 돌린 뒤 어디서 보는지.
// 이 사이트는 에이전트를 직접 실행하지 않는다. 실행은 사용자 PC의 Codex·Claude Code 등이 맡고,
// 돌린 뒤 팀을 보고 고치고 보고받는 것은 작업실(teamcook open)이 맡는다.

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Notice, PageHeader } from '@/components/common';
import { AGENT_TEAMS_SETTINGS_JSON, COLLABORATIONS } from '@/data/collaboration';
import { CLI_DOWNLOAD_COMMAND } from '@/data/site';

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-4 rounded-2xl border bg-card p-5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-relaxed">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs text-zinc-100">{children}</pre>
  );
}

function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children} <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

export function HowToRunPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="어디서 돌리나요?"
        description="teamcook은 AI를 직접 돌리지 않아요. 팀 파일을 내 프로젝트에 넣어 주고, 돌린 뒤에 팀을 보고 고치고 보고받는 곳이에요. 실행은 내 PC의 Claude Code·Codex 같은 도구가 합니다."
      />

      <ol className="grid gap-3 sm:grid-cols-3" aria-label="전체 흐름">
        {[
          { n: '①', title: '팀 고르기', body: '레시피 책에서 팀을 고르고 파일로 받아요. (1·6번)' },
          { n: '②', title: '내 도구에서 실행', body: 'Claude Code·Codex·T3 Code 등에서 일을 시켜요. (2~5번)' },
          { n: '③', title: '작업실에서 보고받기', body: '팀원을 보고 고치고, 업무 일지로 결과를 확인해요. (7번)' },
        ].map((item) => (
          <li key={item.n} className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
            <span className="font-heading text-lg font-extrabold">
              <span className="mr-1.5 text-primary">{item.n}</span>
              {item.title}
            </span>
            <span className="text-sm text-muted-foreground">{item.body}</span>
          </li>
        ))}
      </ol>
      <p className="-mt-3 text-sm text-muted-foreground">이미 팀 파일이 있는 프로젝트라면 ①을 건너뛰고, 팀을 보고 고치고 싶다면 7번으로 가세요.</p>

      <Notice tone="info">
        내보낸 파일은 Codex와 Claude Code의 <strong>표준 설정 형식</strong>이에요. 그래서 터미널에서든, 그 도구들을
        대신 실행해 주는 T3 Code·1Code에서든 똑같이 적용됩니다.
      </Notice>

      <Step number={1} title="zip을 풀어 프로젝트 폴더에 넣기">
        <p>
          레시피 화면에서 <strong>내보내기 준비</strong>를 눌러 점검 결과와 파일을 확인한 뒤 zip을 내려받아 압축을 풉니다. 그 안의 <code>.codex</code>{' '}
          폴더와 <code>.claude</code> 폴더를 <strong>내 프로젝트 폴더 맨 위</strong>에 복사하세요.
        </p>
        <Code>{`내-프로젝트/
├─ .codex/
│  ├─ agents/reviewer.toml     ← Codex용 에이전트
│  └─ config.toml              ← 동시에 돌릴 에이전트 수
├─ .claude/
│  └─ agents/reviewer.md       ← Claude Code용 에이전트
└─ (내 코드…)`}</Code>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            점(.)으로 시작하는 폴더는 숨김 폴더라 안 보일 수 있어요. Windows 탐색기는 <em>보기 → 숨긴 항목</em>,
            macOS Finder는 <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> 으로 보이게 합니다.
          </li>
          <li>
            이미 <code>.codex/config.toml</code>이 있다면 덮어쓰지 말고 <code>[agents]</code> 부분만 옮겨 적으세요.
          </li>
          <li>
            함께 들어 있는 <code>RECIPE.md</code>에 이 팀의 실행 순서와 첫 프롬프트 예시가 적혀 있어요.
          </li>
        </ul>
      </Step>

      <Step number={2} title="터미널에서 Codex로 실행">
        <Code>{`cd 내-프로젝트
codex`}</Code>
        <p>
          Codex가 열리면 에이전트 이름을 불러 일을 맡깁니다. 예:{' '}
          <em>"planner에게 계획을 세우게 하고, implementer가 구현한 뒤, reviewer가 검토하게 해 줘."</em> 실행 중인
          에이전트는 <code>/subagents</code>로 볼 수 있어요.
        </p>
        <Notice tone="warn">
          <strong>읽기 전용 주의:</strong> Codex는 에이전트 파일만으로는 읽기 전용을 강제하지 못해요(서브에이전트는
          메인 세션의 권한을 물려받음). 그래서 읽기 전용 카드는 지시문에 "수정하지 마라"를 넣어 내보냅니다. 검토·조사만
          할 때 확실히 막으려면 <code>codex --sandbox read-only</code>로 시작하세요.
        </Notice>
        <Notice tone="warn">
          <strong>ChatGPT Free·Go 플랜:</strong> 터미널(CLI)이 아니라 <strong>ChatGPT 데스크톱 앱</strong>의
          Codex에서만 쓸 수 있고, 한도가 작아요. 데스크톱 앱에서 같은 프로젝트 폴더를 열면 됩니다. 터미널에서 쓰려면
          Plus 이상이나 API 키가 필요해요.
        </Notice>
        <div className="flex flex-wrap gap-3">
          <Source href="https://learn.chatgpt.com/docs/agent-configuration/subagents">
            Codex 서브에이전트 공식 문서
          </Source>
          <Source href="https://learn.chatgpt.com/docs/pricing">Codex 요금제 공식 문서</Source>
        </div>
      </Step>

      <Step number={3} title="터미널에서 Claude Code로 실행">
        <Code>{`cd 내-프로젝트
claude`}</Code>
        <p>
          먼저 <em>"어떤 서브에이전트가 있어?"</em>라고 물어 팀이 보이는지 확인하세요. 특정 에이전트를 콕 집어
          부르려면 <code>@agent-reviewer</code>처럼 쓰고, 자연스럽게 <em>"reviewer 에이전트로 방금 변경을 검토해
          줘"</em>라고 해도 됩니다.
        </p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            <code>.claude/agents</code> 폴더를 <strong>처음 만든 경우</strong>에는 Claude Code를 한 번 껐다 켜야
            보여요. 그 뒤로는 파일을 고치면 몇 초 안에 반영됩니다.
          </li>
          <li>읽기 전용 카드는 읽기 도구(Read, Grep, Glob)만 쓰도록 내보내져서, 파일을 고칠 수 없어요.</li>
          <li>Claude Code는 Pro 이상 플랜이나 콘솔(API) 계정이 필요해요. 무료 플랜으로는 쓸 수 없어요.</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Source href="https://code.claude.com/docs/en/sub-agents">Claude Code 서브에이전트 공식 문서</Source>
          <Source href="https://code.claude.com/docs/en/setup">Claude Code 설치·요금제 공식 문서</Source>
        </div>
      </Step>

      <Step number={4} title="T3 Code · 1Code에서 실행">
        <p>
          두 도구는 여러 에이전트 작업을 한 화면에서 관리해 주는 프로그램이에요. 직접 AI를 돌리는 게 아니라{' '}
          <strong>내 PC에 설치되고 로그인된 Codex·Claude Code를 대신 실행</strong>합니다. 그래서 2~3번처럼 파일을
          프로젝트 폴더에 넣어 두고, 그 폴더를 프로젝트로 열면 됩니다.
        </p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            <strong>T3 Code:</strong> <code>npx t3@latest</code>로 실행하고 프로젝트 폴더를 엽니다. Codex·Claude Code가
            먼저 설치·로그인돼 있어야 해요.
          </li>
          <li>
            <strong>1Code:</strong> 채팅마다 별도의 git 작업 폴더(worktree)에서 실행돼요. 그래서{' '}
            <strong>
              <code>.codex</code>와 <code>.claude</code> 폴더를 git에 커밋해 두어야
            </strong>{' '}
            새 채팅에서도 에이전트가 보입니다.
          </li>
        </ul>
        <Notice tone="warn">
          이 항목은 공식 문서가 아니라 소개 글을 바탕으로 정리했고, 직접 실행해 확인하지는 못했어요. 에이전트가 안
          보이면 같은 폴더에서 터미널로 2~3번을 먼저 확인해 보세요.
        </Notice>
        <div className="flex flex-wrap gap-3">
          <Source href="https://flaviocopes.com/t3-code">T3 Code 소개 (Flavio Copes)</Source>
          <Source href="https://github.com/21st-dev/1code">1Code (GitHub)</Source>
        </div>
      </Step>

      <Step number={5} title="Antigravity · Grok Build에서 실행">
        <p>
          카드의 '돌릴 도구'를 Antigravity CLI나 Grok Build로 고르면, zip에 그 도구의 형식도 함께 들어갑니다. 같은
          방식으로 프로젝트 폴더 맨 위에 복사하세요.
        </p>
        <Code>{`내-프로젝트/
├─ .agents/agents/reviewer.md   ← Antigravity용 (실행: agy)
└─ .grok/agents/reviewer.md     ← Grok Build용 (실행: grok, 목록: /agents)`}</Code>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            Antigravity의 읽기 전용 카드는 읽기 도구(<code>view_file</code>, <code>grep_search</code>)만 쓰도록
            내보냅니다.
          </li>
          <li>
            Grok Build는 도구 이름 목록을 공식 문서에서 다 확인하지 못해서, 읽기 전용을 지시문의 "수정하지 마라"
            문장으로 표현합니다.
          </li>
        </ul>
        <p className="font-medium">로그인과 API 키</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            <strong>Antigravity:</strong> 처음 <code>agy</code>를 켜면 구글 계정으로 로그인해요(무료·Plus·Pro·Ultra 모두).
            브라우저가 없는 서버 같은 곳에서는 Google AI Studio에서 만든 Gemini API 키를 쓸 수 있어요. 설정 파일{' '}
            <code>~/.gemini/antigravity-cli/settings.json</code>에 <code>"modelProvider": "gemini"</code>를 적고{' '}
            <code>GEMINI_API_KEY</code> 환경 변수에 키를 넣습니다. <code>GOOGLE_API_KEY</code>나 .env 파일은 읽지 않아요.
          </li>
          <li>
            <strong>Grok Build:</strong> 처음 <code>grok</code>을 켜면 브라우저가 열려 로그인해요. 브라우저가 없는 곳에서는{' '}
            <code>XAI_API_KEY</code> 환경 변수에 xAI API 키를 넣습니다.
          </li>
          <li>
            API 키는 구독과 따로 계산돼요. 무료 구글 계정으로도 Gemini API 키를 받을 수 있고, 일부 모델은 무료지만 그때 입력한
            내용이 구글 제품 개선에 쓰일 수 있어요. Google AI Pro·Ultra는 매달 API 크레딧(Pro $10, Ultra 5배 $40, 20배 $100)을
            주지만, xAI API는 X 구독과 별개로 콘솔에 크레딧을 채워 쓴 만큼 내요.
          </li>
        </ul>
        <Notice tone="warn">
          두 도구는 설정 파일 형식과 로그인 방법을 공식 문서로 확인했고, 레시피 파일로 실제로 실행해 보지는 못했어요.
        </Notice>
        <div className="flex flex-wrap gap-3">
          <Source href="https://antigravity.google/docs/subagents">Antigravity 서브에이전트 공식 문서</Source>
          <Source href="https://antigravity.google/docs/cli/install">Antigravity 로그인 공식 문서</Source>
          <Source href="https://docs.x.ai/build/features/subagents">Grok Build 서브에이전트 공식 문서</Source>
          <Source href="https://docs.x.ai/build/overview">Grok Build 시작하기 공식 문서</Source>
        </div>
      </Step>

      <Step number={6} title="터미널 명령 한 줄로 설치하기">
        <p>
          zip을 풀어 복사하는 대신, 공유 링크를 그대로 써서 프로젝트 폴더에 설치할 수도 있어요. 레시피 화면의{' '}
          <strong>링크 복사</strong>를 누르면 아래 같은 명령이 함께 나옵니다.
        </p>
        <Code>{`cd 내-프로젝트
${CLI_DOWNLOAD_COMMAND}
node teamcook.mjs add "https://teamcook-eta.vercel.app/#r=…"`}</Code>
        <p className="text-muted-foreground">
          첫 줄은 설치 도구 파일(<code>teamcook.mjs</code>) 하나를 내려받고, 둘째 줄이 레시피를 설치합니다. Node.js만
          있으면 Windows·macOS·Linux에서 같은 명령으로 됩니다. 설치가 끝나면 <code>teamcook.mjs</code>는 지워도
          돼요.
        </p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>이미 있는 파일은 건드리지 않아요. 덮어쓰려면 끝에 <code>--force</code>를 붙입니다.</li>
          <li>
            <code>.codex/config.toml</code>은 <code>--force</code>여도 덮어쓰지 않습니다.
          </li>
          <li>
            설명서와 원본은 <code>.teamcook/</code> 폴더에 들어갑니다. 미리 보기만 하려면 <code>--dry-run</code>.
          </li>
          <li>링크에 <code>#</code>이 들어 있으니 꼭 따옴표로 감싸세요.</li>
        </ul>
      </Step>

      <Step number={7} title="돌린 뒤에는 작업실에서 보고받기">
        <p>
          팀을 돌린 뒤에는 <strong>작업실</strong>에서 팀원과 업무 일지를 봅니다. 작업실은 내 컴퓨터에서 터미널 명령으로 열고,
          Claude Code·Codex가 남긴 대화 기록을 <strong>읽기만</strong> 해요. 실행을 대신 해 주지는 않아요.
        </p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            <strong>팀원:</strong> 프로젝트의 <code>.claude/agents</code>·<code>.codex/agents</code> 역할 파일을 카드로 보여
            주고, 맡길 일과 권한을 고치면 그 파일에 바로 저장해요.
          </li>
          <li>
            <strong>업무 일지:</strong> 누구에게 무엇을 시켰고 무엇을 돌려받았는지를 시간과 함께 보여 줘요.
          </li>
          <li>
            내 컴퓨터에서 연 작업실은 역할 파일이 바뀌거나 새 기록이 생기면 화면을 저절로 새로 고쳐요.
          </li>
        </ul>
        <p>
          여는 법은 <a className="underline underline-offset-2 hover:text-primary" href="#/workshop">작업실 소개</a>에 있어요. 설치 없이
          Chrome·Edge에서 폴더를 직접 골라 맛볼 수도 있어요.
        </p>
      </Step>

      <Step number={8} title="두 회사 모델을 섞은 팀은 이렇게">
        <p>
          'Claude 작성 + Codex 교차 검토'처럼 도구가 섞인 팀은, <strong>같은 프로젝트 폴더에서 두 도구를 번갈아</strong>{' '}
          쓰면 됩니다.
        </p>
        <ol className="list-decimal pl-5 text-muted-foreground">
          <li>Claude Code에서 작성자에게 구현을 맡깁니다.</li>
          <li>같은 폴더에서 Codex를 열어 "reviewer 에이전트로 방금 변경을 검토해 줘"라고 합니다.</li>
          <li>검토 결과를 Claude Code에 붙여 넣고 "사실인지 확인한 뒤 맞는 것만 반영해 줘"라고 합니다.</li>
        </ol>
        <p>
          번갈아 쓰기가 번거롭다면, 편집 화면에서{' '}
          <strong>'Claude Code에서 Codex 자동 호출' (실험적)</strong>을 켜고 내보내 보세요. Codex 담당 에이전트의
          Claude Code용 파일이 <code>codex exec</code> 명령으로 Codex에게 일을 넘기게 되어, Claude Code 하나만 열어
          두어도 됩니다. (예전에 쓰던 "Codex를 MCP 서버로 연결"하는 방법은 Codex에서 그 기능이 없어져서 쓸 수
          없어요.)
        </p>
        <p className="text-muted-foreground">
          내보낸 zip에는 모든 에이전트가 두 형식으로 다 들어 있어서, 한쪽 도구만 있어도 팀 전체를 그 도구 하나로
          돌릴 수 있어요.
        </p>
      </Step>

      <Step number={9} title="조리법(협업 방식)에 따라 실행 방법이 달라요">
        <p>
          레시피마다 <strong>조리법</strong>이 있어요. 위 1~6번은 기본 조리법인 <strong>서브에이전트</strong> 기준이고,
          나머지 두 가지는 이렇게 돌립니다.
        </p>

        <h3 className="mt-2 font-semibold">서브에이전트 (기본)</h3>
        <p className="text-muted-foreground">{COLLABORATIONS.subagents.description}</p>
        <p>위 1~3번대로 파일을 넣고, RECIPE.md의 '첫 프롬프트 예시'를 붙여 넣습니다.</p>

        <h3 className="mt-2 font-semibold">에이전트 팀 (Claude Code 전용 · 실험 기능)</h3>
        <p className="text-muted-foreground">{COLLABORATIONS['agent-team'].description}</p>
        <ol className="list-decimal pl-5">
          <li>
            zip 안의 <code>.claude</code> 폴더를 프로젝트 폴더 맨 위에 복사합니다. 팀원 정의(
            <code>.claude/agents/*.md</code>)와, 에이전트 팀을 켜는 <code>.claude/settings.json</code>이 들어 있어요.
          </li>
          <li>
            이미 <code>.claude/settings.json</code>이 있다면 덮어쓰지 말고, 아래 <code>env</code> 줄만 그 파일에
            더하세요.
          </li>
          <li>
            Claude Code를 <strong>새로 시작</strong>하고, RECIPE.md의 '첫 프롬프트(팀원 소개)'를 붙여 넣습니다.
          </li>
          <li>
            화면 아래 에이전트 목록에 팀원 이름이 보이면 성공입니다. 위·아래 화살표와 Enter로 팀원 대화를 보고,{' '}
            <kbd>Ctrl</kbd>+<kbd>T</kbd>로 함께 쓰는 할 일 목록을 봅니다.
          </li>
        </ol>
        <Code>{AGENT_TEAMS_SETTINGS_JSON.trimEnd()}</Code>
        <ul className="list-disc pl-5 text-muted-foreground">
          {COLLABORATIONS['agent-team'].notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <Notice tone="warn">
          에이전트 팀은 켜는 방법과 한계를 공식 문서로 확인했지만, 실험
          기능이라 동작이 바뀔 수 있어요. 팀원이 생기지 않고 서브에이전트로 일을 시작하면 "서브에이전트 말고 에이전트
          팀으로 다시 해 줘"라고 말하세요.
        </Notice>
        <div className="flex flex-wrap gap-3">
          <Source href={COLLABORATIONS['agent-team'].sourceUrl ?? ''}>Claude Code 에이전트 팀 공식 문서</Source>
        </div>

        <h3 className="mt-2 font-semibold">토론형 (어느 AI에서나 · 무료 가능)</h3>
        <p className="text-muted-foreground">{COLLABORATIONS.debate.description}</p>
        <ol className="list-decimal pl-5">
          <li>
            레시피 화면의 <strong>프롬프트 복사</strong>를 누릅니다. (zip에도 <code>debate-prompt.txt</code>로 들어
            있어요.)
          </li>
          <li>ChatGPT·Claude·Gemini 등 쓰는 AI 채팅에 붙여 넣습니다. 설치할 것은 없습니다.</li>
          <li>"주제:" 줄만 내가 결정하고 싶은 것으로 바꿔서 보냅니다.</li>
        </ol>
        <ul className="list-disc pl-5 text-muted-foreground">
          {COLLABORATIONS.debate.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Step>

      <p className="text-xs text-muted-foreground">
        도구는 빠르게 바뀌니, 다르게 동작하면
        각 도구의 공식 문서를 확인하세요.
      </p>
    </div>
  );
}
