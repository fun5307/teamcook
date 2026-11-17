// '재료 사전': 멀티 에이전트, 서브에이전트, 에이전트 팀, 토론형, A2A, MCP, 토큰을 요리에 빗대어 설명하는 문서.
// 사실로 적은 내용은 공식 문서로 확인했다 (확인 날짜와 출처는 맨 아래, 그리고 SOURCES).
// 비유는 이해를 돕는 것이지 정확한 정의가 아니다. 정확한 문장은 "실제로는" 줄에 따로 적는다.

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { STYLE_COLORS } from '@/components/RouteInfo';
import { COLLABORATIONS } from '@/data/collaboration';
import type { Collaboration } from '@/types';

export const CONCEPTS_VERIFIED = '2026-11-17';

export const SOURCES = [
  { label: 'Claude Code 서브에이전트', href: 'https://code.claude.com/docs/en/sub-agents' },
  { label: 'Claude Code 에이전트 팀', href: 'https://code.claude.com/docs/en/agent-teams' },
  { label: 'Claude Code 비용 관리', href: 'https://code.claude.com/docs/en/costs' },
  { label: 'A2A 프로토콜: 핵심 개념', href: 'https://a2a-protocol.org/latest/topics/key-concepts/' },
  { label: 'A2A 프로토콜: A2A와 MCP', href: 'https://a2a-protocol.org/latest/topics/a2a-and-mcp/' },
];

