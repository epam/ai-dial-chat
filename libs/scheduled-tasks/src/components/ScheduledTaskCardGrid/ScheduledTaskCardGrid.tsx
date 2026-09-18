import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import { SCHEDULED_TASKS_CLASS } from '../../constants/public-class-names';
import type { ScheduledTaskCardGridProps } from '../../models/scheduled-task-card-grid-props';
import { ScheduledTaskCard } from '../ScheduledTaskCard/ScheduledTaskCard';
import { ScheduledTaskCardSkeleton } from '../ScheduledTaskCardSkeleton/ScheduledTaskCardSkeleton';

/** Mobile-first responsive grid of {@link ScheduledTaskCard}s: one column on mobile, three columns on desktop. */
export const ScheduledTaskCardGrid: FC<ScheduledTaskCardGridProps> = ({
  items,
  searchQuery,
  onCardClick,
  labels,
  cardStyles,
  trailingSkeletonCount = 0,
  skeletonStyles,
}) => (
  <div
    className={mergeClasses(
      'grid grid-cols-1 gap-5 desktop:grid-cols-3',
      SCHEDULED_TASKS_CLASS.cardGrid,
    )}
  >
    {items.map((item) => (
      <ScheduledTaskCard
        key={item.id}
        item={item}
        searchQuery={searchQuery}
        onCardClick={onCardClick}
        labels={labels}
        styles={cardStyles}
      />
    ))}
    {Array.from({ length: trailingSkeletonCount }, (_, index) => (
      <ScheduledTaskCardSkeleton
        key={`skeleton-${index}`}
        styles={skeletonStyles}
      />
    ))}
  </div>
);
