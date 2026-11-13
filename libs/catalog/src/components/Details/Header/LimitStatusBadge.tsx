import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { CatalogLimitStatus } from '../../../models/item-details-data';
import styles from './Header.module.scss';

const LIMIT_STATUS_CLASSES: Record<CatalogLimitStatus, string> = {
  [CatalogLimitStatus.LimitReached]: styles.limitReached,
  [CatalogLimitStatus.RunningLow]: styles.limitRunningLow,
};

/** Props for {@link LimitStatusBadge}. */
export interface LimitStatusBadgeProps {
  /** Limit status the badge shows. */
  status: CatalogLimitStatus;
  /** Visible badge text. */
  label: string;
  /** Typography class of the badge. */
  className: string;
}

/** Small status pill matching `FeaturedChip`'s shape, shown in the same header corner. */
export const LimitStatusBadge: FC<LimitStatusBadgeProps> = ({
  status,
  label,
  className,
}) => (
  <div
    className={mergeClasses(
      'flex h-[24px] items-center justify-center gap-1 rounded-2xl px-2 whitespace-nowrap',
      className,
      LIMIT_STATUS_CLASSES[status],
    )}
  >
    {label}
  </div>
);
