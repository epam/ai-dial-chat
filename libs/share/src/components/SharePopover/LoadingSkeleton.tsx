import { DialSkeleton, DialSkeletonVariant } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';

const SKELETON_COLOR = 'var(--bg-layer-2, #EEF1F7)';

/** Props for {@link LoadingSkeleton}. */
interface LoadingSkeletonProps {
  /** Accessible label for the loading status region. */
  ariaLabel: string;
}

/** Skeleton placeholder shown while the share link is being created. */
export const LoadingSkeleton: FC<LoadingSkeletonProps> = ({ ariaLabel }) => (
  <div role="status" aria-label={ariaLabel} className="flex flex-col gap-3">
    <div aria-hidden className="flex items-center gap-2.5">
      <DialSkeleton
        variant={DialSkeletonVariant.Circular}
        width={32}
        height={32}
        color={SKELETON_COLOR}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <DialSkeleton
          variant={DialSkeletonVariant.Text}
          width="70%"
          height={16}
          color={SKELETON_COLOR}
        />
        <DialSkeleton
          variant={DialSkeletonVariant.Text}
          width="45%"
          height={12}
          color={SKELETON_COLOR}
        />
      </div>
      <DialSkeleton
        variant={DialSkeletonVariant.Rectangular}
        width={92}
        height={30}
        color={SKELETON_COLOR}
      />
    </div>
    <div aria-hidden className="flex flex-col gap-1.5">
      <DialSkeleton
        variant={DialSkeletonVariant.Text}
        width="100%"
        height={12}
        color={SKELETON_COLOR}
      />
      <DialSkeleton
        variant={DialSkeletonVariant.Text}
        width="60%"
        height={12}
        color={SKELETON_COLOR}
      />
    </div>
    <DialSkeleton
      aria-hidden
      variant={DialSkeletonVariant.Rectangular}
      width="100%"
      height={40}
      color={SKELETON_COLOR}
    />
    <DialSkeleton
      aria-hidden
      variant={DialSkeletonVariant.Text}
      width="50%"
      height={12}
      color={SKELETON_COLOR}
    />
  </div>
);
