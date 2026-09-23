/** A single scheduled task rendered as a card in the Scheduled Tasks grid. All strings are pre-formatted by the host app — the lib performs no date/locale formatting. */
export interface ScheduledTaskItem {
  /** Stable identifier for this task. */
  id: string;
  /** Task title shown as the card heading. */
  displayName: string;
  /** Human-readable schedule pill text, e.g. "Every Monday 12:00". */
  scheduleLabel: string;
  /** Optional description or prompt-preview line shown below the title. */
  descriptionPreview?: string;
  /** Optional location breadcrumb segments, outermost first, e.g. `['Public', 'Project folder']`. Each segment is already resolved/localized by the host app. */
  locationSegments?: string[];
  /** When set, the card shows a "new" badge for this task. */
  isNew?: boolean;
  /** When explicitly `false`, the card shows a "Paused" badge in place of the schedule pill. `true` or `undefined` renders the schedule pill as usual. */
  isActive?: boolean;
  /** Optional explicit display status; takes precedence over the derived `isCompleted`/`isActive` statuses. */
  presentationStatus?: ScheduledTaskPresentationStatus;

  /** When `true`, the card shows a "Completed" badge in place of the schedule pill — a task that can no longer produce a future run (a finished one-time task, or a recurring task whose activity window has closed). Pre-resolved by the host app; the lib performs no completion derivation. Takes precedence over `isActive` when both are set. */
  isCompleted?: boolean;
}
export enum ScheduledTaskPresentationStatus {
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
}
