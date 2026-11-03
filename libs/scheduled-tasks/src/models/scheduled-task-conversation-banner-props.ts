import type { ReactNode } from 'react';

/** User-visible strings of `ScheduledTaskConversationBanner`. */
export interface ScheduledTaskConversationBannerLabels {
  /** Announced while the task loads. Defaults to `'Loading task details…'`. */
  loadingLabel?: string;
  /** Shown and announced when the task cannot be shown. Defaults to `'Task details are unavailable'`. */
  unavailableLabel?: string;
  /** Visible label of the retry button. Defaults to `'Retry'`. */
  retryLabel?: string;
  /** Accessible name of the retry button. Defaults to `'Retry loading task details'`. */
  retryAriaLabel?: string;
  /** Visible label of the task details link. Defaults to `'Task details'`. */
  taskDetailsLabel?: string;
  /** Accessible name of the task details link for `taskName`. Defaults to `` (taskName) => `View task details for ${taskName}` ``. */
  taskDetailsAriaLabel?: (taskName: string) => string;
  /** Shown in place of the details link when the task was deleted. Defaults to `'Task was deleted'`. */
  taskDeletedLabel?: string;
}

/** Color overrides of `ScheduledTaskConversationBanner`, applied as CSS custom properties. */
export interface ScheduledTaskConversationBannerColors {
  /** Card background. Defaults to `--bg-layer-sunken`. */
  surface?: string;
  /** Card border. Defaults to `--stroke-secondary`. */
  border?: string;
  /** Task name, run time and unavailable message. Defaults to `--text-primary`. */
  text?: string;
  /** Task details link text and chevron. Defaults to `--text-accent`. */
  detailsLink?: string;
  /** Task details link background on hover and keyboard focus. Defaults to `--bg-control-accent-alpha-hover`. */
  detailsLinkHoverSurface?: string;
  /** Task details link focus outline. Defaults to `--stroke-focus`. */
  focusOutline?: string;
  /** Task-deleted note. Defaults to `--text-secondary`. */
  deletedText?: string;
}

/** Props the host's details link element receives from `ScheduledTaskConversationBanner`. */
export interface ScheduledTaskConversationBannerDetailsLinkProps {
  /** Classes to put on the link element. */
  className: string;
  /** Accessible name of the link. */
  'aria-label': string;
  /** Link content: the label and the directional chevron. */
  children: ReactNode;
}

/** Props for `ScheduledTaskConversationBanner`. */
export interface ScheduledTaskConversationBannerProps {
  /** Whether the task is loading; shows a skeleton and announces `labels.loadingLabel`. Defaults to `false`. */
  isLoading?: boolean;
  /** Whether the task cannot be shown; shows `labels.unavailableLabel`. Defaults to `false`. */
  isUnavailable?: boolean;
  /** Whether the task was deleted; replaces the details link with `labels.taskDeletedLabel`. Defaults to `false`. */
  isTaskDeleted?: boolean;
  /** Task name shown on the card. */
  displayName: string;
  /** Pre-formatted run time shown after the name, when known. */
  timestampLabel?: string;
  /** Renders the task details link; the host owns the route and the router element. */
  renderDetailsLink: (
    props: ScheduledTaskConversationBannerDetailsLinkProps,
  ) => ReactNode;
  /** Retries loading the task; when set, the unavailable state shows a retry button. */
  onRetry?: () => void;
  /** User-visible strings, each with an English default. */
  labels?: ScheduledTaskConversationBannerLabels;
  /** Color overrides, applied as CSS custom properties. */
  colors?: ScheduledTaskConversationBannerColors;
  /** CSS class of the task name. Defaults to `'dial-small-semi-text'`. */
  nameClassName?: string;
  /** CSS class of the run time and the unavailable message. Defaults to `'dial-small-text'`. */
  textClassName?: string;
  /** CSS class of the details link and the task-deleted note. Defaults to `'dial-tiny-semi-text'`. */
  actionClassName?: string;
  /** Additional classes merged over the card root. */
  className?: string;
}
