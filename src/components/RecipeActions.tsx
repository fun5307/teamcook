// 레시피에 대해 할 수 있는 일: 링크 복사(공유), 내 레시피로 가져오기. (내보내기는 ExportDialog.tsx)

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/common';
import { installCommand, suggestRecipeUrl } from '@/data/site';
import { copyText } from '@/lib/download';
import { newId } from '@/lib/id';
import { SHARE_WARN_LENGTH, buildShareLink, type ShareLink } from '@/lib/share';
import type { Recipe } from '@/types';

/** 레시피를 복사해 새 id를 붙인다 (기본·공유 레시피를 내 것으로 가져올 때). */
export function cloneRecipe(recipe: Recipe, title?: string): Recipe {
  return {
    ...structuredClone(recipe),
    id: newId('recipe'),
    title: title ?? recipe.title,
  };
}

/** '링크 복사' 버튼 + 결과 안내. 결과 상자는 버튼 아래에 펼쳐진다. */
export function ShareButton({ recipe }: { recipe: Recipe }) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const next = buildShareLink(recipe, base);
    setLink(next);
    setCopied(await copyText(next.url));
  };

  return (
    <div className="relative flex flex-col gap-2">
      <Button variant="outline" onClick={onShare}>
        {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
        링크 복사
      </Button>
      {link ? (
        <div className="flex w-full max-w-xl flex-col gap-2 rounded-xl border bg-card p-3 sm:absolute sm:top-full sm:right-0 sm:z-10 sm:mt-2 sm:w-[32rem] sm:shadow-lg">
          <p className="text-sm font-medium">
            {copied
              ? '공유 링크를 복사했어요. 메신저나 게시판에 붙여 넣으세요.'
              : '아래 링크를 직접 복사해 주세요.'}
          </p>
          <Input readOnly value={link.url} onFocus={(event) => event.target.select()} aria-label="공유 링크" />
          <p className="text-xs text-muted-foreground">
            링크 길이 {link.length.toLocaleString()}자 · 레시피 내용이 링크 안에 그대로 들어 있어요 (서버에
            저장되지 않아요).
          </p>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium">
              터미널에서 프로젝트에 바로 설치 (Node.js 필요, 프로젝트 폴더에서 두 줄을 차례로 실행)
            </p>
            <Textarea
              readOnly
              rows={3}
              className="font-mono text-xs"
              value={installCommand(link.url)}
              onFocus={(event) => event.target.select()}
              aria-label="설치 명령"
            />
          </div>
          <a
            className="text-xs text-primary underline-offset-2 hover:underline"
            href={suggestRecipeUrl(recipe.title, recipe.summary, link.url)}
            target="_blank"
            rel="noreferrer noopener"
          >
            이 레시피를 커뮤니티 갤러리에 제안하기 (GitHub 이슈로 열려요)
          </a>
          {link.tooLong ? (
            <Notice tone="warn">
              링크가 {SHARE_WARN_LENGTH.toLocaleString()}자를 넘어요. 일부 메신저에서 잘릴 수 있으니 지시문을
              줄이거나, zip으로 내보내 파일로 전달하세요.
            </Notice>
          ) : null}
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
              닫기
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

