import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  SKELETON_BAR_CLASS_NAME,
  SKELETON_BAR_HEIGHT,
  SKELETON_BAR_WIDTHS,
  SKELETON_CIRCLE_SIZE_LIST,
  Skeleton,
  SkeletonShimmer,
  SkeletonTone,
  SkeletonVariant,
  useSkeletonTiming,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../../constants/translation-keys';

/* A typical list; a content-sized popup needs at least three rows to hold its height. */
const ROW_COUNT = 5;

/*
 * `Suspense` fallback of the model picker overlay, which is already open while
 * its chunk loads. `showPlaceholder` is true from the first render, so the rows
 * hold the popup's height invisibly during the show delay (no 0px popup, no
 * flash on a fast chunk load); the label is announced once they are drawn.
 */
const DeploymentSelectorSkeleton: FC = () => {
  const { t } = useTranslation();
  const { showSkeleton, placeholderClassName } = useSkeletonTiming(true);

  return (
    <SkeletonShimmer
      label={showSkeleton ? t(DeploymentSelectorI18nKeys.Loading) : undefined}
      className={mergeClasses('flex flex-col gap-4 p-3', placeholderClassName)}
    >
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton
            variant={SkeletonVariant.Circular}
            width={SKELETON_CIRCLE_SIZE_LIST}
            height={SKELETON_CIRCLE_SIZE_LIST}
            tone={SkeletonTone.Sunken}
            className="shrink-0"
          />
          <Skeleton
            variant={SkeletonVariant.Text}
            width={SKELETON_BAR_WIDTHS[index % SKELETON_BAR_WIDTHS.length]}
            height={SKELETON_BAR_HEIGHT}
            tone={index % 2 === 0 ? SkeletonTone.Sunken : SkeletonTone.Base}
            className={mergeClasses(SKELETON_BAR_CLASS_NAME, 'min-w-0')}
          />
        </div>
      ))}
    </SkeletonShimmer>
  );
};

export default memo(DeploymentSelectorSkeleton);
