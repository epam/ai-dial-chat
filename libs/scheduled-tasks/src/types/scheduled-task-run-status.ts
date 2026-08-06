/** Status of a single scheduled task run, shown as an icon in the History panel. */
export enum ScheduledTaskRunStatus {
  /** The run completed successfully. */
  Success = 'success',
  /** The run failed. */
  Error = 'error',
  /** The run is currently executing. */
  InProgress = 'inProgress',
  /** The scheduled run never started (e.g. the schedule was paused or the runner was unavailable). */
  Missed = 'missed',
}
