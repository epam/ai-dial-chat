import type { ScheduledTaskItem } from './scheduled-task-item';

/** Localized labels used by the {@link ScheduledTaskCard} component. All have English defaults. */
export interface ScheduledTaskCardLabels {
  /** Label shown in the "new" badge when `item.isNew` is set. Defaults to `'NEW'`. */
  newBadgeLabel?: string;
  /** Accessible label for the overflow-menu trigger button. Defaults to `'More actions'`. */
  actionsLabel?: string;
  /** Label for the "Edit" menu action, shown only when `onEdit` is supplied. Defaults to `'Edit'`. */
  editActionLabel?: string;
  /** Label for the "Run now" menu action, shown only when `onRunNow` is supplied. Defaults to `'Run now'`. */
  runNowActionLabel?: string;
  /** Label for the "Delete" menu action, shown only when `onDelete` is supplied. Defaults to `'Delete'`. */
  deleteActionLabel?: string;
}

/** Style overrides for the {@link ScheduledTaskCard} component. */
export interface ScheduledTaskCardStyles {
  /** CSS class applied to the card's title. Defaults to `'dial-body-semi-text text-primary'`. */
  titleClassName?: string;
  /** CSS class applied to the description/prompt-preview line. Defaults to `'dial-small-text text-control-disable'`. */
  descriptionClassName?: string;
  /** CSS class applied to the schedule pill's background/border. Defaults to `'bg-layer-2 border border-tertiary'`. */
  schedulePillClassName?: string;
  /** CSS class applied to the schedule pill's label text. Defaults to `'dial-tiny-text text-control-disable'`. */
  scheduleLabelClassName?: string;
  /** CSS class applied to non-leaf location breadcrumb segments. Defaults to `'dial-tiny-text text-secondary'`. */
  locationLabelClassName?: string;
  /** CSS class applied to the leaf (last) location breadcrumb segment. Defaults to `'dial-tiny-semi-text text-secondary'`. */
  locationLeafClassName?: string;
  /** CSS class applied to the "new" badge. Defaults to `'bg-accent-primary text-controls-permanent'`. */
  newBadgeClassName?: string;
}

/** Props for the {@link ScheduledTaskCard} component. */
export interface ScheduledTaskCardProps {
  /** The scheduled task to render. */
  item: ScheduledTaskItem;
  /** Current search query — the matching substring of `item.displayName` is highlighted. */
  searchQuery?: string;
  /** Called with the task id when the user activates "Edit". Omit to hide the action. */
  onEdit?: (id: string) => void;
  /** Called with the task id when the user activates "Run now". Omit to hide the action. */
  onRunNow?: (id: string) => void;
  /** Called with the task id when the user activates "Delete". Omit to hide the action. */
  onDelete?: (id: string) => void;
  /** Localized labels. */
  labels?: ScheduledTaskCardLabels;
  /** Style overrides. */
  styles?: ScheduledTaskCardStyles;
  /** Additional CSS class applied to the card root. */
  className?: string;
}
