// 실행 경로(①~④, 🔒, 대안)와 '필요한 플랜' 배지를 그리는 부품들.
// 판단은 전부 lib/resolvePath.ts, lib/requiredPlans.ts가 하고, 여기서는 그리기만 한다.

import { ArrowRight, Lightbulb, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { providerData } from '@/data/providers';
import type { RequiredPlans } from '@/lib/requiredPlans';
import {
  PATH_NAMES,
  PATH_SYMBOLS,
  type PathResolution,
  type RecipeResolution,
} from '@/lib/resolvePath';
import type { EngineId, PathLevel } from '@/types';

const PATH_STYLES: Record<PathLevel, string> = {
  1: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  2: 'border-sky-200 bg-sky-50 text-sky-800',
  3: 'border-amber-200 bg-amber-50 text-amber-800',
  4: 'border-zinc-200 bg-zinc-100 text-zinc-700',
};

const pill = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export function engineName(engine: EngineId): string {
  return providerData.engines[engine]?.name ?? engine;
}

/** ① 구독 로그인 같은 경로 배지 */
export function PathBadge({ path, short = false }: { path: PathLevel; short?: boolean }) {
  return (
    <span className={cn(pill, PATH_STYLES[path])} title={PATH_NAMES[path]}>
      <span aria-hidden>{PATH_SYMBOLS[path]}</span>
      {short ? <span className="sr-only">{PATH_NAMES[path]}</span> : PATH_NAMES[path]}
    </span>
  );
}

export function LockBadge() {
  return (
    <span className={cn(pill, 'border-rose-200 bg-rose-50 text-rose-800')}>
      <Lock className="size-3" aria-hidden />
      잠김
    </span>
  );
}

/** 카드 한 장의 실행 경로 설명. onApplyAlternative를 주면 '바꾸기' 버튼이 나온다. */
export function CardRoute({
  resolution,
  onApplyAlternative,
}: {
  resolution: PathResolution;
  onApplyAlternative?: (engine: EngineId) => void;
}) {
  const { alternative } = resolution;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {resolution.locked ? (
        <div className="flex flex-wrap items-center gap-2">
          <LockBadge />
          <span className="text-rose-900">{resolution.lockReason}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <PathBadge path={resolution.path} />
          <span className="text-muted-foreground">
            {engineName(resolution.engine)} · {resolution.label}
          </span>
        </div>
      )}

      {alternative ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5',
            alternative.kind === 'fallback'
              ? 'border-emerald-200 bg-emerald-50/60'
              : 'border-sky-200 bg-sky-50/60',
          )}
        >
          {alternative.kind === 'fallback' ? (
            <ArrowRight className="size-4 shrink-0 text-emerald-700" aria-hidden />
          ) : (
            <Lightbulb className="size-4 shrink-0 text-sky-700" aria-hidden />
          )}
          <span className="min-w-0 flex-1">{alternative.reason}</span>
          <PathBadge path={alternative.path} short />
          {onApplyAlternative ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onApplyAlternative(alternative.engine)}
            >
              {engineName(alternative.engine)}로 바꾸기
            </Button>
          ) : null}
        </div>
      ) : null}

      {resolution.notes.length > 0 ? (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {resolution.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "내 플랜으로 이 레시피를 돌리면 …" 한 줄 요약 */
export function RecipeRunSummary({
  resolution,
  lead = '내 플랜으로 이 레시피를 돌리면',
}: {
  resolution: RecipeResolution;
  lead?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 px-4 py-3">
      <p className="text-sm">
        <span className="text-muted-foreground">{lead} → </span>
        <strong className="font-semibold">{resolution.summary}</strong>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {([1, 2, 3, 4] as PathLevel[])
          .filter((path) => resolution.counts[path] > 0)
          .map((path) => (
            <span key={path} className={cn(pill, PATH_STYLES[path])}>
              {PATH_SYMBOLS[path]} {PATH_NAMES[path]} × {resolution.counts[path]}
            </span>
          ))}
      </div>
      {resolution.crossReview === 'ok' ? (
        <p className="text-xs text-emerald-800">
          ✅ 교차 검토: 작성자와 검토자가 서로 다른 회사 모델이에요.
        </p>
      ) : null}
      {resolution.crossReview === 'same-provider' ? (
        <p className="text-xs text-amber-800">
          ⚠️ 작성자와 검토자가 같은 회사 모델이에요. 다른 회사 모델로 검토하면 놓치는 게 줄어요.
        </p>
      ) : null}
    </div>
  );
}

/** '필요한 플랜' 배지 묶음 */
export function PlanBadges({ required, showDate = false }: { required: RequiredPlans; showDate?: boolean }) {
  if (required.details.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {required.details.map((badge) => (
        <span
          key={badge.engine}
          title={badge.notes.join(' ')}
          className={cn(
            pill,
            badge.free
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-orange-200 bg-orange-50 text-orange-800',
          )}
        >
          {badge.text}
        </span>
      ))}
      {showDate ? (
        <span className="text-xs text-muted-foreground">{providerData.lastVerified} 확인</span>
      ) : null}
    </div>
  );
}

const FIT_LABELS = {
  full: { text: '내 플랜으로 그대로 가능', style: 'text-emerald-700' },
  'with-alternatives': { text: '대안 도구로 바꾸면 가능', style: 'text-sky-700' },
  no: { text: '내 플랜으로는 어려워요', style: 'text-rose-700' },
};

/** 갤러리 카드에 붙는 '내 플랜에 맞는지' 표시 */
export function FitLabel({ fit }: { fit: keyof typeof FIT_LABELS }) {
  const { text, style } = FIT_LABELS[fit];
  const icon = fit === 'full' ? '✅' : fit === 'with-alternatives' ? '🔁' : '🔒';
  return (
    <span className={cn('text-xs font-medium', style)}>
      {icon} {text}
    </span>
  );
}
