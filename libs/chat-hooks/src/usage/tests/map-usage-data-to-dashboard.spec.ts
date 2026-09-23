import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { UsageLimitStatus } from '@epam/ai-dial-usage-dashboard';
import { describe, expect, it } from 'vitest';
import type { FormatResetTime } from '../map-usage-data-to-dashboard';
import {
  USAGE_DATA_I18N_KEYS,
  mapUsageDataToDashboard,
} from '../map-usage-data-to-dashboard';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const t: Translate = (key, params) => {
  if (key === USAGE_DATA_I18N_KEYS.unlimitedProgressAriaLabel) {
    return `${params?.used} used, unlimited`;
  }
  if (key === USAGE_DATA_I18N_KEYS.progressAriaLabel) {
    return `${params?.used} of ${params?.total}, ${params?.percent}% used`;
  }
  if (key === USAGE_DATA_I18N_KEYS.todayTitle) return 'Today';
  if (key === USAGE_DATA_I18N_KEYS.todayPeriodDescription) return 'Today';
  if (key === USAGE_DATA_I18N_KEYS.thisWeekTitle) return 'This week';
  if (key === USAGE_DATA_I18N_KEYS.thisWeekPeriodDescription)
    return 'This week';
  if (key === USAGE_DATA_I18N_KEYS.thisMonthTitle) return 'This month';
  if (key === USAGE_DATA_I18N_KEYS.thisMonthPeriodDescription)
    return 'This month';
  return key;
};

/* The default for cases that are not about reset times. */
const noReset: FormatResetTime = () => undefined;

/*
 * Reset values and top-level cost figures reproduced from the real
 * GET /api/v1/user/usage capture in
 * openspec/changes/migrate-usage-reset-times/fixtures/ — a payload that mixes a
 * finite day and month budget with a sentinel week budget, and carries
 * `resetsAt` on all three.
 */
const DAY_RESETS_AT = '2026-09-16T00:00:00Z';
const WEEK_RESETS_AT = '2026-09-21T00:00:00Z';
const MONTH_RESETS_AT = '2026-10-01T00:00:00Z';
const UNLIMITED_SENTINEL = 9223372036854776000;

const CAPTURED_STATS = {
  dayCostStats: { total: 110, used: 0.42641085, resetsAt: DAY_RESETS_AT },
  weekCostStats: {
    total: UNLIMITED_SENTINEL,
    used: 1.7928459,
    resetsAt: WEEK_RESETS_AT,
  },
  monthCostStats: { total: 500, used: 2.3991724, resetsAt: MONTH_RESETS_AT },
};

/* Echoes the input so each card's trio is traceable to its own stat. */
const formatReset: FormatResetTime = (resetsAt) =>
  resetsAt == null
    ? undefined
    : {
        resetsAtMs: Date.parse(resetsAt),
        isoValue: resetsAt,
        label: `Resets ${resetsAt}`,
        ariaLabel: `Usage resets ${resetsAt}`,
      };

const withStats = (
  fields: Partial<
    Pick<
      UserLimitStatsResponseDto,
      'dayCostStats' | 'weekCostStats' | 'monthCostStats'
    >
  >,
): UserLimitStatsResponseDto => ({ deployments: {}, ...fields });

