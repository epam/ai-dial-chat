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
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';

/** Number of skeleton rows rendered while deployments are loading. */
export const MODEL_SELECTOR_SKELETON_ROW_COUNT = 7;

interface ModelSelectorSkeletonIconProps {
  /** Diameter in pixels. Defaults to `SKELETON_CIRCLE_SIZE_LIST` (24). */
  size?: number;
  /** Extra class for the circle, such as the timing hook's `placeholderClassName`. */
  className?: string;
}

/** Circular skeleton placeholder for the selected deployment's icon in the trigger. */
export const ModelSelectorSkeletonIcon: FC<ModelSelectorSkeletonIconProps> = ({
  size = SKELETON_CIRCLE_SIZE_LIST,
  className,
}) => (
  <Skeleton
    variant={SkeletonVariant.Circular}
    width={size}
    height={size}
    tone={SkeletonTone.Sunken}
    className={className}
    aria-hidden
  />
);

interface ModelSelectorSkeletonRowsProps {
  /** Extra class for the shimmer container, such as the timing hook's `placeholderClassName`. */
  className?: string;
}

/**
 * One shimmering block of icon-and-label rows shown while the model selector
 * is loading. The parent announces the loading text through its own
 * always-mounted live region, so the shimmer carries no `label`. The parent
 * owns the timing and passes `useSkeletonTiming`'s `placeholderClassName`, so
 * the rows hold their space, invisibly, during the show delay.
 */
export const ModelSelectorSkeletonRows: FC<ModelSelectorSkeletonRowsProps> = ({
  className,
}) => (
  <SkeletonShimmer
    className={mergeClasses('flex flex-col gap-4 px-4 py-3', className)}
  >
    {Array.from({ length: MODEL_SELECTOR_SKELETON_ROW_COUNT }, (_, index) => (
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
