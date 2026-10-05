/*
 * DIAL Scheduler executes cron fields in UTC with no per-schedule timezone,
 * so a local day-of-month moves by one calendar day whenever the local→UTC
 * time conversion crosses midnight. Shifting the number arithmetically, rather
 * than rolling a `Date` to that day, keeps short months (and the 1st, whose
 * UTC predecessor has no fixed number) from corrupting the stored value.
 */

/** APScheduler `day` expression for the last day of the month. */
export const CRON_LAST_DAY_OF_MONTH = 'last';

const MAX_DAY_OF_MONTH = 31;
const MS_PER_DAY = 86_400_000;

/**
 * Calendar days between `date`'s UTC date and its local date: `-1` when UTC is
 * still on the previous day (east of UTC), `1` when it has reached the next.
 */
export const getUtcDayShift = (date: Date): number =>
  Math.round(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      MS_PER_DAY,
  );

/**
 * Converts a local day-of-month to the UTC `day` cron value. The local 1st
 * shifted back is always the previous month's last day, hence `'last'`. The
 * local 31st shifted forward stays `'1'`: a single cron field cannot express
 * "the 1st after a 31-day month only".
 */
export const toUtcCronDayOfMonth = (
  localDay: number,
  utcDayShift: number,
): string => {
  const utcDay = localDay + utcDayShift;
  if (utcDay < 1) return CRON_LAST_DAY_OF_MONTH;
  if (utcDay > MAX_DAY_OF_MONTH) return '1';
  return String(utcDay);
};

/**
 * Inverts {@link toUtcCronDayOfMonth}; returns `undefined` for a value the
 * form cannot represent. A UTC 31st shifted forward maps to the 1st, so tasks
 * saved before `'last'` was emitted still open in the editor.
 */
export const toLocalDayOfMonth = (
  utcDay: string,
  utcDayShift: number,
): string | undefined => {
  if (utcDay === CRON_LAST_DAY_OF_MONTH)
    return utcDayShift === -1 ? '1' : undefined;
  const utcDayNumber = Number(utcDay);
  if (
    !/^\d+$/.test(utcDay) ||
    utcDayNumber < 1 ||
    utcDayNumber > MAX_DAY_OF_MONTH
  )
    return undefined;
  const localDay = utcDayNumber - utcDayShift;
  if (localDay < 1) return String(MAX_DAY_OF_MONTH);
  if (localDay > MAX_DAY_OF_MONTH) return '1';
  return String(localDay);
};
