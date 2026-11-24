// 작업실 소개 (#/workshop, 웹에서만): 이미 Claude Code·Codex로 팀을 돌리는 사람을 위한 '내 컴퓨터 도우미' 안내.
// 작업실 자체는 teamcook open으로 내 컴퓨터에서 열린다. 웹에서는 설치 없이 맛보기(Chrome·Edge 폴더 열기)만 된다.
// 여는 법은 npm에 올린 패키지를 npx로 실행하는 한 줄이다 (npm publish 뒤에 이 문구를 쓴다).

import { OpenProjectPanel } from '@/pages/team/TeamPage';

const DOES: { title: string; body: string }[] = [
  { title: '팀원 보기·고치기', body: '숨김 폴더(.claude/agents, .codex/agents) 속 역할 파일을 팀원 카드로 보여 주고, 고치면 그 파일에 바로 저장해요.' },
  { title: '업무 일지', body: '누구에게 무엇을 시켰고 무엇을 돌려받았는지, 시간과 토큰까지. AI가 일하는 동안 저절로 갱신돼요.' },
  { title: '최근 프로젝트', body: 'Claude Code·Codex 기록에서 최근에 AI를 쓴 프로젝트를 찾아 줘요. 폴더를 하나씩 고르지 않아도 돼요.' },
];

const COMPARE: { label: string; local: string; browser: string }[] = [
  { label: '여는 법', local: '터미널에서 명령 한 줄', browser: '이 사이트에서 폴더 고르기' },
  { label: '브라우저', local: '아무 브라우저', browser: 'Chrome·Edge만' },
  { label: '업무 일지', local: '저절로 갱신, Codex 압축 기록도 읽음', browser: '기록 폴더를 직접 고름, 다시 읽기를 눌러야 갱신' },
  { label: '최근 프로젝트 찾기', local: '됨', browser: '안 됨' },
];

export function WorkshopPage() {
  return (
    <div className="flex flex-col gap-10 pt-2 sm:pt-4">
      <div className="flex max-w-2xl flex-col gap-3">
        <p className="text-sm font-medium text-primary">이미 팀을 돌리는 분께</p>
        <h1 className="text-4xl font-extrabold sm:text-5xl">작업실</h1>
        <p className="text-base leading-relaxed text-pretty">
          AI 팀을 부리는 사람의 사무실이에요. 일은 지금처럼 Claude Code·Codex(또는 T3 Code)에서 시키고, 팀을 보고 고치고 보고받는 것은
          여기서 해요. 작업실은 <b>내 컴퓨터에서</b> 열려요.
        </p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {DOES.map((item) => (
          <li key={item.title} className="flex flex-col gap-1.5 rounded-2xl border bg-card p-5">
            <span className="font-heading text-xl font-extrabold">{item.title}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{item.body}</span>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3" aria-label="작업실 여는 법">
        <h2 className="text-2xl font-extrabold">여는 법</h2>
        <p className="text-sm text-muted-foreground">
          터미널에서 한 줄이면 돼요. Node.js가 필요해요(20 이상, 22.15 이상이면 Codex의 압축된 옛 기록도 읽어요).
        </p>
        <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-sm leading-relaxed text-background">
          {`npx teamcook open      # 브라우저가 열려요. 끝낼 때는 터미널에서 Ctrl+C`}
        </pre>
        <p className="text-xs leading-relaxed text-muted-foreground">
          작업실은 이 컴퓨터 안에서만 열려요. 대화 기록은 ~/.claude/projects와 ~/.codex/sessions의 기록 파일만 읽기만 하고, 쓰는 곳은 고른
          프로젝트의 역할 폴더뿐이에요. 인증·설정 파일은 열지 않고, AI를 실행하지 않고, 아무것도 바깥으로 보내지 않아요.
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-label="설치 없이 맛보기">
        <div>
          <h2 className="text-2xl font-extrabold">설치 없이 맛보기</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chrome이나 Edge라면 이 사이트에서 폴더를 직접 골라 팀원과 업무 일지를 볼 수 있어요.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium" />
                <th className="px-4 py-2 font-medium">작업실 (내 컴퓨터)</th>
                <th className="px-4 py-2 font-medium">맛보기 (이 사이트)</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-b last:border-b-0">
                  <th className="px-4 py-2 font-medium">{row.label}</th>
                  <td className="px-4 py-2">{row.local}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.browser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="max-w-md">
          <OpenProjectPanel compact />
        </div>
      </section>
    </div>
  );
}
