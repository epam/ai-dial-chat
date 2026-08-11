import type { ScheduledTaskCardStyles } from './scheduled-task-card-props';
import type { ScheduledTaskCardSkeletonStyles } from './scheduled-task-card-skeleton-props';
import type { ScheduledTaskItem } from './scheduled-task-item';

/** Localized labels for the {@link ScheduledTaskCardGrid} component's cards. All have English defaults. */
export interface ScheduledTaskCardGridLabels {
  /** Label shown in a card's "new" badge. Defaults to `'NEW'`. */
  newBadgeLabel?: string;
}

/** Props for the {@link ScheduledTaskCardGrid} component. */
export interface ScheduledTaskCardGridProps {
  /** Items to render as cards, in display order. */
  items: ScheduledTaskItem[];
  /** Current search query — forwarded to each card to highlight the matching title substring. */
  searchQuery?: string;
  /** Called with a task id when the user activates a card's body. Omit to render cards with no added interactive root semantics. */
  onCardClick?: (id: string) => void;
  /** Localized labels forwarded to each card. */
  labels?: ScheduledTaskCardGridLabels;
  /** Style overrides forwarded to each card. */
  cardStyles?: ScheduledTaskCardStyles;
  /** Number of placeholder cards rendered after `items`, inside the same grid, so they continue filling the current row instead of starting a new one. */
  trailingSkeletonCount?: number;
  /** Style overrides forwarded to each trailing skeleton card. */
  skeletonStyles?: ScheduledTaskCardSkeletonStyles;
}
