import type { ScheduledTaskRunStatus } from '../types/scheduled-task-run-status';
import type { ScheduledTaskHistorySectionVariant } from '../types/scheduled-task-history-section-variant';
import type { ScheduledTaskRunItem } from './scheduled-task-run-item';

/** Localized labels used by the {@link ScheduledTaskHistorySection} component. */
export interface ScheduledTaskHistorySectionLabels {
  /** Title of the History panel, rendered in the card variant's sticky header. */
  historyTitle: string;
  /** Message shown when the task has no runs yet. */
  historyEmptyLabel: string;
  /** Message shown alongside the retry action when `error` is set. */
  historyErrorLabel: string;
  /** Label for the retry action shown alongside `error`. */
  historyRetryLabel: string;
  /** Announced via `aria-live` while a load-more runs fetch is in flight. */
  historyLoadingMoreLabel?: string;
  /** Label for the "Show more" button rendered below the loaded runs when `hasMore` is `true`. Required when `onLoadMore` is supplied. */
  historyShowMoreLabel?: string;
  /** Per-status label used to build each run row's accessible name, e.g. `{ success: 'Succeeded', ... }`. */
  runStatusLabels: Record<ScheduledTaskRunStatus, string>;
  /** `sr-only` label announced alongside the unread-dot indicator on a run row whose `isUnread` is `true`. Defaults to `'Unread'`. */
  unreadIndicatorLabel?: string;
}

/** Status-icon and unread-dot color overrides forwarded to the run list. */
export interface ScheduledTaskHistorySectionColors {
  /** Success status icon color. Fallback: `--text-success`. */
  successIconColor?: string;
  /** Error status icon color. Fallback: `--text-error`. */
  errorIconColor?: string;
  /** Missed status icon color. Fallback: `--text-secondary`. */
  missedIconColor?: string;
  /** Unread-dot indicator fill color. Fallback: `--text-accent`. */
  unreadDotColor?: string;
}

/** Props for the {@link ScheduledTaskHistorySection} component. */
export interface ScheduledTaskHistorySectionProps {
  /** Chrome the section renders: the desktop card or the mobile/tablet page flow. */
  variant: ScheduledTaskHistorySectionVariant;
  /** Localized labels. */
  labels: ScheduledTaskHistorySectionLabels;
  /** Pre-formatted "Next run" label shown under the History title. Omit to hide (e.g. when the schedule is paused or inactive). */
  nextRunLabel?: string;
  /** Runs to render, in the order they should display (server order, newest first). */
  items: ScheduledTaskRunItem[];
  /** When `true` and `items` is empty, shows `skeletonCount` placeholder rows instead of `labels.historyEmptyLabel`. Defaults to `false`. */
  isLoading?: boolean;
  /** When `true`, `skeletonCount` placeholder rows render below the loaded rows while the next page is fetched. Defaults to `false`. */
  isLoadingMore?: boolean;
  /** Number of placeholder rows shown during `isLoading`/`isLoadingMore`. Defaults to `6`. */
  skeletonCount?: number;
  /** When set, shows an error message and retry action instead of `items`. */
  error?: Error | null;
  /** Called when the user activates the retry action shown alongside `error`. */
  onRetry?: () => void;
  /** Whether another page of `items` is available beyond what has been loaded. Defaults to `false`. */
  hasMore?: boolean;
  /** Called when the user activates the "Show more" button, rendered while `hasMore` is `true`. Omit to hide the button entirely. */
  onLoadMore?: () => void;
  /** Called with the run when the user clicks a row whose `conversationId` is set. Rows without a `conversationId` never invoke this, regardless of whether it is supplied. */
  onRunClick?: (run: ScheduledTaskRunItem) => void;
  /** CSS class applied to the "Next run" label. Defaults to `'dial-small-text'`. */
  runTimestampClassName?: string;
  /** CSS class applied to the section title in the card variant. Defaults to `'dial-body-semi-text'`. */
  sectionTitleClassName?: string;
  /** Status-icon and unread-dot color overrides forwarded to the run list. */
  colors?: ScheduledTaskHistorySectionColors;
}