describe('mapUsageDataToDashboard', () => {
  it('maps all three usable periods in Today/This week/This month order', () => {
    const usage = withStats({
      dayCostStats: { used: 3.6, total: 4 },
      weekCostStats: { used: 11.2, total: 20 },
      monthCostStats: { used: 41, total: 120 },
    });

    const result = mapUsageDataToDashboard(usage, t, noReset);

    expect(result.map((card) => card.title)).toEqual([
      'Today',
      'This week',
      'This month',
    ]);
    expect(result[0]).toEqual({
      title: 'Today',
      periodDescription: 'Today',
      used: 3.6,
      total: 4,
      usedLabel: '$3.6',
      totalLabel: '$4',
      remainingLabel: '$0.4',
      usedPercent: 90,
      status: UsageLimitStatus.RunningLow,
      progressAriaLabel: '$3.6 of $4, 90% used',
    });
  });

  it('omits a period entirely when the stat is missing', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 1, total: 10 } }),
      t,
      noReset,
    );

    expect(result.map((card) => card.title)).toEqual(['Today']);
  });

  it('rounds accumulated costs and remaining amounts to cents', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 0.788438, total: 100 } }),
      t,
      noReset,
    );

    expect(result[0].usedLabel).toBe('$0.79');
    expect(result[0].remainingLabel).toBe('$99.21');
    expect(result[0].progressAriaLabel).toBe('$0.79 of $100, 1% used');
  });

  it('returns an empty array when no period has a usable stat', () => {
    const result = mapUsageDataToDashboard(withStats({}), t, noReset);

    expect(result).toEqual([]);
  });

  it('returns an empty array when usage is undefined', () => {
    const result = mapUsageDataToDashboard(undefined, t, noReset);

    expect(result).toEqual([]);
  });

  it('clamps a negative used value to zero', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: -5, total: 100 } }),
      t,
      noReset,
    );

    expect(result[0].used).toBe(0);
    expect(result[0].usedLabel).toBe('$0');
    expect(result[0].remainingLabel).toBe('$100');
    expect(result[0].status).toBe(UsageLimitStatus.Default);
  });

  it('treats a NaN used or total as an unusable stat and omits the period', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: NaN, total: 100 } }),
      t,
      noReset,
    );

    expect(result).toEqual([]);
  });

  it('treats a total at the unlimited sentinel (2**53) as unlimited', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 12.5, total: 2 ** 53 } }),
      t,
      noReset,
    );

    expect(result[0]).toEqual({
      title: 'Today',
      periodDescription: 'Today',
      used: 12.5,
      total: 2 ** 53,
      usedLabel: '$12.5',
      isUnlimited: true,
      status: UsageLimitStatus.Default,
      progressAriaLabel: '$12.5 used, unlimited',
    });
  });

  it('treats a total above the unlimited sentinel as unlimited', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 0, total: 2 ** 60 } }),
      t,
      noReset,
    );

    expect(result[0].isUnlimited).toBe(true);
  });

  it('reports the real, uncapped percentage for used amounts over the total', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 5.48, total: 4 } }),
      t,
      noReset,
    );

    expect(result[0].usedPercent).toBe(137);
    expect(result[0].remainingLabel).toBe('$0');
    expect(result[0].status).toBe(UsageLimitStatus.LimitReached);
  });

  it('treats exactly 75% used as RunningLow', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 75, total: 100 } }),
      t,
      noReset,
    );

    expect(result[0].usedPercent).toBe(75);
    expect(result[0].status).toBe(UsageLimitStatus.RunningLow);
  });

  it('treats just under 75% used as Default', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 74.9, total: 100 } }),
      t,
      noReset,
    );

    expect(result[0].status).toBe(UsageLimitStatus.Default);
  });

  it('treats exactly 100% used as LimitReached', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 100, total: 100 } }),
      t,
      noReset,
    );

    expect(result[0].status).toBe(UsageLimitStatus.LimitReached);
  });

  it('treats a finite total of zero as 100% used', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 0, total: 0 } }),
      t,
      noReset,
    );

    expect(result[0].usedPercent).toBe(100);
    expect(result[0].status).toBe(UsageLimitStatus.LimitReached);
  });

  describe('reset times', () => {
    it("populates each card's reset trio from its own stat", () => {
      const result = mapUsageDataToDashboard(
        withStats(CAPTURED_STATS),
        t,
        formatReset,
      );

      expect(
        result.map(({ resetLabel, resetIsoValue, resetAriaLabel }) => ({
          resetLabel,
          resetIsoValue,
          resetAriaLabel,
        })),
      ).toEqual([
        {
          resetLabel: `Resets ${DAY_RESETS_AT}`,
          resetIsoValue: DAY_RESETS_AT,
          resetAriaLabel: `Usage resets ${DAY_RESETS_AT}`,
        },
        {
          resetLabel: `Resets ${WEEK_RESETS_AT}`,
          resetIsoValue: WEEK_RESETS_AT,
          resetAriaLabel: `Usage resets ${WEEK_RESETS_AT}`,
        },
        {
          resetLabel: `Resets ${MONTH_RESETS_AT}`,
          resetIsoValue: MONTH_RESETS_AT,
          resetAriaLabel: `Usage resets ${MONTH_RESETS_AT}`,
        },
      ]);
    });

    it('leaves all three fields absent when the formatter returns undefined', () => {
      const result = mapUsageDataToDashboard(
        withStats(CAPTURED_STATS),
        t,
        noReset,
      );

      for (const card of result) {
        expect(card).not.toHaveProperty('resetLabel');
        expect(card).not.toHaveProperty('resetIsoValue');
        expect(card).not.toHaveProperty('resetAriaLabel');
      }
    });

    it('leaves the fields absent for a stat that carries no resetsAt', () => {
      const result = mapUsageDataToDashboard(
        withStats({ dayCostStats: { total: 110, used: 0.43 } }),
        t,
        formatReset,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('resetLabel');
      expect(result[0].usedLabel).toBe('$0.43');
    });

    it('carries the reset trio on an unlimited card too', () => {
      const result = mapUsageDataToDashboard(
        withStats({ weekCostStats: CAPTURED_STATS.weekCostStats }),
        t,
        formatReset,
      );

      expect(result[0].isUnlimited).toBe(true);
      expect(result[0].totalLabel).toBeUndefined();
      expect(result[0].resetLabel).toBe(`Resets ${WEEK_RESETS_AT}`);
      expect(result[0].resetIsoValue).toBe(WEEK_RESETS_AT);
    });

    it('titles the cards with the calendar names', () => {
      const result = mapUsageDataToDashboard(
        withStats(CAPTURED_STATS),
        t,
        formatReset,
      );

      expect(result.map((card) => card.title)).toEqual([
        'Today',
        'This week',
        'This month',
      ]);
      expect(result.map((card) => card.periodDescription)).toEqual([
        'Today',
        'This week',
        'This month',
      ]);
    });
  });
});
