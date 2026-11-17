// 레시피와 역할 카드의 '구조화된 항목'을 고치고 보여 주는 부품들:
// 여러 줄 목록(성공 조건, 완료 기준 등), 산출물 목록, 확인 기록, 권한 안내.

import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/common';
import { today } from '@/data/collaboration';
import { newId } from '@/lib/id';
import { ENFORCEMENT_LABELS, permissionSupport } from '@/lib/support';
import {
  KIND_HINTS,
  KIND_LABELS,
  RESULT_LABELS,
  SOURCE_LABELS,
  verificationDetail,
  verificationLine,
} from '@/lib/verification';
import type {
  AgentCard,
  Collaboration,
  Deliverable,
  VerificationKind,
  VerificationRecord,
  VerificationResult,
} from '@/types';

/**
 * 한 줄짜리 항목을 더하고, 고치고, 지우는 목록. 점검 결과에서 이 위치로 옮겨 올 수 있게
 * 바깥 상자에 id를 붙인다 (초점은 첫 입력 칸이나 '추가' 버튼으로 간다).
 */
export function LineListEditor({
  id,
  label,
  items,
  onChange,
  placeholder,
  addLabel = '항목 추가',
}: {
  id: string;
  /** 화면 낭독기용 이름. 예: '실습 성공 조건' */
  label: string;
  items: string[] | undefined;
  onChange: (items: string[] | undefined) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const list = items ?? [];
  const set = (next: string[]) => onChange(next.length > 0 ? next : undefined);
  return (
    <div id={id} className="flex flex-col gap-1.5" role="group" aria-label={label}>
      {list.map((item, index) => (
        // 줄을 지우면 뒤 줄이 당겨지므로 위치를 key로 쓴다 (내용이 같은 줄이 있을 수 있다)
        <div key={index} className="flex items-center gap-1.5">
          <Input
            className="bg-card"
            value={item}
            placeholder={placeholder}
            aria-label={`${label} ${index + 1}`}
            onChange={(event) => set(list.map((old, at) => (at === index ? event.target.value : old)))}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${label} ${index + 1} 삭제`}
            onClick={() => set(list.filter((_, at) => at !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div>
        <Button size="sm" variant="outline" onClick={() => set([...list, ''])}>
          <Plus aria-hidden />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

/** 산출물 목록. 이름을 바꿔도 id는 그대로라, 이 산출물을 가리키는 전달 흐름이 끊기지 않는다. */
export function DeliverableEditor({
  id,
  items,
  onChange,
}: {
  id: string;
  items: Deliverable[] | undefined;
  onChange: (items: Deliverable[] | undefined) => void;
}) {
  const list = items ?? [];
  const set = (next: Deliverable[]) => onChange(next.length > 0 ? next : undefined);
  const update = (target: string, patch: Partial<Deliverable>) =>
    set(
      list.map((item) => {
        if (item.id !== target) return item;
        const next = { ...item, ...patch };
        if (!next.description) delete next.description;
        return next;
      }),
    );
  return (
    <div id={id} className="flex flex-col gap-1.5" role="group" aria-label="필수 산출물">
      {list.map((item, index) => (
        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-1.5">
          <Input
            className="bg-card"
            value={item.name}
            placeholder="산출물 이름. 예: 변경 요약"
            aria-label={`산출물 ${index + 1} 이름`}
            onChange={(event) => update(item.id, { name: event.target.value })}
          />
          <Input
            className="bg-card"
            value={item.description ?? ''}
            placeholder="설명 (선택)"
            aria-label={`산출물 ${index + 1} 설명`}
            onChange={(event) => update(item.id, { description: event.target.value })}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`산출물 ${index + 1} 삭제`}
            onClick={() => set(list.filter((old) => old.id !== item.id))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div>
        <Button size="sm" variant="outline" onClick={() => set([...list, { id: newId('out'), name: '' }])}>
          <Plus aria-hidden />
          산출물 추가
        </Button>
      </div>
    </div>
  );
}

/** 권한 선택이 내보낸 설정에서 어떤 수단으로 지켜지는지 */
export function PermissionNote({ card, style, id }: { card: AgentCard; style: Collaboration; id?: string }) {
  const support = permissionSupport(card, style);
  return (
    <div id={id} className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">권한을 지키는 수단</span>
        {support.modes.map((mode) => (
          <span key={mode} className="rounded border bg-card px-1.5 py-0.5 font-medium">
            {ENFORCEMENT_LABELS[mode]}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground">{support.text}</p>
    </div>
  );
}

const KIND_STYLE: Record<VerificationKind, string> = {
  run: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  file: 'bg-card',
  docs: 'bg-card',
  unclassified: 'border-dashed bg-card text-muted-foreground',
};

/** 확인 기록을 읽기 전용으로 보여 준다. 종류·날짜·결과·출처를 나누고, 없는 정보는 적지 않는다. */
export function VerificationList({ records }: { records: VerificationRecord[] | undefined }) {
  const list = records ?? [];
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        확인 기록이 없어요. 이 레시피가 실제 도구에서 돌아가는지는 확인된 적이 없습니다.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {list.map((record) => {
        const detail = verificationDetail(record);
        const failed = record.result === 'failure';
        return (
          <li key={record.id} className="flex flex-col gap-0.5 text-sm">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-xs font-medium',
                  failed ? 'border-rose-300 bg-rose-50 text-rose-900' : KIND_STYLE[record.kind],
                )}
              >
                {KIND_LABELS[record.kind]}
              </span>
              <span className="text-xs text-muted-foreground">{verificationLine(record)}</span>
            </span>
            {detail ? <span className="text-xs text-muted-foreground">도구·환경: {detail}</span> : null}
            <span className="text-xs text-muted-foreground">{record.note ?? KIND_HINTS[record.kind]}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 확인 기록을 더하고 고친다. 새 기록의 출처는 항상 '사용자 기록'이다. */
export function VerificationEditor({
  records,
  onChange,
}: {
  records: VerificationRecord[] | undefined;
  onChange: (records: VerificationRecord[] | undefined) => void;
}) {
  const list = records ?? [];
  const set = (next: VerificationRecord[]) => onChange(next.length > 0 ? next : undefined);
  const update = (target: string, patch: Partial<VerificationRecord>) =>
    set(
      list.map((record) => {
        if (record.id !== target) return record;
        const next = { ...record, ...patch };
        for (const key of ['tool', 'toolVersion', 'environment', 'note'] as const) {
          if (!next[key]) delete next[key];
        }
        return next;
      }),
    );
  return (
    <div className="flex flex-col gap-3">
      {list.map((record) => (
        <div key={record.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
            <NativeSelect
              aria-label="확인 방식"
              value={record.kind}
              onChange={(event) => update(record.id, { kind: event.target.value as VerificationKind })}
            >
              {(Object.keys(KIND_LABELS) as VerificationKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </NativeSelect>
            <Input
              type="date"
              aria-label="확인한 날"
              className="bg-card"
              value={record.checkedAt}
              max={today()}
              onChange={(event) => event.target.value && update(record.id, { checkedAt: event.target.value })}
            />
            <NativeSelect
              aria-label="결과"
              value={record.result}
              onChange={(event) => update(record.id, { result: event.target.value as VerificationResult })}
            >
              {(Object.keys(RESULT_LABELS) as VerificationResult[]).map((result) => (
                <option key={result} value={result}>
                  {RESULT_LABELS[result]}
                </option>
              ))}
            </NativeSelect>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="이 확인 기록 삭제"
              onClick={() => set(list.filter((item) => item.id !== record.id))}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              className="bg-card"
              aria-label="도구"
              placeholder="도구 (선택). 예: Claude Code"
              value={record.tool ?? ''}
              onChange={(event) => update(record.id, { tool: event.target.value })}
            />
            <Input
              className="bg-card"
              aria-label="도구 버전"
              placeholder="버전 (선택)"
              value={record.toolVersion ?? ''}
              onChange={(event) => update(record.id, { toolVersion: event.target.value })}
            />
            <Input
              className="bg-card"
              aria-label="환경"
              placeholder="환경 (선택). 예: Windows 11"
              value={record.environment ?? ''}
              onChange={(event) => update(record.id, { environment: event.target.value })}
            />
          </div>
          <Input
            className="bg-card"
            aria-label="확인한 내용과 제한"
            placeholder="무엇을 확인했고 무엇은 확인하지 못했는지"
            value={record.note ?? ''}
            onChange={(event) => update(record.id, { note: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            기록 출처: {SOURCE_LABELS[record.source]} · {KIND_HINTS[record.kind]}
          </p>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            set([...list, { id: newId('check'), kind: 'run', checkedAt: today(), result: 'success', source: 'user' }])
          }
        >
          <Plus aria-hidden />
          확인 기록 추가
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        직접 돌려 본 뒤에 적어 주세요. 사이트는 실행 여부를 확인하지 못하므로, 여기 적은 내용은 "사용자 기록"으로
        표시됩니다.
      </p>
    </div>
  );
}
