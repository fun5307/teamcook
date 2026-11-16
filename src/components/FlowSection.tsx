// 흐름 캔버스를 필요할 때만 불러온다 (React Flow가 커서 첫 화면 용량을 줄이기 위해).

import { Suspense, lazy, type ComponentProps } from 'react';

const FlowCanvas = lazy(() => import('./FlowCanvas'));

export function FlowSection(props: ComponentProps<typeof FlowCanvas>) {
  if (props.recipe.cards.length === 0) return null;
  return (
    <Suspense
      fallback={
        <div className="flex h-60 items-center justify-center rounded-2xl border bg-muted/30 text-sm text-muted-foreground">
          흐름 그림을 불러오는 중…
        </div>
      }
    >
      <FlowCanvas {...props} />
    </Suspense>
  );
}
