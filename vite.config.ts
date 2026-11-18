import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Windows에서 터미널의 드라이브 문자가 소문자(c:\...)이면 같은 파일(react 등)을 서로 다른 모듈로 보고
// 두 번 묶어서, 빌드한 화면이 "Cannot read properties of null (reading 'useState')"로 하얗게 뜬다.
// 기준 폴더의 드라이브 문자를 대문자로 맞춰 막는다 (scripts/vitest.mjs와 같은 문제).
const root = import.meta.dirname.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(root, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
