// 어느 회사 AI인지 한눈에 알아보게 하는 작은 로고. 색은 한 가지(글자색)로만 그린다 (디자인 규칙: 포인트 색은 토마토 하나).
import { ClipboardCopy, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { providerData } from '@/data/providers';
import type { EngineId, ProviderId } from '@/types';
import { BRAND_PATHS } from './brandPaths';

export function BrandLogo({ provider, className }: { provider: ProviderId; className?: string }) {
  const name = providerData.providers[provider].productName;
  if (provider === 'xai') {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn('inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-foreground font-heading text-[0.6rem] leading-none font-extrabold text-background', className)}
      >
        G
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={name} className={cn('size-4 shrink-0 fill-current', className)}>
      <path d={BRAND_PATHS[provider]} />
    </svg>
  );
}

/** 엔진의 로고. API 직접 호출·수동은 회사가 정해져 있지 않아 아이콘으로 */
export function EngineLogo({ engine, className }: { engine: EngineId; className?: string }) {
  const provider = providerData.engines[engine]?.provider;
  if (provider) return <BrandLogo provider={provider} className={className} />;
  const Icon = engine === 'api' ? KeyRound : ClipboardCopy;
  return <Icon className={cn('size-4 shrink-0', className)} aria-label={providerData.engines[engine]?.name ?? engine} />;
}
