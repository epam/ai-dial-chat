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

/**
 * Color overrides for the {@link ScheduledTaskCard} component, applied as CSS
 * custom properties with app theme fallbacks.
 */
export interface ScheduledTaskCardColors {
  /** Card title text color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Description/prompt-preview text color. Fallback: `--text-control-disable`. */
  descriptionText?: string;
  /** Schedule pill background. Fallback: `--bg-layer-sunken`. */
  schedulePillBackground?: string;
  /** Schedule pill border color. Fallback: `--stroke-tertiary`. */
  schedulePillBorder?: string;
  /** Schedule pill label text color. Fallback: `--text-control-disable`. */
  scheduleLabelText?: string;
  /** Non-leaf location breadcrumb segment text color. Fallback: `--text-secondary`. */
  locationLabelText?: string;
  /** Leaf (last) location breadcrumb segment text color. Fallback: `--text-secondary`. */
  locationLeafText?: string;
  /** "New" badge background. Fallback: `--controls-bg-accent-primary`. */
  newBadgeBackground?: string;
  /** "New" badge text color. Fallback: `--text-control-permanent`. */
  newBadgeText?: string;
  /** Divider border color above the location breadcrumb. Fallback: `--stroke-tertiary`. */
  locationDividerBorder?: string;
}

/** Typography overrides for the {@link ScheduledTaskCard} component. */
export interface ScheduledTaskCardTypography {
  /** CSS class applied to the card's title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the description/prompt-preview line. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
  /** CSS class applied to the schedule pill's label text. Defaults to `'dial-tiny-text'`. */
  scheduleLabelClassName?: string;
  /** CSS class applied to non-leaf location breadcrumb segments. Defaults to `'dial-tiny-text'`. */
  locationLabelClassName?: string;
  /** CSS class applied to the leaf (last) location breadcrumb segment. Defaults to `'dial-tiny-semi-text'`. */
  locationLeafClassName?: string;
  /** CSS class applied to the "new" badge text. Defaults to `'dial-tiny-semi-text'`. */
  newBadgeClassName?: string;
}

/** Style overrides for the {@link ScheduledTaskCard} component. */
export interface ScheduledTaskCardStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ScheduledTaskCardColors;
  /** Typography class overrides. */
  typography?: ScheduledTaskCardTypography;
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
  /** Called with the task id when the user activates the card body (click or Enter/Space). When omitted, the card renders with no added interactive root semantics. */
  onCardClick?: (id: string) => void;
  /** Localized labels. */
  labels?: ScheduledTaskCardLabels;
  /** Style overrides. */
  styles?: ScheduledTaskCardStyles;
  /** Additional CSS class applied to the card root. */
  className?: string;
}
