/*
 * The single entry point for every date and time a scheduled task shows: the
 * Details panel, History, task cards and the create/edit form. Each helper takes
 * the display `locale` and lets `Intl` pick the order and the 12/24-hour clock,
 * so one task never mixes `3:00 PM` with `15:00`.
 *
 * Two kinds of input are formatted differently on purpose:
 * - a wall time stored in the task's own zone (`HH:mm`, `YYYY-MM-DDTHH:mm`)
 *   is shown as written — it is read as UTC and formatted as UTC, so the
 *   viewer's zone never shifts it;
 * - an absolute instant (`nextRunTime`, a run's start) is shown in the
 *   viewer's zone.
 */

/** A zone-local `YYYY-MM-DDTHH:mm`, the shape the wall-time formatter can show. */
export const SCHEDULED_TASK_WALL_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const WALL_CLOCK_TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** Style of a weekday name. */
export enum ScheduledTaskWeekdayStyle {
  Long = 'long',
  Narrow = 'narrow',
}

/**
 * Formats a stored `HH:mm` wall time as the locale's short clock time (`9:00 AM`
 * or `09:00`) without converting it to another zone. Returns the raw value when
 * it is not a valid `HH:mm`.
 */
export const formatScheduledTaskClockTime = (
  time: string,
  locale?: string,
): string => {
  const match = WALL_CLOCK_TIME_PATTERN.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return time;
  return new Intl.DateTimeFormat(locale, {
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(1970, 0, 1, hour, minute)));
};

/** Formats a zone-local `YYYY-MM-DDTHH:mm` as a medium date and short time without converting it to another zone. */
export const formatZonedDateTime = (
  dateTime: string,
  locale?: string,
): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateTime}:00Z`));

/**
 * Formats an absolute instant (an ISO string such as `nextRunTime`) as a medium
 * date and short time in the viewer's zone. Returns the raw value when it is
 * not a date.
 */
export const formatScheduledTaskInstant = (
  instant: string,
  locale?: string,
): string => {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(instant));
  } catch {
    return instant;
  }
};

/** Formats the time of day of an instant as the locale's short time in the viewer's zone, e.g. `11:00 AM`. */
export const formatScheduledTaskRunTime = (
  date: Date,
  locale?: string,
): string =>
  new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);

/** Formats the calendar day of an instant without a year in the viewer's zone, e.g. `Nov 17`. */
export const formatScheduledTaskRunDate = (
  date: Date,
  locale?: string,
): string =>
  new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
    date,
  );

/**
 * Formats an APScheduler weekday (`'0'` is Monday) as its localized name.
 * 2023-01-02 was a Monday and the formatter runs in UTC, so the name is the
 * segment's own day, not the viewer's local calendar's.
 */
export const formatScheduledTaskWeekday = (
  dayOfWeek: string | number | undefined,
  locale?: string,
  style: ScheduledTaskWeekdayStyle = ScheduledTaskWeekdayStyle.Long,
): string =>
  new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 0, 2 + Number(dayOfWeek))),
  );

/** Formats several APScheduler weekdays as one locale list, e.g. `Monday, Wednesday and Friday`. */
export const formatScheduledTaskWeekdays = (
  daysOfWeek: string[],
  locale?: string,
): string =>
  new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    daysOfWeek.map((dayOfWeek) =>
      formatScheduledTaskWeekday(dayOfWeek, locale),
    ),
  );
