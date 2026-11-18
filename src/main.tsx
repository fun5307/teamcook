import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initLocal, localDir } from './lib/local/client';
import { useWorkspace } from './store/useWorkspace';

// 개발할 때만: 자동 검사에서 폴더 고르기 창 없이 폴더를 열 수 있게 한다 (배포본에는 들어가지 않는다)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__teamcookOpen = (handle: never) => useWorkspace.getState().openWith(handle);
}

// 내 컴퓨터 도우미가 띄운 화면인지 먼저 알아본다 (웹사이트에서는 열쇠가 없어 바로 넘어간다).
// 도우미에 이미 열어 둔 프로젝트가 있으면(새로고침) 그대로 다시 연다.
void initLocal().then(async (info) => {
  if (info?.project) await useWorkspace.getState().openWith(localDir('project', info.project.name));
}).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
