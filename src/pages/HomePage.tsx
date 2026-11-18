// 첫 화면 (화면 A): 이번에 이루고 싶은 일과 자료를 담는다. 주인공은 여러 줄 입력과 '작업 설계하기' 하나.
// 옆에는 내 팀(프로젝트 폴더)을 둔다. 적는 내용은 주문 초안으로 자동 저장돼, 다시 와도 이어서 쓸 수 있다.
// 레시피 책은 보조 링크로 바로 열 수 있다 (주문서를 거치지 않아도 된다).

import { useEffect, useRef, useState } from 'react';
import { FileText, Link2, Paperclip, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/common';
import { canStart, newOrder, startDesign } from '@/lib/order/draft';
import { fileMaterial, linkMaterial, MATERIAL_STATUS_LABELS, textMaterial } from '@/lib/order/materials';
import { MATERIAL_LIMITS, STATUS_LABELS, STEP_LABELS, type Material, type OrderDraft } from '@/lib/order/types';
import { formatLocal } from '@/lib/practice/time';
import { navigate } from '@/lib/router';
import { OpenProjectPanel } from '@/pages/team/TeamPage';
import { putOrder, useOrders } from '@/store/useOrders';
import { useWorkspace } from '@/store/useWorkspace';

const EXAMPLES: { label: string; text: string }[] = [
  { label: '간단한 수정', text: '로그인 후 30분쯤 지나면 세션이 끊기는 문제를 수정하고 테스트해 줘.' },
  { label: '조사 보고서', text: '국내 중소기업용 회계 SaaS 시장을 조사해서 보고서로 정리해 줘.\n주요 경쟁사 5곳과 가격, 차별점을 비교하고, 출처는 꼭 남겨 줘.' },
  { label: '조사 + MVP 설계', text: '사내 문서 검색에 GraphRAG를 써 볼지 조사하고, 해볼 만하면 MVP를 설계하고 구현까지 하고 싶어.\n현재는 Notion과 구글 드라이브에 문서가 흩어져 있어.\n외부 API 비용은 월 10만 원 이내여야 하고, 권한 관리는 이번 범위에서 제외.' },
];

function MaterialRow({ item, onRemove }: { item: Material; onRemove: () => void }) {
  const Icon = item.kind === 'link' ? Link2 : item.kind === 'file' ? Paperclip : FileText;
  return (
    <li className="flex items-start gap-2 border-b border-dashed border-input py-2 text-sm last:border-b-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.name}</span>
        <span className={cn('block text-xs', item.status === 'failed' ? 'text-rose-800' : 'text-muted-foreground')}>
          {MATERIAL_STATUS_LABELS[item.status]}
          {item.status === 'read' && item.content ? ` · ${item.content.length.toLocaleString()}자` : ''}
          {item.error ? ` · ${item.error}` : ''}
        </span>
      </span>
      <Button size="icon-xs" variant="ghost" aria-label={`${item.name} 빼기`} onClick={onRemove}>
        <X />
      </Button>
    </li>
  );
}

export function HomePage() {
  const orders = useOrders((state) => state.orders);
  const saveError = useOrders((state) => state.saveError);
  const snapshot = useWorkspace((state) => state.snapshot);
  // 요청 단계에 있는 가장 최근 초안을 이어서 쓴다
  const pending = orders.find((item) => item.step === 'request');
  const [draftId, setDraftId] = useState<string | null>(pending?.id ?? null);
  const current = orders.find((item) => item.id === draftId) ?? null;
  const [text, setText] = useState(current?.request.text ?? '');
  const [materials, setMaterials] = useState<Material[]>(current?.request.materials ?? []);
  const [adding, setAdding] = useState<'link' | 'text' | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [pasteValue, setPasteValue] = useState('');
  const [message, setMessage] = useState('');
  const [replaceWith, setReplaceWith] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // 입력이 길어지면 칸이 늘어난다
  useEffect(() => {
    const node = area.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 480)}px`;
  }, [text]);

  // 적는 대로 초안에 저장한다 (잠깐 멈추면)
  useEffect(() => {
    if (!text.trim() && materials.length === 0) return;
    const timer = window.setTimeout(() => {
      const base = current ?? newOrder();
      const next: OrderDraft = { ...base, request: { ...base.request, text, materials } };
      if (putOrder(next).ok && !current) setDraftId(next.id);
    }, 600);
    return () => window.clearTimeout(timer);
    // current는 저장 뒤 바뀌므로 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, materials]);

  const addMaterial = (item: Material) => {
    if (materials.length >= MATERIAL_LIMITS.perOrder) {
      setMessage(`자료는 주문 하나에 ${MATERIAL_LIMITS.perOrder}개까지 넣을 수 있어요.`);
      return;
    }
    setMessage('');
    setMaterials((old) => [...old, item]);
  };

  const onFiles = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) addMaterial(await fileMaterial(file));
    if (fileInput.current) fileInput.current.value = '';
  };

  const onStart = () => {
    const check = canStart(text, materials);
    if (!check.ok) {
      setMessage(check.message ?? '');
      return;
    }
    const base = current ?? newOrder();
    const order = startDesign({ ...base, request: { ...base.request, text, materials } });
    if (putOrder(order).ok) navigate(`/order/${order.id}`);
  };

  const pickExample = (example: string) => {
    if (text.trim() && text !== example) {
      setReplaceWith(example);
      return;
    }
    setText(example);
  };

  const recent = orders.filter((item) => item.step !== 'request').slice(0, 3);

  return (
    <div className="grid items-start gap-x-14 gap-y-10 py-2 sm:py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[2.2rem] leading-[1.15] font-extrabold text-balance sm:text-5xl">AI 팀에게 일을 맡기세요</h1>
          <p className="max-w-xl text-base text-pretty text-muted-foreground">
            할 일을 적으면 작업으로 나누고, 누가 무엇을 맡을지 정해 Codex·Claude Code에 넘길 지시서를 만들어 드려요.
          </p>
        </div>

        <section className="ticket flex flex-col gap-4 px-5 pt-7 pb-8 sm:px-7" aria-label="요청과 자료">
          <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2">
            <span className="font-heading text-xl font-extrabold">주문서</span>
            {current ? <span className="text-xs text-muted-foreground">초안 자동 저장됨</span> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="order-request" className="font-heading text-lg font-extrabold">
              이번에 이루고 싶은 일을 알려 주세요
            </label>
            <p className="text-sm text-muted-foreground">목표, 현재 상황, 제한 조건을 순서 없이 적어도 괜찮아요.</p>
            <textarea
              ref={area}
              id="order-request"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={EXAMPLES[0].text}
              className="min-h-28 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">자료</span>
              <Button size="sm" variant="outline" onClick={() => setAdding(adding === 'link' ? null : 'link')}>
                <Link2 aria-hidden />
                링크
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(adding === 'text' ? null : 'text')}>
                <FileText aria-hidden />글 붙여 넣기
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <Paperclip aria-hidden />
                파일 (.txt·.md)
              </Button>
              <input ref={fileInput} type="file" multiple accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => void onFiles(event.target.files)} />
              <span className="text-xs text-muted-foreground">파일은 1MB·{MATERIAL_LIMITS.perOrder}개까지, 내 브라우저에서만 읽어요</span>
            </div>
            {adding === 'link' ? (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const made = linkMaterial(linkValue);
                  if (!made.ok) setMessage(made.error);
                  else {
                    addMaterial(made.material);
                    setLinkValue('');
                    setAdding(null);
                  }
                }}
              >
                <Input aria-label="링크 주소" className="min-w-0 flex-1 basis-60 bg-background" placeholder="https://" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} />
                <Button size="sm" type="submit" disabled={!linkValue.trim()}>
                  넣기
                </Button>
                <p className="w-full text-xs text-muted-foreground">주소만 참고로 저장해요. 사이트가 그 주소에 접속하거나 내용을 읽지 않아요.</p>
              </form>
            ) : null}
            {adding === 'text' ? (
              <div className="flex flex-col gap-2">
                <Input aria-label="자료 이름" className="bg-background" placeholder="자료 이름 (예: 기획 메모)" value={pasteName} onChange={(event) => setPasteName(event.target.value)} />
                <textarea aria-label="붙여 넣을 글" rows={4} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} />
                <div>
                  <Button
                    size="sm"
                    disabled={!pasteValue.trim()}
                    onClick={() => {
                      addMaterial(textMaterial(pasteName, pasteValue));
                      setPasteName('');
                      setPasteValue('');
                      setAdding(null);
                    }}
                  >
                    넣기
                  </Button>
                </div>
              </div>
            ) : null}
            {materials.length > 0 ? (
              <ul aria-label="넣은 자료">
                {materials.map((item) => (
                  <MaterialRow key={item.id} item={item} onRemove={() => setMaterials((old) => old.filter((entry) => entry.id !== item.id))} />
                ))}
              </ul>
            ) : null}
          </div>

          {message ? (
            <p className="text-sm font-medium text-rose-800" role="alert">
              {message}
            </p>
          ) : null}
          {saveError ? <Notice tone="error">{saveError}</Notice> : null}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
            <Button size="lg" className="h-11 px-6 text-base" onClick={onStart}>
              <Sparkles aria-hidden />
              작업 설계하기
            </Button>
            <a className="text-sm underline underline-offset-4 hover:text-primary" href="#/recipes">
              레시피 책 직접 열기
            </a>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-dashed border-input pt-3">
            <span className="text-xs text-muted-foreground">예시로 시작하기</span>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  className="rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted"
                  onClick={() => pickExample(example.text)}
                >
                  {example.label}
                </button>
              ))}
            </div>
            {replaceWith ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm" role="alertdialog" aria-label="예시로 바꾸기 확인">
                <span>지금 적은 내용을 예시로 바꿀까요?</span>
                <Button size="xs" onClick={() => { setText(replaceWith); setReplaceWith(null); }}>
                  바꾸기
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setReplaceWith(null)}>
                  그대로 두기
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {recent.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label="이어서 하기">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold">이어서 하기</h2>
              <a className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary" href="#/orders">
                주문 전체
              </a>
            </div>
            <ul className="flex flex-col gap-2">
              {recent.map((order) => (
                <li key={order.id}>
                  <a href={`#/order/${encodeURIComponent(order.id)}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card px-4 py-3 hover:border-foreground/40">
                    <span className="font-medium">{order.title || '이름 없는 주문'}</span>
                    <span className="text-xs text-muted-foreground">
                      {STATUS_LABELS[order.status]} · {STEP_LABELS[order.step]} · {formatLocal(order.updatedAt)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="flex flex-col gap-3 rounded-2xl border bg-card p-5 lg:mt-24" aria-label="내 팀">
        <h2 className="font-heading text-xl font-extrabold">내 팀</h2>
        {snapshot ? (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{snapshot.folderName}</span> 폴더의 팀원 {snapshot.members.length}명
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {snapshot.members.slice(0, 8).map((member) => (
                <li key={member.card.id} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                  {member.card.displayName || member.card.name}
                </li>
              ))}
            </ul>
            <a className="text-sm underline underline-offset-4 hover:text-primary" href="#/team">
              팀 보기·고치기
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-pretty text-muted-foreground">
              프로젝트 폴더를 열면 숨김 폴더 속 역할 파일이 팀원 카드로 보이고, 작업을 그 팀원에게 맡길 수 있어요.
            </p>
            <OpenProjectPanel compact />
          </>
        )}
      </aside>
    </div>
  );
}