const KITCHEN: [string, string, string][] = [
  ['재료', '에이전트 (역할 카드)', '맡은 일과 지시문, 권한을 가진 AI 하나. 레시피 카드의 "재료" 한 줄이 역할 하나예요.'],
  ['레시피', '팀 설계', '어떤 재료를 쓰고 누가 누구에게 무엇을 넘기는지 적은 한 장. teamcook이 만드는 것이 이것이에요.'],
  ['조리법', '협업 방식', '재료를 어떻게 함께 익히는지: 서브에이전트, 에이전트 팀, 토론형.'],
  ['주방', '실행 도구', 'Claude Code, Codex처럼 실제로 AI를 돌리는 곳. teamcook은 주방이 아니라 레시피 책이에요.'],
  ['주문서', '첫 프롬프트', '주방에 "이 레시피대로 이 일을 해 줘"라고 건네는 글.'],
  ['재료비', '토큰과 한도', 'AI가 읽고 쓰는 글의 양. 구독이면 한도에서 줄고, API 키면 쓴 만큼 돈이 나가요.'],
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3 border-t pt-8">
      <h2 className="text-2xl font-extrabold">{title}</h2>
      <div className="flex max-w-3xl flex-col gap-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

/** 비유와 실제를 나란히 */
function Pair({ kitchen, real }: { kitchen: string; real: string }) {
  return (
    <dl className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="mb-1 text-xs font-bold text-primary">주방에 빗대면</dt>
        <dd>{kitchen}</dd>
      </div>
      <div>
        <dt className="mb-1 text-xs font-bold text-muted-foreground">실제로는</dt>
        <dd>{real}</dd>
      </div>
    </dl>
  );
}

const STYLE_ROWS: { id: Collaboration; who: string; talk: string; cost: string; when: string }[] = [
  {
    id: 'subagents',
    who: '주방장(메인 AI)이 재료마다 따로 손질을 맡겨요',
    talk: '손질한 결과만 주방장에게 돌아와요. 재료끼리는 이야기하지 않아요',
    cost: '보통. 역할마다 대화 창을 따로 쓰지만 결과만 요약해 돌려줘요',
    when: '빨리 끝나는 집중 작업, 결과만 받으면 되는 일',
  },
  {
    id: 'agent-team',
    who: '요리사 여럿이 한 주방에서 함께 일해요. 주방장(리드)이 일을 나눠요',
    talk: '요리사끼리 직접 이야기하고, 할 일 목록을 같이 봐요',
    cost: '무거움. 팀원마다 AI가 따로 돌아 혼자 할 때보다 훨씬 많이 써요',
    when: '서로 발견한 것을 나누고 반박해야 하는 조사·검토, 가설이 여러 개인 버그',
  },
  {
    id: 'debate',
    who: '요리사 한 명이 여러 역할을 번갈아 맡아요',
    talk: '한 대화 안에서 역할들이 차례로 말해요',
    cost: '가벼움. 대화 창 하나로 끝나요',
    when: '선택지를 따져 볼 때, 설치 없이 무료 채팅으로 해 보고 싶을 때',
  },
];

export function ConceptsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="재료 사전"
        description="멀티 에이전트, 에이전트 팀, A2A 같은 말을 주방에 빗대어 풀었어요. 레시피를 고르기 전에 한 번 읽어 두면 좋아요."
      />

      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="목차">
        {[
          ['#kitchen', '주방 용어표'],
          ['#multi', '멀티 에이전트'],
          ['#styles', '조리법 세 가지'],
          ['#cost', '재료비: 토큰과 비용'],
          ['#a2a', 'A2A와 MCP'],
          ['#pick', '무엇을 고를까'],
        ].map(([href, label]) => (
          <button
            key={href}
            type="button"
            onClick={() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })}
            className="text-muted-foreground underline underline-offset-2 hover:text-primary"
          >
            {label}
          </button>
        ))}
      </nav>

      <section id="kitchen" className="flex flex-col gap-3">
        <h2 className="text-2xl font-extrabold">주방 용어표</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="p-3 font-medium">teamcook에서</th>
                <th className="p-3 font-medium">원래 말</th>
                <th className="p-3 font-medium">뜻</th>
              </tr>
            </thead>
            <tbody>
              {KITCHEN.map(([kitchen, real, meaning]) => (
                <tr key={kitchen} className="border-b align-top last:border-b-0">
                  <th className="p-3 font-heading text-base font-extrabold whitespace-nowrap">{kitchen}</th>
                  <td className="p-3 whitespace-nowrap">{real}</td>
                  <td className="p-3 text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Section id="multi" title="멀티 에이전트: 재료를 나누는 이유">
        <p>
          AI 하나에게 "기획하고, 만들고, 검토까지 해 줘"라고 하면 한 대화 안에 모든 것이 쌓여요. 대화가 길어지면
          앞의 내용을 놓치고, 자기가 만든 것을 자기가 검토하니 허점을 잘 못 봐요.
        </p>
        <p>
          멀티 에이전트는 일을 역할로 나눠 AI 여러 개에게 맡기는 방식이에요. 역할마다 지시문과 권한이 다르고, 각자
          자기 대화 창에서 일해요.
        </p>
        <Pair
          kitchen="한 사람이 썰고 볶고 맛까지 보는 대신, 재료마다 맡은 사람을 두는 것. 맛을 보는 사람은 볶은 사람이 아니에요."
          real="에이전트마다 자기 문맥 창(대화 기억)과 지시문을 갖고, 필요한 도구만 쓰게 제한할 수 있어요."
        />
        <p className="text-sm text-muted-foreground">
          나눈다고 항상 좋은 것은 아니에요. 차례대로 이어지는 일, 같은 파일을 여럿이 고치는 일은 한 대화나
          서브에이전트가 더 낫다고 공식 문서도 말해요.
        </p>
      </Section>

      <Section id="styles" title="조리법 세 가지">
        <p>같은 재료라도 어떻게 함께 익히느냐에 따라 결과와 드는 재료비가 달라요.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {STYLE_ROWS.map((row) => (
            <article key={row.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm">
              <h3 className="flex items-center gap-2 font-heading text-lg font-extrabold">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: STYLE_COLORS[row.id] }} />
                {COLLABORATIONS[row.id].label}
              </h3>
              <dl className="flex flex-col gap-2">
                {(
                  [
                    ['누가 일하나', row.who],
                    ['누구와 이야기하나', row.talk],
                    ['재료비', row.cost],
                    ['이럴 때', row.when],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-bold text-primary">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-auto border-t pt-2 text-xs text-muted-foreground">{COLLABORATIONS[row.id].availability}</p>
            </article>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          에이전트 팀은 Claude Code의 실험 기능이고 기본으로 꺼져 있어요. teamcook이 내보내는 zip에 켜는 설정이
          들어 있어요. 토론형은 설정 파일 없이 프롬프트 하나로 하는, teamcook이 붙인 이름이에요.
        </p>
      </Section>

      <Section id="cost" title="재료비: 토큰과 비용">
        <p>
          AI는 글을 "토큰"이라는 조각으로 세요. 읽은 글(지시문, 파일, 앞의 대화)과 쓴 글이 모두 토큰이고, 이것이
          재료비예요. 역할을 나누면 역할마다 지시문과 자료를 따로 읽으니 재료비가 늘어요.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>서브에이전트:</strong> 역할마다 자기 토큰을 쓰지만, 결과만 요약해 돌려주므로 메인 대화는 가볍게
            유지돼요.
          </li>
          <li>
            <strong>에이전트 팀:</strong> 팀원마다 별도의 Claude가 돌아요. 공식 문서는 "혼자 할 때보다 토큰을 훨씬
            많이 쓴다"고 하고, 팀원이 계획 모드로 돌 때는 보통 대화의 약 7배라고 적고 있어요. 팀원 수만큼 늘어나니
            팀은 작게(대부분 3~5명) 시작하라고 권해요.
          </li>
          <li>
            <strong>토론형:</strong> 대화 하나라서 가장 가벼워요.
          </li>
        </ul>
        <Pair
          kitchen="구독은 월정액 식자재 창고예요. 돈이 더 들지는 않지만 창고(한도)가 비면 기다려야 해요. API 키는 쓸 때마다 장을 보는 것이라 쓴 만큼 돈이 나가요."
          real="구독 로그인으로 쓰면 요금제의 사용 한도에서 차감되고, API 키로 쓰면 토큰 수에 따라 결제돼요. 무료 계정은 한도가 작아요."
        />
        <p>
          그래서 teamcook은 레시피마다 <strong>사용량 가벼움·보통·무거움</strong>을 보여 주고, 첫 화면에서 추천할 때
          "사용량 여유"를 함께 따져요. 이 표시는 조리법과 역할 수로 가늠한 어림이에요. 실제 토큰 수나 금액은 과제
          크기에 따라 크게 달라서 숫자로 적지 않아요.
        </p>
      </Section>

      <Section id="a2a" title="A2A와 MCP: 주방 밖과 이어지는 규약">
        <p>
          지금까지는 한 주방(Claude Code 하나, Codex 하나) 안의 이야기였어요. A2A와 MCP는 주방 밖과 이어지는
          약속이에요.
        </p>
        <Pair
          kitchen="A2A는 서로 다른 식당의 주방끼리 주문을 주고받는 규약이에요. 상대 주방이 어떻게 요리하는지는 몰라도, 메뉴판을 보고 주문하고 진행 상황과 완성된 요리를 받아요."
          real="A2A(Agent2Agent)는 서로 다른 회사·도구로 만든 AI 에이전트끼리 통신하기 위한 공개 표준이에요. Linux Foundation 아래에서 관리돼요."
        />
        <ul className="list-disc pl-5 text-sm">
          <li>
            <strong>Agent Card (메뉴판):</strong> 에이전트가 누구이고 어디로 연락하며 무엇을 할 수 있는지 적은 JSON
            문서.
          </li>
          <li>
            <strong>Task (주문):</strong> 고유 번호와 진행 상태가 있는 일 한 건.
          </li>
          <li>
            <strong>Message (주고받는 말):</strong> 요청하는 쪽과 에이전트 사이의 대화 한 번.
          </li>
          <li>
            <strong>Artifact (완성된 요리):</strong> 일을 하며 만들어 낸 결과물(문서, 이미지, 데이터 등).
          </li>
        </ul>
        <Pair
          kitchen="MCP는 요리사 한 명이 쓰는 조리 도구와 식자재 창고를 연결하는 규격이에요. 칼, 오븐, 냉장고를 같은 방식으로 꽂아 쓰게 해 줘요."
          real="MCP는 에이전트 하나를 자기 도구·자료에 연결해요. A2A 문서의 표현으로는 MCP는 에이전트 하나를 깊게 하고(수직), A2A는 에이전트끼리 잇는다(수평)고 해요. 둘은 함께 써요."
        />
        <div className="rounded-xl border border-dashed p-4 text-sm">
          <p className="font-bold">teamcook과 헷갈리기 쉬운 점</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            <li>teamcook의 "역할 카드"는 A2A의 Agent Card가 아니에요. 역할 카드는 한 주방 안에서 쓰는 설정 파일이 돼요.</li>
            <li>teamcook은 A2A나 MCP를 설정하거나 실행하지 않아요. 여기서는 개념만 설명해요.</li>
            <li>에이전트 팀의 "팀원끼리 대화"는 Claude Code 안의 기능이고 A2A가 아니에요.</li>
          </ul>
        </div>
      </Section>

      <Section id="pick" title="무엇을 고를까">
        <p>공식 문서의 조언은 한 줄이에요: 팀을 꾸리기 전에, 더 가벼운 방법으로 되는지 먼저 확인하라.</p>
        <ol className="list-decimal pl-5">
          <li>혼자서 될 일이면 AI 하나에게 시켜요. 따져 볼 관점이 여럿이면 <strong>토론형</strong>이 가장 가벼워요.</li>
          <li>일을 나눠 맡기고 결과만 받으면 되면 <strong>서브에이전트</strong>.</li>
          <li>맡은 사람끼리 발견을 나누고 서로 반박해야 하면 <strong>에이전트 팀</strong>. 재료비가 가장 많이 들어요.</li>
        </ol>
        <p>
          <a className="font-medium text-primary underline-offset-2 hover:underline" href="#/">
            첫 화면에서 하고 싶은 작업을 적으면
          </a>{' '}
          이 순서와 내 AI 현황, 사용량 여유를 함께 따져 레시피를 권해 드려요.
        </p>
      </Section>

      <footer className="flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
        <p>사실로 적은 내용은 아래 공식 문서에서 {CONCEPTS_VERIFIED}에 확인했어요. 이 분야는 자주 바뀌니 중요한 결정 전에는 원문을 보세요.</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {SOURCES.map((source) => (
            <li key={source.href}>
              <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" href={source.href} target="_blank" rel="noreferrer noopener">
                {source.label} <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
