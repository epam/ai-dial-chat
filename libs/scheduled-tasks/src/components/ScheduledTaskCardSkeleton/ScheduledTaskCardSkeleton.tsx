import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  CardShell,
  DialSkeleton,
  DialSkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';
import type { ScheduledTaskCardSkeletonProps } from '../../models/scheduled-task-card-skeleton-props';
import styles from './ScheduledTaskCardSkeleton.module.scss';

const DESCRIPTION_LINE_WIDTHS = ['100%', '100%', '61%'];

/* `DialSkeleton` takes a color value, not a class, so the themed chain is
   resolved by the module class on the card root and read back through the var. */
const SKELETON_COLOR = 'var(--stcs-skeleton-bg)';

/**
 * A skeleton component that represents a scheduled task card while the actual data is being loaded.
 */
export const ScheduledTaskCardSkeleton: FC<ScheduledTaskCardSkeletonProps> = ({
  styles: skeletonStyles,
}) => {
  const cssVars = buildCssVars({
    '--stcs-skeleton-bg': skeletonStyles?.colors?.skeletonColor,
  });

  return (
    <CardShell
      aria-hidden
      style={cssVars}
      className={mergeClasses('h-[232px]', styles.card)}
    >
      <DialSkeleton
        variant={DialSkeletonVariant.Rectangular}
        width="60%"
        height="20px"
        color={SKELETON_COLOR}
        className="shrink-0"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {DESCRIPTION_LINE_WIDTHS.map((width, index) => (
          <DialSkeleton
            key={index}
            variant={DialSkeletonVariant.Rectangular}
            width={width}
            height="16px"
            color={SKELETON_COLOR}
          />
        ))}
      </div>

      <DialSkeleton
        variant={DialSkeletonVariant.Rectangular}
        width="110px"
        height="28px"
        color={SKELETON_COLOR}
        className="shrink-0 rounded-lg"
      />
    </CardShell>
  );
};
