// Vitest 실행 도우미.
// Windows에서 작업 폴더의 드라이브 문자가 소문자(c:\...)이면 Vitest 5가
// 자기 모듈을 두 번 불러와 "Cannot read properties of undefined (reading 'config')"로 실패한다.
// 그래서 드라이브 문자를 대문자로 바꾼 경로에서 Vitest를 다시 띄운다.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const entry = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
