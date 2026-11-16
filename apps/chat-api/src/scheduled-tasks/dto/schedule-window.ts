const OFFSET_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when the ISO datetime names an absolute instant (`Z` or a numeric offset). */
const hasOffset = (value: string): boolean => OFFSET_SUFFIX_PATTERN.test(value);

/** Reads an offset-less datetime as if its wall clock were UTC; only the ordering of such values matters. */
const wallAsUtcMs = (value: string): number =>
  Date.parse(`${DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00` : value}Z`);

const zoneOffsetMs = (instantMs: number, timezone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const wallMs = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return wallMs - Math.floor(instantMs / 1000) * 1000;
};

/** Resolves a wall-clock time in `timezone` to an instant; a missing local time resolves forward, a repeated one to its first occurrence. */
const zonedWallToInstantMs = (wallMs: number, timezone: string): number => {
  const firstOffset = zoneOffsetMs(wallMs, timezone);
  const guess = wallMs - firstOffset;
  const secondOffset = zoneOffsetMs(guess, timezone);
  return secondOffset === firstOffset ? guess : wallMs - secondOffset;
};

/**
 * Converts a trigger datetime to a number that orders consistently with the
 * other boundary of the same window. Offset-less values are zone-local wall
 * time, so they never depend on the server's own time zone.
 */
export const toWindowOrderMs = (
  value: string,
  timezone: string,
  convertToInstant: boolean,
): number => {
  if (hasOffset(value)) {
    return Date.parse(value);
  }
  const wallMs = wallAsUtcMs(value);
  return convertToInstant ? zonedWallToInstantMs(wallMs, timezone) : wallMs;
};

/** True when both boundaries carry the same kind of value (both offset-less or both absolute). */
export const areBoundariesComparable = (start: string, end: string): boolean =>
  hasOffset(start) === hasOffset(end);
