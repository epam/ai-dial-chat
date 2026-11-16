/*
 * Wall-clock helpers for a task's IANA time zone. They read and write local
 * `YYYY-MM-DDTHH:mm` strings and never use the browser's own zone, so the same
 * input gives the same answer wherever the page runs. Only `Intl` is used.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/** A wall-clock moment in a zone, as the strings the create form edits. */
export interface ZonedNow {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Local date and time to the minute, `YYYY-MM-DDTHH:mm`. */
  dateTime: string;
  /** Local date and time to the second, `YYYY-MM-DDTHH:mm:ss`. */
  dateTimeWithSeconds: string;
}

const OFFSET_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** True when an ISO datetime names an absolute instant (`Z` or a numeric offset) rather than zone-local wall time. */
export const isAbsoluteInstant = (value: string): boolean =>
  OFFSET_SUFFIX_PATTERN.test(value);

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timezone: string): Intl.DateTimeFormat => {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timezone, formatter);
  return formatter;
};

const pad = (value: number, length = 2): string =>
  String(value).padStart(length, '0');

/** The zone's wall clock at `instantMs`, expressed as if that wall clock were UTC. */
const toWallMs = (instantMs: number, timezone: string): number => {
  const parts = getFormatter(timezone).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
};

/** The zone's UTC offset in milliseconds at `instantMs`. */
const getOffsetMs = (instantMs: number, timezone: string): number =>
  toWallMs(instantMs, timezone) - Math.floor(instantMs / 1000) * 1000;

const parseLocalDateTime = (value: string): number | undefined => {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const wallMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
  );
  return Number.isNaN(wallMs) ? undefined : wallMs;
};

const formatWall = (wallMs: number): ZonedNow => {
  const date = new Date(wallMs);
  const day = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const dateTime = `${day}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return {
    date: day,
    dateTime,
    dateTimeWithSeconds: `${dateTime}:${pad(date.getUTCSeconds())}`,
  };
};

/**
 * The current local date and time in `timezone`.
 * Throws a `RangeError` for an identifier `Intl` rejects; validate the zone first.
 */
export const getZonedNow = (now: Date, timezone: string): ZonedNow =>
  formatWall(toWallMs(now.getTime(), timezone));

/**
 * Converts an absolute instant (an ISO string with `Z` or an offset) to the
 * local `YYYY-MM-DDTHH:mm` it shows in `timezone`, or `undefined` when the
 * input is not a date.
 */
export const instantToZonedDateTime = (
  iso: string,
  timezone: string,
): string | undefined => {
  const instantMs = Date.parse(iso);
  if (Number.isNaN(instantMs)) return undefined;
  return formatWall(toWallMs(instantMs, timezone)).dateTime;
};

/**
 * The offsets in force just before and just after the wall time, a day either
 * side, so a clock change near it is always straddled.
 */
const getSurroundingOffsets = (
  wallMs: number,
  timezone: string,
): [before: number, after: number] => [
  getOffsetMs(wallMs - MS_PER_DAY, timezone),
  getOffsetMs(wallMs + MS_PER_DAY, timezone),
];

/**
 * True when the local time does not exist in `timezone` — it falls inside a
 * spring-forward gap. A repeated time (autumn) exists and returns `false`.
 * An unparseable value or an unknown zone returns `false`.
 */
export const isNonexistentLocalTime = (
  dateTime: string,
  timezone: string,
): boolean => {
  const wallMs = parseLocalDateTime(dateTime);
  if (wallMs === undefined) return false;
  try {
    const [before, after] = getSurroundingOffsets(wallMs, timezone);
    if (before === after) return false;
    return [before, after].every(
      (offset) => getOffsetMs(wallMs - offset, timezone) !== offset,
    );
  } catch {
    return false;
  }
};

/**
 * The local time a nonexistent `dateTime` runs at: shifted forward by the
 * length of the gap (`02:30` becomes `03:30` in `Europe/Berlin`). A time that
 * exists, an unparseable value or an unknown zone is returned unchanged.
 */
export const shiftForwardOverGap = (
  dateTime: string,
  timezone: string,
): string => {
  if (!isNonexistentLocalTime(dateTime, timezone)) return dateTime;
  const wallMs = parseLocalDateTime(dateTime) as number;
  const [before, after] = getSurroundingOffsets(wallMs, timezone);
  return formatWall(wallMs + (after - before)).dateTime;
};

/**
 * Builds a `Date` in the process's own zone whose local fields equal the
 * wall-clock `YYYY-MM-DDTHH:mm`. Kit pickers read local fields, so this is how
 * a moment of another zone is handed to them as a minimum date.
 */
export const wallClockToLocalDate = (dateTime: string): Date => {
  const match = LOCAL_DATE_TIME_PATTERN.exec(dateTime);
  if (!match) return new Date(Number.NaN);
  const [, year, month, day, hour, minute] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
};
