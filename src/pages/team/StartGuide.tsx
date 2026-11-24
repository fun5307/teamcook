// 레시피를 폴더에 들인 직후에 보이는 "시작하기" 안내.
// 시작 명령과 프롬프트('할 일'까지 채운 것)를 복사해 터미널에 붙여 넣기만 하면 되게 준비해 준다.
// teamcook은 실행하지 않는다. 터미널을 열거나 프롬프트를 대신 넣어 주지 않고, 복사까지만 한다.

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/common';
import { AGENT_TEAMS_MERGE_HINT, collaborationOf } from '@/data/collaboration';
import { copyText } from '@/lib/download';
import { START_TOOL_LABELS, startCommandLines, startPrompt, startTools, type StartTool } from '@/lib/startGuide';
import type { Recipe } from '@/types';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <Button size="sm" variant="outline" onClick={async () => setCopied(await copyText(text))}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied === null ? label : copied ? '복사했어요' : '복사하지 못했어요. 직접 선택해 복사해 주세요'}
    </Button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

export function StartGuide({
  recipe,
  projectPath,
  settingsSkipped,
}: {
  recipe: Recipe;
  /** 프로젝트의 전체 경로. 도우미가 띄운 화면에서만 안다 */
  projectPath: string | null;
  /** 에이전트 팀 설정(.claude/settings.json)이 이미 있어 새로 만들지 못했는가 */
  settingsSkipped: boolean;
}) {
  const tools = startTools(recipe);
  const [tool, setTool] = useState<StartTool>(tools[0] ?? 'claude');
  const box = useRef<HTMLElement>(null);
  // 팀원 목록 아래에 나타나므로, 들이자마자 눈에 들어오게 화면으로 가져온다
  useEffect(() => {
    box.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const [task, setTask] = useState('');
  const style = collaborationOf(recipe);
  const prompt = startPrompt(recipe, task);
  const lines = startCommandLines(tool, projectPath);
  const toolName = START_TOOL_LABELS[tool];
  const sampleTask = recipe.sampleTask?.trim();

  return (
    <section ref={box} className="flex flex-col gap-4 rounded-2xl border-2 border-primary/40 bg-card p-5" aria-label="시작하기">
      <div>
        <h3 className="font-heading text-lg font-extrabold">이제 시작해 볼까요? — {recipe.title}</h3>
        <p className="text-sm text-muted-foreground">
          팀원 파일은 넣었어요. 아래를 복사해 붙여 넣으면 바로 일을 맡길 수 있어요. (teamcook은 대신 실행하지 않아요)
        </p>
      </div>

      {style === 'agent-team' && settingsSkipped ? <Notice tone="warn">{AGENT_TEAMS_MERGE_HINT}</Notice> : null}

      <ol className="flex flex-col gap-4">
        {tools.length > 0 ? (
          <Step n={1} title={`${toolName}를 이 프로젝트 폴더에서 시작하기`}>
            {tools.length > 1 ? (
              <div className="flex gap-2" role="group" aria-label="시작할 도구">
                {tools.map((item) => (
                  <Button key={item} size="sm" variant={item === tool ? 'default' : 'outline'} aria-pressed={item === tool} onClick={() => setTool(item)}>
                    {START_TOOL_LABELS[item]}
                  </Button>
                ))}
              </div>
            ) : null}
            <pre className="overflow-auto rounded-lg bg-muted p-3 font-mono text-sm">{lines.join('\n')}</pre>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton key={lines.join('\n')} text={lines.join('\n')} label="명령 복사" />
              {projectPath === null ? (
                <span className="text-xs text-muted-foreground">프로젝트 폴더의 전체 경로를 몰라요. 터미널을 그 폴더에서 연 뒤 붙여 넣으세요.</span>
              ) : null}
            </div>
            {style === 'agent-team' ? (
              <p className="text-xs text-muted-foreground">Claude Code를 이미 열어 두었다면 한 번 닫고 새로 시작하세요. 설정은 새로 시작해야 적용돼요.</p>
            ) : null}
          </Step>
        ) : null}

        <Step n={tools.length > 0 ? 2 : 1} title={style === 'debate' ? '맡길 주제 쓰기' : '맡길 일 쓰기'}>
          <Input
            aria-label={style === 'debate' ? '맡길 주제' : '맡길 일'}
            value={task}
            placeholder={sampleTask ? `예: ${sampleTask}` : style === 'debate' ? '결정하고 싶은 것' : '예: 로그인 버그 고치기'}
            onChange={(event) => setTask(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">비워 두면 프롬프트에 "(여기에 … 적으세요)"가 남아요. 붙여 넣은 뒤 직접 고쳐도 돼요.</p>
        </Step>

        <Step
          n={tools.length > 0 ? 3 : 2}
          title={style === 'debate' ? '프롬프트를 쓰는 AI 채팅에 붙여 넣기' : `프롬프트를 복사해 ${toolName} 창에 붙여 넣기`}
        >
          <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">{prompt}</pre>
          <div>
            <CopyButton key={prompt} text={prompt} label="프롬프트 복사" />
          </div>
        </Step>
      </ol>
    </section>
  );
}
