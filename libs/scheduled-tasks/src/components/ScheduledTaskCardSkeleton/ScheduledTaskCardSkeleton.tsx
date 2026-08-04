import {
  CardShell,
  DialSkeleton,
  DialSkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';
import type { ScheduledTaskCardSkeletonProps } from '../../models/scheduled-task-card-skeleton-props';

const DESCRIPTION_LINE_WIDTHS = ['100%', '100%', '61%'];

/**
 * A skeleton component that represents a scheduled task card while the actual data is being loaded.
 */
export const ScheduledTaskCardSkeleton: FC<ScheduledTaskCardSkeletonProps> = ({
  styles,
}) => {
  const skeletonColor = styles?.colors?.skeletonColor ?? 'var(--bg-layer-4)';

  return (
    <CardShell aria-hidden className="h-[232px]">
      <DialSkeleton
        variant={DialSkeletonVariant.Rectangular}
        width="60%"
        height="20px"
        color={skeletonColor}
        className="shrink-0"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {DESCRIPTION_LINE_WIDTHS.map((width, index) => (
          <DialSkeleton
            key={index}
            variant={DialSkeletonVariant.Rectangular}
            width={width}
            height="16px"
            color={skeletonColor}
          />
        ))}
      </div>

      <DialSkeleton
        variant={DialSkeletonVariant.Rectangular}
        width="110px"
        height="28px"
        color={skeletonColor}
        className="shrink-0 rounded-lg"
      />
    </CardShell>
  );
};
