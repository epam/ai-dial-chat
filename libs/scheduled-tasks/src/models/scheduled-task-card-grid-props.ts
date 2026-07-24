import type { ScheduledTaskCardStyles } from './scheduled-task-card-props';
import type { ScheduledTaskItem } from './scheduled-task-item';

/** Localized labels for the {@link ScheduledTaskCardGrid} component's cards. All have English defaults. */
export interface ScheduledTaskCardGridLabels {
  /** Label shown in a card's "new" badge. Defaults to `'NEW'`. */
  newBadgeLabel?: string;
  /** Accessible label for a card's overflow-menu trigger. Defaults to `'More actions'`. */
  actionsLabel?: string;
  /** Label for the "Edit" card menu action. Defaults to `'Edit'`. */
  editActionLabel?: string;
  /** Label for the "Run now" card menu action. Defaults to `'Run now'`. */
  runNowActionLabel?: string;
  /** Label for the "Delete" card menu action. Defaults to `'Delete'`. */
  deleteActionLabel?: string;
}

/** Props for the {@link ScheduledTaskCardGrid} component. */
export interface ScheduledTaskCardGridProps {
  /** Items to render as cards, in display order. */
  items: ScheduledTaskItem[];
  /** Current search query — forwarded to each card to highlight the matching title substring. */
  searchQuery?: string;
  /** Called with a task id when the user activates "Edit" on a card. Omit to hide the action on every card. */
  onEdit?: (id: string) => void;
  /** Called with a task id when the user activates "Run now" on a card. Omit to hide the action on every card. */
  onRunNow?: (id: string) => void;
  /** Called with a task id when the user activates "Delete" on a card. Omit to hide the action on every card. */
  onDelete?: (id: string) => void;
  /** Localized labels forwarded to each card. */
  labels?: ScheduledTaskCardGridLabels;
  /** Style overrides forwarded to each card. */
  cardStyles?: ScheduledTaskCardStyles;
}
