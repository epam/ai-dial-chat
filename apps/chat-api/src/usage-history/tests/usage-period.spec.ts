import { describe, expect, it } from 'vitest';
import { UsageHistoryPeriod } from '../types/usage-history-period';
import { resolveUsageWindow } from '../usage-period';

const resolve = (period: UsageHistoryPeriod, iso: string) => {
  const window = resolveUsageWindow(period, new Date(iso));
  return {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    dates: window.dates,
  };
};

describe('resolveUsageWindow', () => {
  it('starts a month window on the 1st and ends it at the request instant', () => {
    expect(
      resolve(UsageHistoryPeriod.Month, '2026-11-18T14:05:09.120Z'),
    ).toEqual({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-18T14:05:09.120Z',
      dates: Array.from(
        { length: 18 },
        (_, index) => `2026-11-${String(index + 1).padStart(2, '0')}`,
      ),
    });
  });

  it('starts a week window on the previous Monday when the request is on a Sunday', () => {
    const window = resolve(UsageHistoryPeriod.Week, '2026-11-22T23:59:59.999Z');

    expect(window.from).toBe('2026-11-16T00:00:00.000Z');
    expect(window.dates).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it('starts a week window on the same day when the request is on a Monday', () => {
    expect(
      resolve(UsageHistoryPeriod.Week, '2026-11-16T08:00:00.000Z'),
    ).toEqual({
      from: '2026-11-16T00:00:00.000Z',
      to: '2026-11-16T08:00:00.000Z',
      dates: ['2026-11-16'],
    });
  });

  it('lists one date for a month window on the first day of the month', () => {
    expect(
      resolve(UsageHistoryPeriod.Month, '2026-12-01T09:30:00.000Z'),
    ).toEqual({
      from: '2026-12-01T00:00:00.000Z',
      to: '2026-12-01T09:30:00.000Z',
      dates: ['2026-12-01'],
    });
  });

  it('starts a today window at midnight UTC', () => {
    expect(
      resolve(UsageHistoryPeriod.Today, '2026-11-18T17:00:00.000Z'),
    ).toEqual({
      from: '2026-11-18T00:00:00.000Z',
      to: '2026-11-18T17:00:00.000Z',
      dates: ['2026-11-18'],
    });
  });

  it.each([
    UsageHistoryPeriod.Today,
    UsageHistoryPeriod.Week,
    UsageHistoryPeriod.Month,
  ])(
    'returns an empty window that still lists the date for a %s request at 00:00 UTC on a Monday the 1st',
    (period) => {
      /* 2026-06-01 is a Monday and the first of its month. */
      expect(resolve(period, '2026-06-01T00:00:00.000Z')).toEqual({
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
        dates: ['2026-06-01'],
      });
    },
  );

  it('returns an empty today window at midnight UTC', () => {
    expect(
      resolve(UsageHistoryPeriod.Today, '2026-11-18T00:00:00.000Z'),
    ).toEqual({
      from: '2026-11-18T00:00:00.000Z',
      to: '2026-11-18T00:00:00.000Z',
      dates: ['2026-11-18'],
    });
  });

  it('keeps the earlier days of a week window when the request is at midnight', () => {
    const window = resolve(UsageHistoryPeriod.Week, '2026-11-18T00:00:00.000Z');

    expect(window.from).toBe('2026-11-16T00:00:00.000Z');
    expect(window.dates).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });

  it('crosses a month boundary inside a week window', () => {
    const window = resolve(UsageHistoryPeriod.Week, '2026-12-02T10:00:00.000Z');

    expect(window.from).toBe('2026-11-30T00:00:00.000Z');
    expect(window.dates).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });

  it('lists 31 dates on the last day of a 31-day month', () => {
    const window = resolve(
      UsageHistoryPeriod.Month,
      '2026-12-31T23:59:59.999Z',
    );

    expect(window.dates).toHaveLength(31);
    expect(window.dates[30]).toBe('2026-12-31');
  });

  it('crosses a year boundary inside a week window', () => {
    /* 2027-01-01 is a Friday; its ISO week starts on Monday 2026-12-28. */
    const window = resolve(UsageHistoryPeriod.Week, '2027-01-01T12:00:00.000Z');

    expect(window.from).toBe('2026-12-28T00:00:00.000Z');
    expect(window.dates).toHaveLength(5);
  });
});
