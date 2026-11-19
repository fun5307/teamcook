// '재료 사전': 멀티 에이전트, 서브에이전트, 에이전트 팀, 토론형, 토큰, A2A, MCP를 그림과 표로 설명한다.
// 병 라벨, 성분표, 도해로 "재료" 이야기를 풀고, 글은 그림을 읽는 데 필요한 만큼만 쓴다.
// 사실로 적은 내용은 공식 문서로 확인했다 (출처는 맨 아래). 그림의 길이·크기 가운데
// 공식 수치가 아닌 것은 "어림"이라고 표시한다.

import type { CSSProperties, ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Reveal } from '@/components/Reveal';
import { STYLE_COLORS } from '@/components/RouteInfo';
import { COLLABORATIONS } from '@/data/collaboration';
import type { Collaboration } from '@/types';


export const SOURCES = [
  { label: 'Claude Code 서브에이전트', href: 'https://code.claude.com/docs/en/sub-agents' },
  { label: 'Claude Code 에이전트 팀', href: 'https://code.claude.com/docs/en/agent-teams' },
  { label: 'Claude Code 비용 관리', href: 'https://code.claude.com/docs/en/costs' },
  { label: 'A2A 프로토콜: 핵심 개념', href: 'https://a2a-protocol.org/latest/topics/key-concepts/' },
  { label: 'A2A 프로토콜: A2A와 MCP', href: 'https://a2a-protocol.org/latest/topics/a2a-and-mcp/' },
];

const i = (index: number) => ({ '--i': index }) as CSSProperties;

// ───────────────────────── 1. 찬장 ─────────────────────────

const JARS: { name: string; real: string; note: string }[] = [
  { name: '재료', real: '에이전트', note: '맡은 일, 지시문, 권한을 가진 AI 하나' },
  { name: '레시피', real: '팀 설계', note: '어떤 재료를 쓰고 누가 누구에게 무엇을 넘기는지' },
  { name: '조리법', real: '협업 방식', note: '재료를 따로 익힐지, 한 솥에 끓일지' },
  { name: '주방', real: '실행 도구', note: 'Claude Code, Codex. 불은 여기서 켠다' },
  { name: '주문서', real: '첫 프롬프트', note: '주방에 건네는 "이대로 해 주세요"' },
  { name: '재료비', real: '토큰', note: 'AI가 읽고 쓴 글의 양. 많이 넣을수록 든다' },
];

function Chapter({ no, title, lead, children }: { no: string; title: string; lead: string; children: ReactNode }) {
  return (
    <Reveal className="flex flex-col gap-6">
      <div className="rule h-0.5 bg-foreground" aria-hidden />
      <div className="grid gap-x-10 gap-y-2 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <p className="font-heading text-6xl leading-none font-extrabold text-primary tabular-nums" aria-hidden>
          {no}
        </p>
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-extrabold text-balance">{title}</h2>
          <p className="max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground">{lead}</p>
        </div>
      </div>
      {children}
    </Reveal>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}

// ───────────────────────── 2. 한 냄비 도해 ─────────────────────────

function PotDiagram() {
  const jobs = ['기획', '구현', '검토'];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <figure className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <figcaption className="font-heading text-lg font-extrabold">한 냄비에 다 넣으면</figcaption>
        <div className="relative h-12 overflow-hidden rounded-md border-2 border-foreground">
          <div className="bar-grow absolute inset-y-0 left-0 flex w-[118%]">
            {[...jobs, '기획 수정', '다시 구현'].map((job, index) => (
              <span
                key={job}
                className="flex flex-1 items-center justify-center border-r border-background text-xs font-medium text-background"
                style={{ background: index < 3 ? 'var(--foreground)' : 'var(--primary)' }}
              >
                {job}
              </span>
            ))}
          </div>
        </div>
        <Caption>
          대화 창 하나에 모든 일이 쌓여요. 길어지면 넘치고(앞 내용을 놓치고), 만든 AI가 스스로 검토하니 허점을 잘 못
          봐요.
        </Caption>
      </figure>
      <figure className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <figcaption className="font-heading text-lg font-extrabold">재료마다 그릇을 나누면</figcaption>
        <div className="grid h-12 grid-cols-3 gap-2">
          {jobs.map((job, index) => (
            <div key={job} className="relative overflow-hidden rounded-md border-2 border-foreground">
              <span className="bar-grow absolute inset-y-0 left-0 flex w-3/5 items-center justify-center bg-foreground text-xs font-medium text-background" style={i(index)}>
                {job}
              </span>
            </div>
          ))}
        </div>
        <Caption>
          재료(에이전트)마다 자기 대화 창과 지시문, 권한이 있어요. 맛을 보는 쪽은 볶은 쪽이 아니에요. 대신 그릇 수만큼
          재료비가 들어요.
        </Caption>
      </figure>
    </div>
  );
}

