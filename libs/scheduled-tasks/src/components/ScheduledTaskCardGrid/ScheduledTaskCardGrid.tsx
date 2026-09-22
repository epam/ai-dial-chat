import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type CSSProperties, type FC } from 'react';
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
  layout,
}) => (
  <div
    style={
      {
        '--st-grid-min-card-width': layout?.minCardWidth,
        '--st-grid-gap': layout?.gap,
        '--st-card-height': layout?.cardHeight,
        '--st-grid-columns': layout?.maxColumns,
      } as CSSProperties
    }
    className={mergeClasses(
      'grid grid-cols-1 gap-[var(--st-grid-gap,20px)] desktop:grid-cols-[repeat(var(--st-grid-columns,3),minmax(var(--st-grid-min-card-width,0),1fr))]',
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
        className={layout?.cardHeight ? 'h-[var(--st-card-height)]' : undefined}
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
