/** Visual status of a scheduled-task card, resolved by `getScheduledTaskStatus`. */
export enum ScheduledTaskStatus {
  /** The schedule pill with the task's schedule label. */
  Scheduled = 'scheduled',
  /** The "Paused" badge, for a task the user deactivated. */
  Paused = 'paused',
  /** The "Completed" badge, for a one-time task that has finished running. */
  Completed = 'completed',
}
