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
import { SKELETON_ROW_COUNT } from '../../utils/conversation-row';

interface ConversationListSkeletonProps {
  /** Pass the `placeholderClassName` of `useSkeletonTiming` so the rows hold the space during its delay. */
  className?: string;
}

/**
 * Placeholder rows (avatar circle plus title bar) for the conversation list
 * while it loads. The list's own always-mounted live region announces the
 * loading state, so the shimmer carries no `label` of its own.
 */
export const ConversationListSkeleton: FC<ConversationListSkeletonProps> = ({
  className,
}) => (
  <SkeletonShimmer
    className={mergeClasses('flex flex-col gap-4 px-2 py-3', className)}
  >
    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
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
