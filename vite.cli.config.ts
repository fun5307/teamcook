// 명령줄 도구(cli/teamcook.mjs) 빌드 설정.
// 웹사이트와 같은 변환 코드를 그대로 써서, 설치 없이 실행되는 파일 하나로 묶는다.
//   npm run build:cli
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
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