// ───────────────────────── 3. 조리법 도해 ─────────────────────────

function Node({ x, y, r = 17, label, fill = 'var(--card)', text = 'currentColor', index = 0 }: { x: number; y: number; r?: number; label: string; fill?: string; text?: string; index?: number }) {
  return (
    <g className="pop" style={i(index)}>
      <circle cx={x} cy={y} r={r} fill={fill} stroke="currentColor" strokeWidth="2" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={text}>
        {label}
      </text>
    </g>
  );
}

function Arrows({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 10 5 0 10z" fill={color} />
      </marker>
    </defs>
  );
}

function StyleDiagram({ style }: { style: Collaboration }) {
  const color = STYLE_COLORS[style];
  const common = { viewBox: '0 0 240 170', className: 'w-full', role: 'img' as const };
  if (style === 'subagents') {
    return (
      <svg {...common} aria-label="메인 AI가 재료 셋에게 일을 맡기고 결과만 돌려받는 그림">
        <Arrows id="a-sub" color={color} />
        {[50, 120, 190].map((x, index) => (
          <path key={x} className="draw" style={i(index)} pathLength={1} d={`M${120 + (x - 120) * 0.22} 50 L${x - (x - 120) * 0.08} 108`} stroke={color} strokeWidth="2.5" fill="none" markerEnd="url(#a-sub)" markerStart="url(#a-sub)" />
        ))}
        <Node x={120} y={30} r={21} label="주방장" fill="var(--foreground)" text="var(--background)" />
        {[50, 120, 190].map((x, index) => (
          <Node key={x} x={x} y={128} label={['썰기', '볶기', '맛보기'][index]} index={index + 1} />
        ))}
        <text className="pop" style={i(3)} x="120" y="164" textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
          재료끼리는 말하지 않아요
        </text>
      </svg>
    );
  }
  if (style === 'agent-team') {
    const mates: [number, number][] = [
      [44, 124],
      [120, 142],
      [196, 124],
    ];
    return (
      <svg {...common} aria-label="리드와 팀원 셋이 서로 직접 대화하고 할 일 목록을 함께 보는 그림">
        <Arrows id="a-team" color={color} />
        {mates.map(([x, y], index) => (
          <path key={`l${x}`} className="draw" style={i(index)} pathLength={1} d={`M120 50 L${x} ${y - 18}`} stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.45" />
        ))}
        {(
          [
            [mates[0], mates[1]],
            [mates[1], mates[2]],
            [mates[0], mates[2]],
          ] as [[number, number], [number, number]][]
        ).map(([[x1, y1], [x2, y2]], index) => (
          <path key={`m${index}`} className="draw" style={i(index + 2)} pathLength={1} d={`M${x1 + 19} ${y1 + (y2 - y1) * 0.15} L${x2 - 19} ${y2 - (y2 - y1) * 0.15}`} stroke={color} strokeWidth="2.5" fill="none" markerEnd="url(#a-team)" markerStart="url(#a-team)" />
        ))}
        <g className="pop" style={i(4)}>
          <rect x="88" y="74" width="64" height="24" rx="3" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="120" y="90" textAnchor="middle" fontSize="10.5" fontWeight="700">
            할 일 목록
          </text>
        </g>
        <Node x={120} y={30} r={21} label="리드" fill="var(--foreground)" text="var(--background)" />
        {mates.map(([x, y], index) => (
          <Node key={x} x={x} y={y} label={['조사', '구현', '검토'][index]} index={index + 1} />
        ))}
      </svg>
    );
  }
  return (
    <svg {...common} aria-label="대화 창 하나 안에서 역할 셋이 차례로 말하는 그림">
      <Arrows id="a-deb" color={color} />
      <circle className="pop" cx="120" cy="84" r="68" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" />
      <path className="draw" pathLength={1} d="M120 44 A40 40 0 0 1 154.6 104" stroke={color} strokeWidth="2.5" fill="none" markerEnd="url(#a-deb)" />
      <path className="draw" style={i(1)} pathLength={1} d="M146 114 A40 40 0 0 1 94 114" stroke={color} strokeWidth="2.5" fill="none" markerEnd="url(#a-deb)" />
      <path className="draw" style={i(2)} pathLength={1} d="M85.4 104 A40 40 0 0 1 120 44" stroke={color} strokeWidth="2.5" fill="none" markerEnd="url(#a-deb)" />
      <Node x={120} y={40} label="찬성" index={1} />
      <Node x={158} y={108} label="반대" index={2} />
      <Node x={82} y={108} label="사회" index={3} />
      <text className="pop" style={i(3)} x="120" y="166" textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
        솥 하나 = 대화 창 하나
      </text>
    </svg>
  );
}

