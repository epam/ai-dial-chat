/** Whether a scheduled task runs once at a specific time or repeats on a cadence. */
export enum ScheduledTaskScheduleType {
  /** Task runs once at the date/time specified by `runAt`. */
  Once = 'once',
  /** Task runs repeatedly on the cadence specified by `frequency`, `time`, `dayOfWeek`, and `dayOfMonth`. */
  Recurring = 'recurring',
}

/** Recurrence cadence for a {@link ScheduledTaskScheduleType.Recurring} schedule type. */
export enum ScheduledTaskFrequency {
  /** Task runs every day at the specified `time`. */
  Daily = 'daily',
  /** Task runs every week on `dayOfWeek` at the specified `time`. */
  Weekly = 'weekly',
  /** Task runs every month on `dayOfMonth` at the specified `time`. */
  Monthly = 'monthly',
}
