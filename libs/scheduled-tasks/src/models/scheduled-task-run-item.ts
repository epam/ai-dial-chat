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
  /** Id of the conversation this run produced, when one exists. When set together with `onRunClick`, the row renders as interactive. */
  conversationId?: string;
  /** Whether this run's conversation is unread. When `true`, the row renders the unread-dot indicator. Defaults to `false`. */
  isUnread?: boolean;
  /** Pre-formatted failure details for an `Error` run. When set on an `Error` row, the status icon reveals it in a tooltip on hover/focus and it is appended to the row's accessible name. Ignored for every other status. */
  errorText?: string;
}
