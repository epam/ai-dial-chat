/** How often a scheduled task repeats. */
export enum ScheduledTaskRepeat {
  /** Task runs once at the date/time specified by `runAt`. */
  OneTime = 'oneTime',
  /** Task runs every hour, at the start of the hour. */
  Hourly = 'hourly',
  /** Task runs every day at the specified `time`. */
  Daily = 'daily',
  /** Task runs every week on `dayOfWeek` at the specified `time`. */
  Weekly = 'weekly',
  /** Task runs every month on `dayOfMonth` at the specified `time`. */
  Monthly = 'monthly',
}
