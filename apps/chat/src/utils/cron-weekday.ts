/* DIAL Scheduler's `day_of_week` uses the APScheduler convention (Monday=0..Sunday=6),
 * while JS `Date` getters use Sunday=0..Saturday=6 — these convert between the two.
 * Confirmed against apps/chat-api/src/scheduled-tasks/dto/cron-fields.validator.ts. */
export const apSchedulerDayToJsDay = (apSchedulerDay: number): number =>
  (apSchedulerDay + 1) % 7;

export const jsDayToApSchedulerDay = (jsDay: number): number => (jsDay + 6) % 7;
