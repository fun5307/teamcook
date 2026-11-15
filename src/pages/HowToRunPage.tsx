// '어디서 돌리나요?' 화면: 내보낸 파일을 터미널·T3 Code·1Code에서 쓰는 법.
// 이 사이트는 에이전트를 직접 실행하지 않는다. 실행은 사용자 PC의 Codex·Claude Code가 맡는다.

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Notice, PageHeader } from '@/components/common';
import { providerData } from '@/data/providers';

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-4 rounded-2xl border bg-card p-5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">{title}</h2>
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
        description="이 사이트는 팀을 설계하고 파일로 내보내는 곳이에요. 실행은 내 PC의 Codex나 Claude Code가 합니다."
      />

      <Notice tone="info">
        내보낸 파일은 Codex와 Claude Code의 <strong>표준 설정 형식</strong>이에요. 그래서 터미널에서든, 그 도구들을
        대신 실행해 주는 T3 Code·1Code에서든 똑같이 적용됩니다.
      </Notice>

      <Step number={1} title="zip을 풀어 프로젝트 폴더에 넣기">
        <p>
          레시피 화면에서 <strong>zip으로 내보내기</strong>를 누르고 압축을 풉니다. 그 안의 <code>.codex</code>{' '}
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

      <Step number={5} title="두 회사 모델을 섞은 팀은 이렇게">
        <p>
          'Claude 작성 + Codex 교차 검토'처럼 도구가 섞인 팀은, <strong>같은 프로젝트 폴더에서 두 도구를 번갈아</strong>{' '}
          쓰면 됩니다.
        </p>
        <ol className="list-decimal pl-5 text-muted-foreground">
          <li>Claude Code에서 작성자에게 구현을 맡깁니다.</li>
          <li>같은 폴더에서 Codex를 열어 "reviewer 에이전트로 방금 변경을 검토해 줘"라고 합니다.</li>
          <li>검토 결과를 Claude Code에 붙여 넣고 "사실인지 확인한 뒤 맞는 것만 반영해 줘"라고 합니다.</li>
        </ol>
        <p className="text-muted-foreground">
          내보낸 zip에는 모든 에이전트가 두 형식으로 다 들어 있어서, 한쪽 도구만 있어도 팀 전체를 그 도구 하나로
          돌릴 수 있어요.
        </p>
      </Step>

      <p className="text-xs text-muted-foreground">
        이 페이지의 요금제·설정 정보는 {providerData.lastVerified}에 확인했어요. 도구는 빠르게 바뀌니, 다르게 동작하면
        각 도구의 공식 문서를 확인하세요.
      </p>
    </div>
  );
}
