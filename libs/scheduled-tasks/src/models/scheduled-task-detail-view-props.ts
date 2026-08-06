import type { ReactNode } from 'react';
import type { ScheduledTaskRunStatus } from '../types/scheduled-task-run-status';
import type { ScheduledTaskRunItem } from './scheduled-task-run-item';

/** Localized labels used by the {@link ScheduledTaskDetailView} component. */
export interface ScheduledTaskDetailViewLabels {
  /** Accessible label for the back-navigation control. */
  backAriaLabel: string;
  /** Message shown alongside the page-level retry action when `error` is set. */
  errorLabel: string;
  /** Title of the Details section. */
  detailsTitle: string;
  /** Label for the description field. */
  descriptionLabel: string;
  /** Label for the model/agent field. */
  modelLabel: string;
  /** Label for the recurrence field, e.g. "Repeats". */
  repeatsLabel: string;
  /** Label for the activity-window field, e.g. "Active". Shown only for a recurring task whose window is bounded. */
  activeWindowLabel: string;
  /** Title of the Configuration section. */
  configurationTitle: string;
  /** Label for the instructions field. */
  instructionsLabel: string;
  /** Label for the page-level retry action shown alongside `error`. */
  retryLabel: string;
  /** Title of the History panel. */
  historyTitle: string;
  /** Message shown when the task has no runs yet. */
  historyEmptyLabel: string;
  /** Message shown alongside the retry action when `runsError` is set. */
  historyErrorLabel: string;
  /** Label for the History retry action. */
  historyRetryLabel: string;
  /** Announced via `aria-live` while a load-more runs fetch is in flight. */
  historyLoadingMoreLabel?: string;
  /** Per-status label used to build each run row's accessible name, e.g. `{ success: 'Succeeded', ... }`. */
  runStatusLabels: Record<ScheduledTaskRunStatus, string>;
}

/**
 * Color overrides for the {@link ScheduledTaskDetailView} component, applied
 * as CSS custom properties with app theme fallbacks.
 */
export interface ScheduledTaskDetailViewColors {
  /** Root container background. Fallback: `--bg-layer-base`. */
  background?: string;
  /** Header bottom border. Fallback: `--stroke-tertiary`. */
  headerBorder?: string;
  /** Details/Configuration column end border. Fallback: `--stroke-tertiary`. */
  detailsColumnBorder?: string;
  /** Section subtitle and status-message text color. Fallback: `--text-secondary`. */
  subtitleText?: string;
  /** Success status icon color. Fallback: `--controls-bg-accent-primary` (a green success token). */
  successIconColor?: string;
  /** Error status icon color. Fallback: `--controls-bg-error`. */
  errorIconColor?: string;
  /** Missed status icon color. Fallback: `--text-secondary`. */
  missedIconColor?: string;
  /** History card background. Fallback: `--bg-layer-raised`. */
  historyCardBackground?: string;
}

/** Typography overrides for the {@link ScheduledTaskDetailView} component. */
export interface ScheduledTaskDetailViewTypography {
  /** CSS class applied to the header title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to section titles. Defaults to `'dial-body-semi-text'`. */
  sectionTitleClassName?: string;
  /** CSS class applied to field labels. Defaults to `'dial-tiny-text'`. */
  fieldLabelClassName?: string;
  /** CSS class applied to field values. Defaults to `'dial-body-text'`. */
  fieldValueClassName?: string;
  /** CSS class applied to each run row's timestamp text. Defaults to `'dial-small-text'`. */
  runTimestampClassName?: string;
}

/** Style overrides for the {@link ScheduledTaskDetailView} component. */
export interface ScheduledTaskDetailViewStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ScheduledTaskDetailViewColors;
  /** Typography class overrides. */
  typography?: ScheduledTaskDetailViewTypography;
}

/** Props for the {@link ScheduledTaskDetailView} component. */
export interface ScheduledTaskDetailViewProps {
  /** Localized labels. */
  labels: ScheduledTaskDetailViewLabels;
  /** Called when the user activates the back-navigation control. */
  onBack: () => void;
  /** Task title shown in the header and used as the page's accessible name. */
  displayName: string;
  /** When `true`, the Details/Configuration sections show a loading state instead of the fields below. Defaults to `false`. */
  isLoading?: boolean;
  /** When set, the page shows an error message and retry action instead of the Details/Configuration/History sections. */
  error?: Error | null;
  /** Called when the user activates the retry action shown alongside `error`. */
  onRetry?: () => void;
  /** Task description. Omit to hide the field. */
  description?: string;
  /** Resolved "Model or Agent" display value (already resolved to a display name, or the raw id as a fallback). */
  modelLabel?: string;
  /** Pre-formatted recurrence label, e.g. "Every Monday 12:00". */
  repeatsLabel?: string;
  /** Pre-formatted activity-window label, e.g. "Aug 1, 2026 – Dec 31, 2026". Omit to hide (unbounded or one-shot schedule). */
  activeWindowLabel?: string;
  /** Raw instructions markdown. Used only when `renderInstructions` is not supplied. */
  instructionsMarkdown?: string;
  /** Renders `instructionsMarkdown` as a ReactNode. When omitted, `instructionsMarkdown` is rendered as plain preformatted text. */
  renderInstructions?: (markdown: string) => ReactNode;
  /** Pre-formatted "Next run" label shown under the History title, e.g. "Next run: Jul 31 at 9:00 AM". Omit to hide (e.g. when the schedule is paused or inactive). */
  nextRunLabel?: string;
  /** Runs to render in the History panel, in the order they should display (server order, newest first). */
  runs: ScheduledTaskRunItem[];
  /** When `true` and `runs` is empty, the History panel shows a loading state (skeleton rows) instead of `historyEmptyLabel`. Defaults to `false`. */
  runsIsLoading?: boolean;
  /** When `true`, `runsSkeletonCount` placeholder rows render below the loaded runs while the next page is fetched. Defaults to `false`. */
  runsIsLoadingMore?: boolean;
  /** Number of placeholder rows shown during initial load and load-more. Defaults to `6`. */
  runsSkeletonCount?: number;
  /** When set, the History panel shows an error message and retry action instead of `runs`. */
  runsError?: Error | null;
  /** Called when the user activates the History retry action shown alongside `runsError`. */
  onRunsRetry?: () => void;
  /** Whether another page of `runs` is available beyond what has been loaded so far. Defaults to `false`. */
  runsHasMore?: boolean;
  /** Called when the History panel's trailing scroll sentinel becomes visible and `runsHasMore && !runsIsLoadingMore && !runsIsLoading`. */
  onRunsLoadMore?: () => void;
  /** Called with a run's id when the user clicks its row. Omit to render rows with no added interactive semantics. */
  onRunClick?: (id: string) => void;
  /** Style overrides. */
  styles?: ScheduledTaskDetailViewStyles;
}
