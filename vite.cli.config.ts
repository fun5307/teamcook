// 명령줄 도구(cli/teamcook.mjs) 빌드 설정.
// 웹사이트와 같은 변환 코드를 그대로 써서, 설치 없이 실행되는 파일 하나로 묶는다.
//   npm run build:cli
import path from 'node:path';
import { defineConfig } from 'vite';

// Windows 소문자 드라이브 문자 문제를 피한다 (vite.config.ts 참고)
const root = import.meta.dirname.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

export default defineConfig({
  root,
  // public/ 폴더(사이트용 파일)를 cli/로 복사하지 않는다
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(root, './src') },
  },
  // 필요한 라이브러리(lz-string, smol-toml, yaml, jszip)를 파일 안에 모두 넣는다
  ssr: { noExternal: true },
  build: {
    ssr: 'src/cli/main.ts',
    outDir: 'cli',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: { entryFileNames: 'teamcook.mjs', banner: '#!/usr/bin/env node' },
    },
  },
});
