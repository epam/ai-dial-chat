import type { CalendarValue } from '@epam/ai-dial-ui-kit';

const pad = (value: number): string => String(value).padStart(2, '0');

/** 24-hour `HH:mm` time-of-day, matching the `Calendar` time control's value shape. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Separator between the date and time parts of a `datetime-local` value. */
export const DATETIME_LOCAL_SEPARATOR = 'T';

/** Length of a date-only `YYYY-MM-DD` value; longer values carry a `THH:mm` time part. */
export const DATE_ONLY_VALUE_LENGTH = 10;

/** Whether a value carries a time part (`YYYY-MM-DDTHH:mm`), rather than being date-only `YYYY-MM-DD`. */
export const isDateTimeLocalValue = (value: string): boolean =>
  value.length > DATE_ONLY_VALUE_LENGTH;

/** Converts the `datetime-local`-style `values.runAt` string to a `Date` for `Calendar`'s controlled value, or `null` when empty. */
export const runAtToCalendarValue = (runAt: string | undefined): Date | null =>
  runAt ? new Date(runAt) : null;

/** Converts `Calendar`'s `CalendarValue` back to the `datetime-local`-style string `values.runAt` expects. */
export const calendarValueToRunAt = (value: CalendarValue): string => {
  if (value == null) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}${DATETIME_LOCAL_SEPARATOR}${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/*
 * Constructs the Date from local year/month/day components rather than
 * `new Date(dateValue)`, since the latter parses a bare `YYYY-MM-DD` string
 * as UTC midnight per the ECMA-262 date-time string format — which would
 * shift the displayed calendar day by one in any timezone behind UTC.
 */
/** Converts a window-boundary value — date-only `YYYY-MM-DD` or hourly `YYYY-MM-DDTHH:mm` — to a `Date` for `Calendar`'s controlled value, or `null` when empty. */
export const dateValueToCalendarValue = (
  dateValue: string | undefined,
): Date | null => {
  if (!dateValue) {
    return null;
  }
  /* A datetime-local string parses as local wall-clock; only the bare
   * date-only form needs component-wise construction. */
  if (isDateTimeLocalValue(dateValue)) {
    return new Date(dateValue);
  }
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Converts `Calendar`'s `CalendarValue` back to a `YYYY-MM-DD` date-only string, distinct from `calendarValueToRunAt`'s `datetime-local` output. */
export const calendarValueToDateValue = (value: CalendarValue): string => {
  if (value == null) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Converts `values.dayOfWeek` (`'0'`=Monday..`'6'`=Sunday) to `Calendar`'s `weekday` mode value (ISO `'1'`=Monday..`'7'`=Sunday), or `null` when unset. */
export const dayOfWeekToCalendarValue = (
  dayOfWeek: string | undefined,
): string | null => {
  const value = Number(dayOfWeek);
  return dayOfWeek && Number.isFinite(value) ? String(value + 1) : null;
};

/** Converts `Calendar`'s `weekday` mode `CalendarValue` (ISO `'1'`=Monday..`'7'`=Sunday) back to `values.dayOfWeek` (`'0'`=Monday..`'6'`=Sunday). */
export const calendarValueToDayOfWeek = (value: CalendarValue): string => {
  const isoWeekday = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(isoWeekday) ? String(isoWeekday - 1) : '';
};