const STYLE_FACTS: Record<Collaboration, { nick: string; rows: [string, string][]; cost: 1 | 2 | 3 }> = {
  subagents: {
    nick: '따로 손질하기',
    cost: 2,
    rows: [
      ['그릇(대화 창)', '재료마다 하나씩'],
      ['재료끼리 대화', '없음. 결과만 주방장에게'],
      ['어울리는 일', '빨리 끝나는 집중 작업'],
    ],
  },
  'agent-team': {
    nick: '한 주방에서 같이 요리하기',
    cost: 3,
    rows: [
      ['그릇(대화 창)', '팀원마다 하나씩 + 리드'],
      ['재료끼리 대화', '직접 주고받음, 할 일 목록 공유'],
      ['어울리는 일', '서로 반박해야 하는 조사·검토'],
    ],
  },
  debate: {
    nick: '한 솥에 끓이기',
    cost: 1,
    rows: [
      ['그릇(대화 창)', '하나'],
      ['재료끼리 대화', '한 대화 안에서 번갈아'],
      ['어울리는 일', '선택지 따져 보기, 설치 없이 맛보기'],
    ],
  },
};

function StyleLabel({ style, index }: { style: Collaboration; index: number }) {
  const facts = STYLE_FACTS[style];
  return (
    <article className="rise flex flex-col gap-3" style={i(index)}>
      <div className="rounded-xl border bg-card p-3">
        <StyleDiagram style={style} />
      </div>
      <div className="facts text-sm">
        <div className="px-3 py-2">
          <h3 className="flex items-center gap-2 text-xl font-extrabold">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: STYLE_COLORS[style] }} />
            {COLLABORATIONS[style].label}
          </h3>
          <p className="text-muted-foreground">{facts.nick}</p>
        </div>
        <dl className="thick">
          {facts.rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-foreground/25 px-3 py-1.5 last:border-b-0">
              <dt className="shrink-0 font-bold">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="font-bold">재료비</span>
          <span className="flex items-center gap-2">
            <span className="flex gap-1" aria-hidden>
              {[1, 2, 3].map((dot) => (
                <span key={dot} className="size-2.5 rounded-full border border-foreground" style={{ background: dot <= facts.cost ? 'var(--foreground)' : 'transparent' }} />
              ))}
            </span>
            {['가벼움', '보통', '무거움'][facts.cost - 1]}
          </span>
        </div>
        <p className="px-3 py-1.5 text-xs text-muted-foreground">{COLLABORATIONS[style].availability}</p>
      </div>
    </article>
  );
}

// ───────────────────────── 4. 재료비 도표 ─────────────────────────

const HATCH = 'repeating-linear-gradient(135deg, var(--foreground) 0 2px, transparent 2px 7px)';

const BARS: { label: string; note: string; width: number; fill: string; outline?: boolean }[] = [
  { label: 'AI 하나에게 그냥 시킴', note: '기준 (1)', width: 100 / 7, fill: 'var(--foreground)' },
  { label: '토론형', note: '기준과 비슷 (어림)', width: 100 / 7, fill: HATCH, outline: true },
  { label: '서브에이전트, 재료 3가지', note: '재료 수만큼 늘지만 결과만 돌려받음 (어림)', width: (100 / 7) * 3.2, fill: HATCH, outline: true },
  { label: '에이전트 팀', note: '약 7배 (공식 문서, 팀원이 계획 모드일 때)', width: 100, fill: 'var(--primary)' },
];

