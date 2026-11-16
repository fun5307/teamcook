// teamcook 명령줄 도구: 공유 링크의 레시피를 지금 폴더(프로젝트)에 설치한다.
//   node teamcook.mjs add "<공유 링크>" [--dir <폴더>] [--force] [--codex-bridge] [--dry-run]
// 에이전트를 실행하지는 않는다. 설정 파일만 쓴다.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { planInstall } from './install';

const HELP = `teamcook — AI 팀을 레시피로 요리하세요

사용법:
  node teamcook.mjs add "<공유 링크>" [옵션]

옵션:
  --dir <폴더>      설치할 프로젝트 폴더 (기본: 지금 폴더)
  --force           같은 이름의 에이전트 파일이 있으면 덮어쓴다
  --codex-bridge    Claude Code에서 Codex 담당 에이전트를 codex exec로 부르게 설치한다 (실험적)
  --dry-run         실제로 쓰지 않고 무엇을 쓸지만 보여 준다

링크에는 #이 들어 있으니 꼭 따옴표로 감싸 주세요.
`;

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return 0;
  }
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

process.exitCode = main(process.argv.slice(2));
