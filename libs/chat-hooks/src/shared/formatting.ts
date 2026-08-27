/** Pads a number or numeric string to at least 2 digits with a leading zero (e.g. `9` / `'9'` → `'09'`). */
export const padTwoDigits = (value: number | string): string =>
  String(value).padStart(2, '0');

/** Formats a Unix timestamp (ms) as a locale-formatted calendar date, e.g. `'22/7/2026'`. */
export const formatCalendarDate = (timestampMs: number): string =>
  new Date(timestampMs).toLocaleDateString();