function CostChart() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6">
      <figcaption className="font-heading text-lg font-extrabold">같은 일을 시켰을 때 드는 토큰</figcaption>
      <div className="flex flex-col gap-3.5">
        {BARS.map((bar, index) => (
          <div key={bar.label} className="grid gap-x-4 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
            <span className="text-sm font-medium">{bar.label}</span>
            <div className="flex flex-col gap-0.5">
              <div className="h-6">
                <div
                  className="bar-grow h-full rounded-sm"
                  style={{ ...i(index), width: `${bar.width}%`, background: bar.fill, outline: bar.outline ? '1.5px solid var(--foreground)' : undefined, outlineOffset: '-1.5px' }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{bar.note}</span>
            </div>
          </div>
        ))}
      </div>
      <Caption>
        색을 채운 막대만 공식 문서의 수치예요. 빗금 막대는 조리법과 재료 수로 가늠한 어림이고, 실제 양은 과제 크기에
        따라 달라져요. 그래서 teamcook은 숫자 대신 가벼움·보통·무거움으로만 표시해요.
      </Caption>
    </figure>
  );
}

const WALLETS: { name: string; real: string; note: string }[] = [
  { name: '월정액 창고', real: '구독 로그인', note: '돈이 더 들지 않아요. 창고(사용 한도)가 비면 채워질 때까지 기다려요.' },
  { name: '그때그때 장보기', real: 'API 키', note: '쓴 토큰만큼 결제돼요. 무거운 조리법일수록 영수증이 길어져요.' },
  { name: '시식 코너', real: '무료 계정', note: '공짜지만 양이 적어요. 무거운 레시피는 중간에 접시가 비어요.' },
];

// ───────────────────────── 5. 가게 밖 ─────────────────────────

function ShopDiagram() {
  const tools = ['칼', '냄비', '냉장고'];
  const shop = (x: number, name: string, index: number) => (
    <g>
      <g className="pop" style={i(index)}>
        <rect x={x} y="24" width="170" height="76" rx="6" fill="var(--card)" stroke="currentColor" strokeWidth="2" />
        <text x={x + 85} y="46" textAnchor="middle" fontSize="13" fill="var(--muted-foreground)">
          {name}
        </text>
        <circle cx={x + 85} cy="72" r="17" fill="var(--foreground)" />
        <text x={x + 85} y="76" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--background)">
          재료
        </text>
      </g>
      <path className="draw" style={i(index + 2)} pathLength={1} d={`M${x + 85} 100 V168`} stroke="currentColor" strokeWidth="2.5" fill="none" markerEnd="url(#a-shop-k)" />
      <text className="pop" style={i(index + 3)} x={x + 95} y="140" fontSize="13" fontWeight="700">
        MCP
      </text>
      {tools.map((tool, at) => (
        <g key={tool} className="pop" style={i(index + 3)}>
          <rect x={x + 6 + at * 54} y="172" width="50" height="26" rx="3" fill="var(--secondary)" stroke="currentColor" strokeWidth="1.5" />
          <text x={x + 31 + at * 54} y="190" textAnchor="middle" fontSize="12">
            {tool}
          </text>
        </g>
      ))}
    </g>
  );
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4">
      <svg viewBox="0 0 560 214" className="w-full min-w-[32rem]" role="img" aria-label="두 가게의 재료가 A2A로 주문을 주고받고, 각 재료는 MCP로 자기 도구를 쓰는 그림">
        <Arrows id="a-shop" color="var(--primary)" />
        <Arrows id="a-shop-k" color="currentColor" />
        {shop(20, '우리 가게', 0)}
        {shop(370, '옆 가게', 1)}
        <path className="draw" style={i(1)} pathLength={1} d="M196 62 H364" stroke="var(--primary)" strokeWidth="3" fill="none" markerEnd="url(#a-shop)" markerStart="url(#a-shop)" />
        <g className="pop" style={i(2)}>
          <text x="280" y="50" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--primary)">
            A2A
          </text>
          <text x="280" y="84" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
            메뉴판 보고 주문,
          </text>
          <text x="280" y="100" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
            요리를 돌려받음
          </text>
        </g>
      </svg>
    </div>
  );
}

const A2A_TERMS: [string, string, string][] = [
  ['메뉴판', 'Agent Card', '이 재료가 누구고, 어디로 연락하고, 무엇을 할 수 있는지 적은 JSON 문서'],
  ['주문', 'Task', '고유 번호와 진행 상태가 있는 일 한 건'],
  ['주고받는 말', 'Message', '주문한 쪽과 받은 쪽 사이의 대화 한 번'],
  ['완성된 요리', 'Artifact', '일을 하며 만들어 낸 결과물 (문서, 이미지, 데이터)'],
];

