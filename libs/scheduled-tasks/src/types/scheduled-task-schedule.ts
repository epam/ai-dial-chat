/** Whether a scheduled task runs once at a specific time or repeats on a cadence. */
export enum ScheduledTaskScheduleType {
  Once = 'once',
  Recurring = 'recurring',
}

/** Recurrence cadence for a {@link ScheduledTaskScheduleType.Recurring} schedule type. */
export enum ScheduledTaskFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}
