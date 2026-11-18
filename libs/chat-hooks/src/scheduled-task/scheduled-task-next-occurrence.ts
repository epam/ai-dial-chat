import type { ScheduleCronDto } from '@epam/ai-dial-chat-api-client';
import { getZonedNow } from '@epam/ai-dial-scheduled-tasks';
import { padTwoDigits } from '../shared/formatting';

/** APScheduler `day` expression for the last day of the month, written by older clients. */
const CRON_LAST_DAY_OF_MONTH = 'last';
/* A day-of-month constraint (e.g. the 31st) always matches within a year. */
const MAX_DAYS_TO_NEXT_OCCURRENCE = 366;
const PLAIN_NUMBER = /^\d+$/;
const MS_PER_DAY = 86_400_000;

/** Whether a calendar day (held as UTC midnight) satisfies the cron's `day_of_week` / `day` constraint. */
const matchesCronDay = (
  day: Date,
  dayOfWeek: string | null | undefined,
  dayOfMonth: string | null | undefined,
): boolean => {
  if (dayOfWeek != null) {
    /* APScheduler weekdays run Monday=0..Sunday=6; JS `getUTCDay` Sunday=0. */
    return dayOfWeek
      .split(',')
      .some((entry) => (Number(entry) + 1) % 7 === day.getUTCDay());
  }
  if (dayOfMonth === CRON_LAST_DAY_OF_MONTH) {
    return new Date(day.getTime() + MS_PER_DAY).getUTCDate() === 1;
  }
  if (dayOfMonth != null) return Number(dayOfMonth) === day.getUTCDate();
  return true;
};

/**
 * Returns the next local `YYYY-MM-DDTHH:mm` at which a cron trigger with a
 * fixed `hour`/`minute` fires in `timezone`, honouring its `day_of_week` (a
 * weekday or a comma list of weekdays) or `day` (Monthly) constraint. Cron
 * fields are wall time in the task's zone, so the answer is wall time too.
 * Returns `undefined` when the fields are not plain values this helper can
 * evaluate or the zone is unknown.
 */
export const getNextCronOccurrence = (
  cron: ScheduleCronDto,
  timezone: string,
  from: Date = new Date(),
): string | undefined => {
  const {
    hour,
    minute,
    day_of_week: dayOfWeek,
    day: dayOfMonth,
  } = cron.fields as Record<string, string | null | undefined>;
  if (
    !hour ||
    !minute ||
    !PLAIN_NUMBER.test(hour) ||
    !PLAIN_NUMBER.test(minute) ||
    (dayOfWeek != null && !/^[0-6](?:,[0-6])*$/.test(dayOfWeek)) ||
    (dayOfMonth != null &&
      dayOfMonth !== CRON_LAST_DAY_OF_MONTH &&
      !PLAIN_NUMBER.test(dayOfMonth))
  ) {
    return undefined;
  }
  let now: string;
  try {
    now = getZonedNow(from, timezone).dateTime;
  } catch {
    return undefined;
  }
  const time = `${padTwoDigits(Number(hour))}:${padTwoDigits(Number(minute))}`;
  const today = Date.parse(`${now.slice(0, 10)}T00:00:00Z`);
  for (let i = 0; i <= MAX_DAYS_TO_NEXT_OCCURRENCE; i++) {
    const day = new Date(today + i * MS_PER_DAY);
    const candidate = `${day.toISOString().slice(0, 10)}T${time}`;
    if (candidate > now && matchesCronDay(day, dayOfWeek, dayOfMonth)) {
      return candidate;
    }
  }
  return undefined;
};

/** Returns whether a cron activity window's `endDate` is at or before `now` (epoch ms, default: the current time). */
export const hasScheduledTaskWindowEnded = (
  endDate: string,
  now: number = Date.now(),
): boolean => new Date(endDate).getTime() <= now;
