import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { UsageLimitStatus } from '@epam/ai-dial-usage-dashboard';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { UsageI18nKeys } from '../../constants/translation-keys';
import { mapUsageDataToDashboard } from '../map-usage-data-to-dashboard';

const labels: Partial<Record<UsageI18nKeys, string>> = {
  [UsageI18nKeys.TodayTitle]: 'Today',
  [UsageI18nKeys.TodayPeriodDescription]: 'Last 24 hours',
  [UsageI18nKeys.ThisWeekTitle]: 'This week',
  [UsageI18nKeys.ThisWeekPeriodDescription]: 'Last 7 days',
  [UsageI18nKeys.ThisMonthTitle]: 'This month',
  [UsageI18nKeys.ThisMonthPeriodDescription]: 'Last 30 days',
};

const t = ((key: string, params?: Record<string, unknown>) => {
  if (key === UsageI18nKeys.UnlimitedProgressAriaLabel) {
    return `${params?.used} used, unlimited`;
  }
  if (key === UsageI18nKeys.ProgressAriaLabel) {
    return `${params?.used} of ${params?.total}, ${params?.percent}% used`;
  }
  return labels[key as UsageI18nKeys] ?? key;
}) as TFunction;

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

    const result = mapUsageDataToDashboard(usage, t);

    expect(result.map((card) => card.title)).toEqual([
      'Today',
      'This week',
      'This month',
    ]);
    expect(result[0]).toEqual({
      title: 'Today',
      periodDescription: 'Last 24 hours',
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
    );

    expect(result.map((card) => card.title)).toEqual(['Today']);
  });

  it('rounds accumulated costs and remaining amounts to cents', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 0.788438, total: 100 } }),
      t,
    );

    expect(result[0].usedLabel).toBe('$0.79');
    expect(result[0].remainingLabel).toBe('$99.21');
    expect(result[0].progressAriaLabel).toBe('$0.79 of $100, 1% used');
  });

  it('returns an empty array when no period has a usable stat', () => {
    const result = mapUsageDataToDashboard(withStats({}), t);

    expect(result).toEqual([]);
  });

  it('returns an empty array when usage is undefined', () => {
    const result = mapUsageDataToDashboard(undefined, t);

    expect(result).toEqual([]);
  });

  it('clamps a negative used value to zero', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: -5, total: 100 } }),
      t,
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
    );

    expect(result).toEqual([]);
  });

  it('treats a total at the unlimited sentinel (2**53) as unlimited', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 12.5, total: 2 ** 53 } }),
      t,
    );

    expect(result[0]).toEqual({
      title: 'Today',
      periodDescription: 'Last 24 hours',
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
    );

    expect(result[0].isUnlimited).toBe(true);
  });

  it('reports the real, uncapped percentage for used amounts over the total', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 5.48, total: 4 } }),
      t,
    );

    expect(result[0].usedPercent).toBe(137);
    expect(result[0].remainingLabel).toBe('$0');
    expect(result[0].status).toBe(UsageLimitStatus.LimitReached);
  });

  it('treats exactly 75% used as RunningLow', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 75, total: 100 } }),
      t,
    );

    expect(result[0].usedPercent).toBe(75);
    expect(result[0].status).toBe(UsageLimitStatus.RunningLow);
  });

  it('treats just under 75% used as Default', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 74.9, total: 100 } }),
      t,
    );

    expect(result[0].status).toBe(UsageLimitStatus.Default);
  });

  it('treats exactly 100% used as LimitReached', () => {
    const result = mapUsageDataToDashboard(
      withStats({ dayCostStats: { used: 100, total: 100 } }),
      t,
    );

    expect(result[0].status).toBe(UsageLimitStatus.LimitReached);
  });
});
