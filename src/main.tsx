import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useWorkspace } from './store/useWorkspace';

// 개발할 때만: 자동 검사에서 폴더 고르기 창 없이 폴더를 열 수 있게 한다 (배포본에는 들어가지 않는다)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__teamcookOpen = (handle: never) => useWorkspace.getState().openWith(handle);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
