import { type FC } from 'react';
import type { ScheduledTaskCardGridProps } from '../../models/scheduled-task-card-grid-props';
import { ScheduledTaskCard } from '../ScheduledTaskCard/ScheduledTaskCard';
import { ScheduledTaskCardSkeleton } from '../ScheduledTaskCardSkeleton/ScheduledTaskCardSkeleton';

/** Mobile-first responsive grid of {@link ScheduledTaskCard}s: one column on mobile, three columns on desktop. */
export const ScheduledTaskCardGrid: FC<ScheduledTaskCardGridProps> = ({
  items,
  searchQuery,
  onEdit,
  onRunNow,
  onDelete,
  onCardClick,
  labels,
  cardStyles,
  trailingSkeletonCount = 0,
  skeletonStyles,
}) => (
  <div className="grid grid-cols-1 gap-5 desktop:grid-cols-3">
    {items.map((item) => (
      <ScheduledTaskCard
        key={item.id}
        item={item}
        searchQuery={searchQuery}
        onEdit={onEdit}
        onRunNow={onRunNow}
        onDelete={onDelete}
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
