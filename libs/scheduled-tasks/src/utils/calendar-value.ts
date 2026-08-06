import type { CalendarValue } from '@epam/ai-dial-ui-kit';

const pad = (value: number): string => String(value).padStart(2, '0');

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
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/*
 * Constructs the Date from local year/month/day components rather than
 * `new Date(dateValue)`, since the latter parses a bare `YYYY-MM-DD` string
 * as UTC midnight per the ECMA-262 date-time string format — which would
 * shift the displayed calendar day by one in any timezone behind UTC.
 */
/** Converts a `YYYY-MM-DD` date-only string (`values.startDate`/`endDate`) to a `Date` for `Calendar`'s controlled value, or `null` when empty. */
export const dateValueToCalendarValue = (
  dateValue: string | undefined,
): Date | null => {
  if (!dateValue) {
    return null;
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
