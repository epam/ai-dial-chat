/**
 * Resolved visual status of a scheduled-task card, returned by
 * `getScheduledTaskStatus`. Distinct from the host-supplied input
 * `ScheduledTaskPresentationStatus` (the optional override on
 * `ScheduledTaskItem`), which maps onto this enum: `Active` → `Scheduled`.
 */
export enum ScheduledTaskStatus {
  /** The schedule pill with the task's schedule label. */
  Scheduled = 'scheduled',
  /** The "Paused" badge, for a task the user deactivated. */
  Paused = 'paused',
  /** The "Completed" badge, for a one-time task that has finished running. */
  Completed = 'completed',
}
