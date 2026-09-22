import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type CSSProperties, type FC } from 'react';
import { SCHEDULED_TASKS_CLASS } from '../../constants/public-class-names';
import type { ScheduledTaskCardGridProps } from '../../models/scheduled-task-card-grid-props';
import { ScheduledTaskCard } from '../ScheduledTaskCard/ScheduledTaskCard';
import { ScheduledTaskCardSkeleton } from '../ScheduledTaskCardSkeleton/ScheduledTaskCardSkeleton';

/** Container-responsive grid of {@link ScheduledTaskCard}s with one to three columns. */
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
        '--st-grid-columns': layout?.maxColumns ?? 3,
        maxWidth: layout?.maxWidth ?? '1180px',
        gap: 'var(--st-grid-gap, 20px)',
        gridTemplateColumns:
          'repeat(auto-fill, minmax(min(100%, max(var(--st-grid-min-card-width, 320px), calc((100% - (var(--st-grid-columns) - 1) * var(--st-grid-gap, 20px)) / var(--st-grid-columns)))), 1fr))',
      } as CSSProperties
    }
    className={mergeClasses(
      'mx-auto grid w-full min-w-0',
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