// ───────────────────────── 6. 고르기 ─────────────────────────

const STEPS: { ask: string; yes: string; style?: Collaboration; cost: string }[] = [
  { ask: '혼자 해도 되는 일인가요?', yes: 'AI 하나에게 시키기. 따져 볼 관점이 여럿이면 토론형', style: 'debate', cost: '가벼움' },
  { ask: '나눠 맡기고 결과만 받으면 되나요?', yes: '서브에이전트', style: 'subagents', cost: '보통' },
  { ask: '맡은 쪽끼리 발견을 나누고 반박해야 하나요?', yes: '에이전트 팀', style: 'agent-team', cost: '무거움' },
];

export function ConceptsPage() {
  return (
    <div className="flex flex-col gap-16 pb-6">
      <header className="flex flex-col gap-3 pt-4 sm:pt-8">
        <h1 className="text-5xl font-extrabold sm:text-7xl">재료 사전</h1>
        <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
          멀티 에이전트, 에이전트 팀, A2A. 낯선 말들을 찬장에서 하나씩 꺼내 봅니다.
        </p>
      </header>

      <Reveal className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {JARS.map((jar, index) => (
          <div key={jar.name} className="rise flex flex-col border-2 border-foreground bg-card" style={i(index)}>
            <div className="h-2.5 bg-foreground" aria-hidden />
            <div className="flex flex-1 flex-col gap-1 px-4 pt-3 pb-4">
              <p className="font-heading text-3xl font-extrabold sm:text-4xl">{jar.name}</p>
              <p className="text-sm font-bold text-primary">{jar.real}</p>
              <p className="mt-1 border-t border-dashed border-input pt-2 text-sm text-pretty text-muted-foreground">{jar.note}</p>
            </div>
          </div>
        ))}
      </Reveal>

      <Chapter no="1" title="왜 재료를 나눌까" lead="멀티 에이전트는 일을 역할로 나눠 AI 여러 개에게 맡기는 방식이에요.">
        <PotDiagram />
        <Caption>
          나눈다고 늘 좋은 것은 아니에요. 차례로 이어지는 일, 같은 파일을 여럿이 고치는 일은 한 대화나 서브에이전트가
          낫다고 Claude Code 문서도 말해요.
        </Caption>
      </Chapter>

      <Chapter no="2" title="익히는 법 세 가지" lead="같은 재료라도 조리법에 따라 누가 누구와 이야기하는지, 재료비가 얼마나 드는지가 달라져요.">
        <div className="grid gap-6 md:grid-cols-3">
          {(['subagents', 'agent-team', 'debate'] as const).map((style, index) => (
            <StyleLabel key={style} style={style} index={index} />
          ))}
        </div>
        <Caption>
          에이전트 팀은 Claude Code의 실험 기능이라 기본으로 꺼져 있어요. teamcook이 내보내는 zip에 켜는 설정이 들어
          있어요. "토론형"은 설정 파일 없이 프롬프트 하나로 하는 방식에 teamcook이 붙인 이름이에요.
        </Caption>
      </Chapter>

      <Chapter no="3" title="재료비는 얼마나 들까" lead="AI는 읽은 글과 쓴 글을 토큰이라는 조각으로 세요. 그릇을 나누면 그릇마다 지시문과 자료를 따로 읽으니 토큰이 늘어요.">
        <CostChart />
        <div className="grid gap-3 md:grid-cols-3">
          {WALLETS.map((wallet, index) => (
            <div key={wallet.name} className="rise flex flex-col gap-1 rounded-xl border bg-card p-4" style={i(index)}>
              <p className="font-heading text-xl font-extrabold">{wallet.name}</p>
              <p className="text-sm font-bold text-primary">{wallet.real}</p>
              <p className="text-sm text-pretty text-muted-foreground">{wallet.note}</p>
            </div>
          ))}
        </div>
        <Caption>
          어디서 장을 보는지는{' '}
          <a className="underline underline-offset-2 hover:text-primary" href="#/plans">
            내 AI 현황
          </a>
          에서 정해져요. 첫 화면의 주문서는 이것과 "사용량 여유"를 함께 따져 레시피를 권해요.
        </Caption>
      </Chapter>

      <Chapter no="4" title="가게 밖과 거래하기" lead="여기까지는 한 주방 안의 이야기였어요. A2A는 가게와 가게를 잇고, MCP는 재료와 조리 도구를 이어요.">
        <ShopDiagram />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <caption className="border-b px-4 py-2.5 text-left font-heading text-lg font-extrabold">A2A에서 오가는 것</caption>
              <tbody>
                {A2A_TERMS.map(([name, real, note]) => (
                  <tr key={real} className="border-b align-top last:border-b-0">
                    <th className="px-4 py-2.5 font-heading text-base font-extrabold whitespace-nowrap">{name}</th>
                    <td className="py-2.5 pr-4 font-bold whitespace-nowrap text-primary">{real}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="facts text-sm">
            <p className="px-3 py-2 font-heading text-lg font-extrabold">A2A와 MCP</p>
            <dl className="thick">
              {(
                [
                  ['A2A', '가로로 잇는다', '재료 ↔ 다른 가게의 재료'],
                  ['MCP', '세로로 깊게 한다', '재료 → 자기 도구와 자료'],
                ] as const
              ).map(([name, direction, what]) => (
                <div key={name} className="grid grid-cols-[3.5rem_1fr] gap-x-3 border-b border-foreground/25 px-3 py-2 last:border-b-0">
                  <dt className="font-extrabold">{name}</dt>
                  <dd>
                    {direction}
                    <span className="block text-muted-foreground">{what}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="px-3 py-2 text-muted-foreground">둘은 경쟁하지 않고 함께 써요. A2A는 공개 표준이고 Linux Foundation이 관리해요.</p>
          </div>
        </div>
        <div className="rounded-xl border-2 border-dashed border-input p-4 text-sm">
          <p className="font-heading text-lg font-extrabold">헷갈리기 쉬운 것</p>
          <ul className="mt-1.5 grid gap-x-8 gap-y-1.5 text-muted-foreground md:grid-cols-3">
            <li>teamcook의 역할 카드는 A2A의 메뉴판(Agent Card)이 아니에요. 한 주방 안에서 쓰는 설정 파일이 돼요.</li>
            <li>에이전트 팀의 팀원끼리 대화는 Claude Code 안의 기능이에요. A2A가 아니에요.</li>
            <li>teamcook은 A2A와 MCP를 설정하거나 실행하지 않아요. 여기서는 뜻만 알려 드려요.</li>
          </ul>
        </div>
      </Chapter>

      <Chapter no="5" title="그래서 오늘은 뭘 해 먹지" lead="위에서부터 물어보고, 처음으로 '네'가 나오는 곳에서 멈추세요. 가벼운 것부터 확인하는 것이 공식 문서의 조언이에요.">
        <ol className="flex flex-col">
          {STEPS.map((step, index) => (
            <li key={step.ask} className="rise grid gap-x-6 gap-y-2 border-b border-dashed border-input py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center" style={i(index)}>
              <p className="font-heading text-xl font-extrabold text-balance">{step.ask}</p>
              <p className="flex items-center gap-2 text-sm font-bold text-primary">
                네
                <svg viewBox="0 0 48 12" className="h-3 w-12" aria-hidden>
                  <path className="draw" style={i(index)} pathLength={1} d="M0 6 H42" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M40 1 47 6 40 11z" fill="currentColor" />
                </svg>
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
                {step.style ? <span aria-hidden className="size-2.5 rounded-full" style={{ background: STYLE_COLORS[step.style] }} /> : null}
                <span className="font-medium">{step.yes}</span>
                <span className="text-sm text-muted-foreground">재료비 {step.cost}</span>
              </p>
              {index < STEPS.length - 1 ? <p className="text-sm text-muted-foreground md:col-span-3">아니오면 아래로</p> : null}
            </li>
          ))}
        </ol>
        <p>
          <a className="font-heading text-xl font-extrabold text-primary underline decoration-2 underline-offset-4" href="#/">
            주문서에 하고 싶은 작업 적으러 가기
          </a>
        </p>
      </Chapter>

      <footer className="flex flex-col gap-1.5 border-t pt-4 text-xs text-muted-foreground">
        <p>사실로 적은 내용은 아래 공식 문서를 근거로 했어요. 자주 바뀌는 분야라 중요한 결정 전에는 원문을 보세요.</p>
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
