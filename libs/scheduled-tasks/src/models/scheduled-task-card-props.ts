import type { ScheduledTaskItem } from './scheduled-task-item';

/** Localized labels used by the {@link ScheduledTaskCard} component. All have English defaults. */
export interface ScheduledTaskCardLabels {
  /** Label shown in the "new" badge when `item.isNew` is set. Defaults to `'NEW'`. */
  newBadgeLabel?: string;
  /** Label shown in the "Paused" badge when `item.isActive` is `false`. Defaults to `'Paused'`. */
  pausedBadgeLabel?: string;
}

/**
 * Color overrides for the {@link ScheduledTaskCard} component, applied as CSS
 * custom properties with app theme fallbacks.
 */
export interface ScheduledTaskCardColors {
  /** Card title text color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Description/prompt-preview text color. Fallback: `--text-control-disable-beta`. */
  descriptionText?: string;
  /** Schedule pill background. Fallback: `--bg-layer-sunken`. */
  schedulePillBackground?: string;
  /** Schedule pill border color. Fallback: `--stroke-tertiary`. */
  schedulePillBorder?: string;
  /** Schedule pill label text color. Fallback: `--text-control-disable-beta`. */
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
  /** "Paused" badge background. Fallback: `--bg-layer-sunken`. */
  pausedBadgeBackground?: string;
  /** "Paused" badge border color. Fallback: `--stroke-tertiary`. */
  pausedBadgeBorder?: string;
  /** "Paused" badge icon and text color. Fallback: `--text-control-disable-beta`. */
  pausedBadgeText?: string;
}

/** Typography overrides for the {@link ScheduledTaskCard} component. */
export interface ScheduledTaskCardTypography {
  /** CSS class applied to the card's title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the description/prompt-preview line. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
  /** CSS class applied to the description's size. Defaults to `'dial-tiny-text'`. */
  descriptionSizeClassName?: string;
  /** CSS class applied to the schedule pill's label text. Defaults to `'dial-tiny-text'`. */
  scheduleLabelClassName?: string;
  /** CSS class applied to non-leaf location breadcrumb segments. Defaults to `'dial-tiny-text'`. */
  locationLabelClassName?: string;
  /** CSS class applied to the leaf (last) location breadcrumb segment. Defaults to `'dial-tiny-semi-text'`. */
  locationLeafClassName?: string;
  /** CSS class applied to the "new" badge text. Defaults to `'dial-tiny-semi-text'`. */
  newBadgeClassName?: string;
  /** CSS class applied to the "Paused" badge's label text. Defaults to `'dial-tiny-text'`. */
  pausedBadgeClassName?: string;
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
  /** Called with the task id when the user activates the card body (click or Enter/Space). When omitted, the card renders with no added interactive root semantics. */
  onCardClick?: (id: string) => void;
  /** Localized labels. */
  labels?: ScheduledTaskCardLabels;
  /** Style overrides. */
  styles?: ScheduledTaskCardStyles;
  /** Additional CSS class applied to the card root. */
  className?: string;
}
