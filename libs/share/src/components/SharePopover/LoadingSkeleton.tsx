import { Skeleton, SkeletonVariant } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './SharePopover.module.scss';

/** Props for {@link LoadingSkeleton}. */
interface LoadingSkeletonProps {
  /** Accessible label for the loading status region. */
  ariaLabel: string;
  /** Skeleton bar/shape color. Defaults to `--shp-skeleton-color`. */
  skeletonColor?: string;
}

/** Skeleton placeholder shown while the share link is being created. */
export const LoadingSkeleton: FC<LoadingSkeletonProps> = ({
  ariaLabel,
  skeletonColor = styles.skeletonColor,
}) => (
  <div role="status" aria-label={ariaLabel} className="flex flex-col gap-3">
    <div aria-hidden className="flex items-center gap-2.5">
      <Skeleton
        variant={SkeletonVariant.Circular}
        width={32}
        height={32}
        color={skeletonColor}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton
          variant={SkeletonVariant.Text}
          width="70%"
          height={16}
          color={skeletonColor}
        />
        <Skeleton
          variant={SkeletonVariant.Text}
          width="45%"
          height={12}
          color={skeletonColor}
        />
      </div>
      <Skeleton
        variant={SkeletonVariant.Rectangular}
        width={92}
        height={30}
        color={skeletonColor}
      />
    </div>
    <div aria-hidden className="flex flex-col gap-1.5">
      <Skeleton
        variant={SkeletonVariant.Text}
        width="100%"
        height={12}
        color={skeletonColor}
      />
      <Skeleton
        variant={SkeletonVariant.Text}
        width="60%"
        height={12}
        color={skeletonColor}
      />
    </div>
    <Skeleton
      aria-hidden
      variant={SkeletonVariant.Rectangular}
      width="100%"
      height={40}
      color={skeletonColor}
    />
    <Skeleton
      aria-hidden
      variant={SkeletonVariant.Text}
      width="50%"
      height={12}
      color={skeletonColor}
    />
  </div>
);
