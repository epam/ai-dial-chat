const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', YEAR],
  ['month', MONTH],
  ['week', WEEK],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
];

/** Returns how long ago `timestamp` (epoch ms) was relative to `now`, e.g. `49 minutes ago`, `1 week ago`, `now`. */
export const formatRelativeTime = (
  timestamp: number,
  now: number,
  locale: string | undefined,
): string => {
  const elapsedSeconds = (now - timestamp) / 1000;

  // Largest whole unit wins; under a minute (or clock skew) reads as "now".
  for (const [unit, seconds] of RELATIVE_UNITS) {
    const count = Math.floor(elapsedSeconds / seconds);
    if (count >= 1) {
      return new Intl.RelativeTimeFormat(locale).format(-count, unit);
    }
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    0,
    'second',
  );
};
