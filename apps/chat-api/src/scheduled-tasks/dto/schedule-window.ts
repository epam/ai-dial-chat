const OFFSET_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when the ISO datetime names an absolute instant (`Z` or a numeric offset). */
const hasOffset = (value: string): boolean => OFFSET_SUFFIX_PATTERN.test(value);

/**
 * Converts a trigger datetime to a number that orders consistently with the
 * other boundary of the same window. Offset-less values are zone-local wall
 * time, read as if it were UTC, so they never depend on the server's own zone.
 */
export const toWindowOrderMs = (value: string): number => {
  if (hasOffset(value)) {
    return Date.parse(value);
  }
  return Date.parse(
    `${DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00` : value}Z`,
  );
};

/** True when both boundaries carry the same kind of value (both offset-less or both absolute). */
export const areBoundariesComparable = (start: string, end: string): boolean =>
  hasOffset(start) === hasOffset(end);
