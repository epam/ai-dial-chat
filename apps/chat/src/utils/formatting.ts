/** Pads a number or numeric string to at least 2 digits with a leading zero (e.g. `9` / `'9'` → `'09'`). */
export const padTwoDigits = (value: number | string): string =>
  String(value).padStart(2, '0');
