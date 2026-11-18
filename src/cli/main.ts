// teamcook 명령줄 도구.
//   node teamcook.mjs add "<공유 링크>" [--dir <폴더>] [--force] [--codex-bridge] [--dry-run]  — 레시피를 지금 폴더에 설치
//   node teamcook.mjs open [--port <번호>] [--no-browser]                                     — 내 컴퓨터 도우미를 켠다
// 에이전트를 실행하지는 않는다.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planInstall } from './install';
import { startLocalServer } from './local/server';

const HELP = `teamcook — AI 팀을 레시피로 요리하세요

사용법:
  node teamcook.mjs open                 내 컴퓨터 도우미를 켜고 브라우저로 teamcook을 연다
  node teamcook.mjs add "<공유 링크>" [옵션]   레시피를 지금 폴더에 설치한다

open 옵션:
  --port <번호>     도우미가 쓸 포트 (기본: 4417, 쓰이고 있으면 다음 번호)
  --no-browser      브라우저를 저절로 열지 않는다
  --ui <폴더>       화면 파일 폴더 (기본: 이 파일 옆의 ../dist)

add 옵션:
  --dir <폴더>      설치할 프로젝트 폴더 (기본: 지금 폴더)
  --force           같은 이름의 에이전트 파일이 있으면 덮어쓴다
  --codex-bridge    Claude Code에서 Codex 담당 에이전트를 codex exec로 부르게 설치한다 (실험적)
  --dry-run         실제로 쓰지 않고 무엇을 쓸지만 보여 준다

링크에는 #이 들어 있으니 꼭 따옴표로 감싸 주세요.
`;

function openBrowser(url: string) {
  const [command, args] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(command, args as string[], { stdio: 'ignore', detached: true }).unref();
  } catch {
    // 브라우저를 열지 못해도 주소는 터미널에 나와 있다
  }
}

async function open(rest: string[]): Promise<number> {
  let port = 4417;
  let browser = true;
  let uiDir = fileURLToPath(new URL('../dist/', import.meta.url));
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--port') port = Number(rest[(i += 1)]) || port;
    else if (rest[i] === '--no-browser') browser = false;
    else if (rest[i] === '--ui') uiDir = path.resolve(rest[(i += 1)] ?? '.');
  }
  if (!existsSync(path.join(uiDir, 'index.html'))) {
    console.error(`화면 파일을 찾지 못했어요: ${uiDir}
저장소에서 먼저 npm run build 를 실행해 주세요.`);
    return 1;
  }
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const server = await startLocalServer({
    uiDir,
    port,
    claudeProjects: path.join(claudeHome, 'projects'),
    codexSessions: path.join(codexHome, 'sessions'),
  });
  const url = `${server.url}?key=${server.key}#/team`;
  console.log(`teamcook 도우미가 켜졌어요.

  주소: ${url}

읽는 곳 (대화 기록 파일 .jsonl·.jsonl.zst만, 읽기만):
  - ${path.join(claudeHome, 'projects')}
  - ${path.join(codexHome, 'sessions')}
쓰는 곳: 화면에서 고른 프로젝트의 .claude/agents, .codex/agents, .teamcook/ 뿐이에요.
인증·설정 파일은 열지 않고, AI를 실행하지 않고, 아무것도 바깥으로 보내지 않아요.

끝내려면 이 창에서 Ctrl+C를 누르세요.`);
  if (browser) openBrowser(url);
  await new Promise<void>((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await server.close();
  console.log('\n도우미를 껐어요.');
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (command === 'open') return open(rest);
  if (command !== 'add') {
    console.error(`알 수 없는 명령이에요: ${command}\n`);
    console.log(HELP);
    return 1;
  }

  let link = '';
  let dir = process.cwd();
  let force = false;
  let codexBridge = false;
  let dryRun = false;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--force') force = true;
    else if (arg === '--codex-bridge') codexBridge = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--dir') dir = path.resolve(rest[(i += 1)] ?? '.');
    else if (!link) link = arg;
  }
  if (!link) {
    console.error('공유 링크를 넣어 주세요. 예: node teamcook.mjs add "https://…/#r=…"');
    return 1;
  }

  const plan = planInstall(link, { codexBridge });
  if (!plan.ok) {
    console.error(`설치할 수 없어요: ${plan.error}`);
    return 1;
  }

  console.log(`레시피: ${plan.recipe.title} (에이전트 ${plan.recipe.cards.length}개)`);
  console.log(`설치 위치: ${dir}\n`);
  let skipped = 0;
  const hints: string[] = [];
  for (const file of plan.files) {
    const target = path.join(dir, file.path);
    // 안전장치: 설치 폴더 밖으로 나가는 경로는 쓰지 않는다
    if (!path.resolve(target).startsWith(path.resolve(dir) + path.sep)) continue;
    const exists = existsSync(target);
    if (exists && (file.neverOverwrite || !force)) {
      skipped += 1;
      if (file.mergeHint) hints.push(file.mergeHint);
      console.log(`  건너뜀 (이미 있음)  ${file.path}`);
      continue;
    }
    if (!dryRun) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, file.content, 'utf8');
    }
    console.log(`  ${dryRun ? '쓸 예정' : exists ? '덮어씀' : '만듦'}  ${file.path}`);
  }

  if (skipped > 0) {
    console.log('\n이미 있는 파일은 건드리지 않았어요. 덮어쓰려면 --force를 붙이세요.');
    for (const hint of hints) console.log(`- ${hint}`);
  }
  console.log('\n다음 단계: 실행 방법과 첫 프롬프트는 .teamcook/ 안의 RECIPE.md에 있어요.');
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
    if (code === 0) process.exit(0);
  },
  (error: Error) => {
    console.error(`도우미를 켜지 못했어요: ${error.message}`);
    process.exitCode = 1;
  },
);
