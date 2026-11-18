// 레시피 미리보기 두 가지:
// - 기본 레시피 (#/recipe/<id>)
// - 공유 링크로 들어온 레시피 (#r=<압축문자열>)
// 둘 다 읽기 전용이고, '내 레시피로 가져오기'를 누르면 편집할 수 있는 사본이 생긴다.

import { useMemo } from 'react';
import { CopyPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice, PageHeader } from '@/components/common';
import { ExportPrepButton } from '@/components/ExportDialog';
import { ShareButton, cloneRecipe } from '@/components/RecipeActions';
import { RecipeOverview } from '@/components/RecipeOverview';
import { builtinRecipes } from '@/data/recipes';
import { navigate } from '@/lib/router';
import { decodeRecipe } from '@/lib/share';
import { useStore } from '@/store/useStore';
import type { Recipe } from '@/types';

function ImportButton({ recipe }: { recipe: Recipe }) {
  const saveRecipe = useStore((state) => state.saveRecipe);
  const onImport = () => {
    const copy = cloneRecipe(recipe);
    saveRecipe(copy);
    navigate(`/edit/${copy.id}`);
  };
  return (
    <Button onClick={onImport}>
      <CopyPlus aria-hidden />내 레시피로 가져오기
    </Button>
  );
}

function BackLink() {
  return (
    <div>
      <Button asChild variant="outline">
        <a href="#/recipes">레시피 책으로 돌아가기</a>
      </Button>
    </div>
  );
}

export function BuiltinRecipePage({ id }: { id: string }) {
  const plans = useStore((state) => state.plans);
  const recipe = builtinRecipes.find((item) => item.id === id);
  if (!recipe) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warn">이 레시피를 찾을 수 없어요.</Notice>
        <BackLink />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={recipe.title}
        description="기본 레시피 · 가져와서 내 팀에 맞게 고쳐 쓸 수 있어요."
        actions={
          <>
            <ShareButton recipe={recipe} />
            <ExportPrepButton recipe={recipe} plans={plans} />
            <ImportButton recipe={recipe} />
          </>
        }
      />
      <RecipeOverview recipe={recipe} plans={plans} />
    </div>
  );
}

export function SharedRecipePage({ encoded }: { encoded: string }) {
  const plans = useStore((state) => state.plans);
  const plansConfirmed = useStore((state) => state.plansConfirmed);
  const result = useMemo(() => decodeRecipe(encoded), [encoded]);

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="공유받은 레시피" />
        <Notice tone="error">{result.error}</Notice>
        <BackLink />
      </div>
    );
  }

  const { recipe } = result;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={recipe.title}
        description="공유받은 레시피 · 아직 내 레시피에 저장되지 않았어요."
        actions={
          <>
            <ExportPrepButton recipe={recipe} plans={plans} />
            <ImportButton recipe={recipe} />
          </>
        }
      />
      <Notice tone="info">
        다른 사람이 만든 레시피예요. 지시문을 한 번 읽어 보고, 내 프로젝트에 맞는지 확인한 뒤 쓰세요.
        {!plansConfirmed ? (
          <>
            {' '}
            지금은 무료 계정 기준으로 계산했어요.{' '}
            <a className="underline" href="#/plans">
              내 AI 현황
            </a>
            을 알려 주면 더 정확해져요. (이 링크는 다시 열 수 있어요.)
          </>
        ) : null}
      </Notice>
      <RecipeOverview recipe={recipe} plans={plans} runLead="이 레시피를 당신 플랜으로 돌리면" />
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <ImportButton recipe={recipe} />
        <BackLink />
      </div>
    </div>
  );
}
