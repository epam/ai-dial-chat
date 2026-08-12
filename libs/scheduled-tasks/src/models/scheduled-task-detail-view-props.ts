import type { ReactNode } from 'react';
import type { ScheduledTaskRunStatus } from '../types/scheduled-task-run-status';
import type { ScheduledTaskRunItem } from './scheduled-task-run-item';

/** Localized labels used by the {@link ScheduledTaskDetailView} component. */
export interface ScheduledTaskDetailViewLabels {
  /** Accessible label for the back-navigation control. */
  backAriaLabel: string;
  /** Label for the header's Edit action. Shown only when `onEdit` is supplied. */
  editButtonLabel: string;
  /** Label for the header's destructive Delete action. Shown only when `onDelete` is supplied. */
  deleteButtonLabel: string;
  /** Label of the read-only indicator shown next to the title when `isDeleted` is `true`. */
  deletedStateLabel: string;
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
  /** Accessible name and visible label of the header's Active switch. Distinct from `activeWindowLabel`, which describes the cron activity date window. Shown only when `isActive` is defined. */
  activeStatusLabel: string;
  /** Announced via `aria-live` after a pause/resume mutation completes, separate from the switch's own accessible name. Empty string announces nothing. */
  activeStatusAnnouncement?: string;
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
  /** Label for the "Show more" button rendered below the loaded runs when `runsHasMore` is `true`. Required when `onRunsLoadMore` is supplied. */
  historyShowMoreLabel?: string;
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
  /** Success status icon color. Fallback: `--text-success`. */
  successIconColor?: string;
  /** Error status icon color. Fallback: `--text-error`. */
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
  /** Called when the user activates the header's Edit action. When omitted, no Edit action renders. Suppressed while `isDeleted` is `true`. */
  onEdit?: () => void;
  /** Called when the user activates the header's destructive Delete action. When omitted, no Delete action renders. Suppressed while `isDeleted` is `true`. The component opens no dialog and performs no network call itself. */
  onDelete?: () => void;
  /** When `true`, the Delete action, Edit action, and Active switch render disabled rather than being removed. Defaults to `false`. */
  isDeleting?: boolean;
  /** When `true`, the header renders a read-only deleted-state indicator instead of the Delete, Edit, and Active controls, regardless of whether `onDelete`/`onEdit`/`isActive` are supplied. Defaults to `false`. */
  isDeleted?: boolean;
  /** Whether the schedule is currently active (resumed) or paused. When `undefined`, the Active switch does not render. Suppressed while `isDeleted` is `true`. */
  isActive?: boolean;
  /** When `true`, the Active switch renders disabled while a pause/resume request is in flight. Defaults to `false`. */
  isActiveUpdating?: boolean;
  /** When `true`, the Active switch renders disabled (e.g. a completed one-time schedule that cannot be resumed), independent of `isActiveUpdating`. Defaults to `false`. */
  isActiveDisabled?: boolean;
  /** Called with the newly requested value when the user toggles the Active switch. The component performs no network call or optimistic update itself. */
  onActiveChange?: (nextActive: boolean) => void;
  /** Task title shown in the header and used as the page's accessible name. */
  displayName: string;
  /** When `true`, the entire body (Details, Configuration, and History) shows a page-level spinner instead of the fields below. Defaults to `false`. */
  isLoading?: boolean;
  /** When set, the entire body (Details, Configuration, and History) shows an error message and retry action instead of the fields below. */
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
  /** Raw instructions markdown, passed to `renderInstructions` when supplied, or rendered via the default `MDMessageViewer` otherwise. Omit to hide the field entirely. */
  instructionsMarkdown?: string;
  /** Renders `instructionsMarkdown` as a ReactNode. When omitted, `instructionsMarkdown` is rendered via `MDMessageViewer` (the same markdown stack chat assistant messages use). */
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
  /** Called when the user activates the "Show more" button, rendered below the loaded runs while `runsHasMore` is `true`. Omit to hide the button entirely. */
  onRunsLoadMore?: () => void;
  /** Called with a run's id when the user clicks its row. Omit to render rows with no added interactive semantics. */
  onRunClick?: (id: string) => void;
  /** Style overrides. */
  styles?: ScheduledTaskDetailViewStyles;
}
