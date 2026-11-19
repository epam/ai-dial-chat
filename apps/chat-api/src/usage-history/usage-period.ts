import { UsageHistoryPeriod } from './types/usage-history-period';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The half-open window `[from, to)` of one request, and every UTC date it touches. */
export interface UsageWindow {
  from: Date;
  to: Date;
  /** `YYYY-MM-DD`, ascending, from the date of `from` through the date of `to`. */
  dates: string[];
}

const startOfUtcDay = (instant: Date): number =>
  Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
  );

const windowStart = (period: UsageHistoryPeriod, now: Date): number => {
  switch (period) {
    case UsageHistoryPeriod.Today:
      return startOfUtcDay(now);
    case UsageHistoryPeriod.Week:
      /* ISO week: Monday is day 0, so Sunday (getUTCDay() === 0) is 6 days in. */
      return startOfUtcDay(now) - ((now.getUTCDay() + 6) % 7) * DAY_MS;
    case UsageHistoryPeriod.Month:
      return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }
};

/** `YYYY-MM-DD` of an instant in UTC. */
export const toUtcDate = (instant: number): string =>
  new Date(instant).toISOString().slice(0, 10);

/**
 * The UTC calendar window of `period` that contains `now`, matching DIAL
 * Core's day, week (ISO, Monday start) and month stats. `to` is `now` itself,
 * so a request at exactly 00:00:00.000Z has an empty window but still lists
 * the current date once.
 */
export const resolveUsageWindow = (
  period: UsageHistoryPeriod,
  now: Date,
): UsageWindow => {
  const from = windowStart(period, now);
  const lastDay = startOfUtcDay(now);
  const dates: string[] = [];
  for (let day = from; day <= lastDay; day += DAY_MS) {
    dates.push(toUtcDate(day));
  }
  return { from: new Date(from), to: new Date(now.getTime()), dates };
};
