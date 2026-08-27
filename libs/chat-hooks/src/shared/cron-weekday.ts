/*
 * DIAL Scheduler's `day_of_week` uses the APScheduler convention (Monday=0..Sunday=6),
 * while JS `Date` getters use Sunday=0..Saturday=6 — these convert between the two.
 * Confirmed against apps/chat-api/src/scheduled-tasks/dto/cron-fields.validator.ts.
 */

/** Converts an APScheduler weekday (Monday=0..Sunday=6) to a JS `Date` weekday (Sunday=0..Saturday=6). */
export const apSchedulerDayToJsDay = (apSchedulerDay: number): number =>
  (apSchedulerDay + 1) % 7;

/** Converts a JS `Date` weekday (Sunday=0..Saturday=6) to an APScheduler weekday (Monday=0..Sunday=6). */
export const jsDayToApSchedulerDay = (jsDay: number): number => (jsDay + 6) % 7;
