/** Section a {@link ScheduledTaskItem} is grouped under in the card grid. */
export enum ScheduledTaskSectionKey {
  /** Tasks shared from another user or accessible at the organization level. */
  Shared = 'shared',
  /** Tasks owned by the current user. */
  MyTasks = 'myTasks',
}

/** Pre-computed values used to sort a {@link ScheduledTaskItem}; any field may be absent if the source data doesn't provide it, in which case that item sorts last for the corresponding sort key. */
export interface ScheduledTaskSortValues {
  /** ISO timestamp of the next scheduled run, used by the `firstToRun`/`lastToRun` sort keys. */
  nextRunAt?: string;
  /** ISO timestamp the task was created, used by the `newest` sort key. */
  createdAt?: string;
}

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
  /** Section this item is grouped under in the card grid. */
  sectionKey: ScheduledTaskSectionKey;
  /** Values used to sort this item; see {@link ScheduledTaskSortValues}. */
  sortValues: ScheduledTaskSortValues;
}
