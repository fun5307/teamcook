// 화면에 들어오면 한 번 .is-in 을 붙여, CSS의 '선이 그어지는' 효과를 시작한다 (src/index.css의 .reveal).
// 움직임을 줄이도록 설정한 사람에게는 CSS가 처음부터 다 보이게 한다.

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Reveal({ className, children, ...props }: ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  return (
    <div ref={ref} className={cn('reveal', seen && 'is-in', className)} {...props}>
      {children}
    </div>
  );
}
