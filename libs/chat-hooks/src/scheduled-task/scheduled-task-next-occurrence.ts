import type { ScheduleCronDto } from '@epam/ai-dial-chat-api-client';

/** APScheduler `day` expression for the last day of the month. */
const CRON_LAST_DAY_OF_MONTH = 'last';
/* A day-of-month constraint (e.g. the 31st) always matches within a year. */
const MAX_DAYS_TO_NEXT_OCCURRENCE = 366;
const PLAIN_NUMBER = /^\d+$/;

/** Whether a UTC date satisfies the cron's `day_of_week` / `day` constraint. */
const matchesCronDay = (
  date: Date,
  dayOfWeek: string | null | undefined,
  dayOfMonth: string | null | undefined,
): boolean => {
  if (dayOfWeek != null) {
    /* APScheduler weekdays run Monday=0..Sunday=6; JS `getUTCDay` Sunday=0. */
    return (Number(dayOfWeek) + 1) % 7 === date.getUTCDay();
  }
  if (dayOfMonth === CRON_LAST_DAY_OF_MONTH) {
    const nextDay = new Date(date);
    nextDay.setUTCDate(date.getUTCDate() + 1);
    return nextDay.getUTCDate() === 1;
  }
  if (dayOfMonth != null) return Number(dayOfMonth) === date.getUTCDate();
  return true;
};

/**
 * Returns the next UTC time at which a cron trigger with a fixed
 * `hour`/`minute` fires, honouring its `day_of_week` (Weekly) or `day`
 * (Monthly) constraint. Returns `undefined` when the fields are not plain
 * values this helper can evaluate.
 */
export const getNextCronOccurrence = (
  cron: ScheduleCronDto,
  from: Date = new Date(),
): Date | undefined => {
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
    (dayOfWeek != null && !/^[0-6]$/.test(dayOfWeek)) ||
    (dayOfMonth != null &&
      dayOfMonth !== CRON_LAST_DAY_OF_MONTH &&
      !PLAIN_NUMBER.test(dayOfMonth))
  ) {
    return undefined;
  }
  const candidate = new Date(from);
  candidate.setUTCHours(Number(hour), Number(minute), 0, 0);
  for (let i = 0; i <= MAX_DAYS_TO_NEXT_OCCURRENCE; i++) {
    if (candidate > from && matchesCronDay(candidate, dayOfWeek, dayOfMonth)) {
      return candidate;
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return undefined;
};
