import type { ReactNode } from 'react';
import type { ScheduledTaskRunStatus } from '../types/scheduled-task-run-status';
import type { ScheduledTaskRunItem } from './scheduled-task-run-item';

/** Localized labels used by the {@link ScheduledTaskRunHistoryList} component. */
export interface ScheduledTaskRunHistoryListLabels {
  /** Accessible label applied to the row list, e.g. "History". */
  historyTitle: string;
  /** Message shown when `items` is empty and `isLoading` is `false`. */
  emptyLabel: string;
  /** Message shown alongside the retry action when `error` is set. */
  errorLabel: string;
  /** Label for the retry action shown alongside `error`. */
  retryLabel: string;
  /** Per-status label used to build each run row's accessible name, e.g. `{ success: 'Succeeded', ... }`. */
  runStatusLabels: Record<ScheduledTaskRunStatus, string>;
  /** Appended to the current run row's accessible name, e.g. "Current run". Omit to skip the accessible current-run suffix. */
  currentRunLabel?: string;
}

/**
 * Color overrides for the {@link ScheduledTaskRunHistoryList} component, applied
 * as CSS custom properties with app theme fallbacks.
 */
export interface ScheduledTaskRunHistoryListColors {
  /** Success status icon color. Fallback: `--text-success`. */
  successIconColor?: string;
  /** Error status icon color. Fallback: `--text-error`. */
  errorIconColor?: string;
  /** Missed status icon color. Fallback: `--text-secondary`. */
  missedIconColor?: string;
  /** Error/empty message text color. Fallback: `--text-secondary`. */
  subtitleTextColor?: string;
  /** Current-run row background. Fallback: `--bg-accent-primary-alpha`. */
  currentRunBackground?: string;
}

/** Typography overrides for the {@link ScheduledTaskRunHistoryList} component. */
export interface ScheduledTaskRunHistoryListTypography {
  /** CSS class applied to each run row's timestamp text. Defaults to `'dial-small-text'`. */
  runTimestampClassName?: string;
}

/** Style overrides for the {@link ScheduledTaskRunHistoryList} component. */
export interface ScheduledTaskRunHistoryListStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ScheduledTaskRunHistoryListColors;
  /** Typography class overrides. */
  typography?: ScheduledTaskRunHistoryListTypography;
}

/** Props for the {@link ScheduledTaskRunHistoryList} component. */
export interface ScheduledTaskRunHistoryListProps {
  /** Runs to render, in the order they should display (server order, newest first). */
  items: ScheduledTaskRunItem[];
  /** When `true` and `items` is empty, shows `skeletonCount` placeholder rows instead of `labels.emptyLabel`. Defaults to `false`. */
  isLoading?: boolean;
  /** When `true`, `skeletonCount` placeholder rows render below the loaded rows. Defaults to `false`. */
  isLoadingMore?: boolean;
  /** Number of placeholder rows shown during `isLoading`/`isLoadingMore`. Defaults to `6`. */
  skeletonCount?: number;
  /** When set, shows an error message and retry action instead of `items`. */
  error?: Error | null;
  /** Called when the user activates the retry action shown alongside `error`. */
  onRetry?: () => void;
  /** The `id` of the run to render with the current-run visual and accessible treatment. Omit to mark no row as current. */
  currentRunId?: string;
  /** Called with a run's id when the user clicks its row. Omit to render rows with no added interactive semantics. */
  onRunClick?: (id: string) => void;
  /** Localized labels. */
  labels: ScheduledTaskRunHistoryListLabels;
  /**
   * Rendered after the loaded rows (and any load-more skeletons). Hosts supply
   * their own pagination trigger here — a scroll sentinel, a "Show more"
   * button, or nothing — the component has no built-in pagination mechanism.
   */
  footer?: ReactNode;
  /** Style overrides. */
  styles?: ScheduledTaskRunHistoryListStyles;
}
