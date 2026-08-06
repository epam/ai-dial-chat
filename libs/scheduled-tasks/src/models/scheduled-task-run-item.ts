import type { ScheduledTaskRunStatus } from '../types/scheduled-task-run-status';

/**
 * A single scheduled task run rendered as a row in the History panel. All
 * strings are pre-formatted by the host app — the lib performs no date,
 * duration, or locale formatting.
 */
export interface ScheduledTaskRunItem {
  /** Stable identifier for this run. */
  id: string;
  /** Outcome of this run, driving the row's status icon. */
  status: ScheduledTaskRunStatus;
  /** Pre-formatted timestamp, optionally including a duration suffix, e.g. `"today at 9:01 AM (99s)"`. */
  timestampLabel: string;
}
