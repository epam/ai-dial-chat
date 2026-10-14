import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { UsageLimitBannerSeverity } from '@epam/ai-dial-conversation-input';
import { describe, expect, it } from 'vitest';
import { isCappedStat, selectUsageBannerSource } from '../usage-banner-source';
import { UsagePeriod } from '../usage-period';

describe('isCappedStat', () => {
  it.each([
    [100, true],
    [0, false],
    [-1, false],
    [Number.POSITIVE_INFINITY, false],
    [Number.NaN, false],
    [Number.MAX_SAFE_INTEGER, false],
  ])('treats a total of %d as capped: %s', (total, expected) => {
    expect(isCappedStat(total)).toBe(expected);
  });
});

describe('selectUsageBannerSource', () => {
  const RESETS_AT = '2026-10-14T00:00:00Z';

  it('returns a daily warning at 80% with the default 75% threshold', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 80, total: 100, resetsAt: RESETS_AT },
      weekTokenStats: { used: 50, total: 100 },
      monthCostStats: { used: 10, total: 100 },
    };

    expect(selectUsageBannerSource(dto, 75)).toEqual({
      period: UsagePeriod.Day,
      severity: UsageLimitBannerSeverity.Warning,
      usedPercent: 80,
      resetsAt: RESETS_AT,
    });
  });

  it('returns undefined when the worst row is below the threshold', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 70, total: 100 } }, 75),
    ).toBeUndefined();
  });

  it('returns undefined at 80% when the threshold is 90', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 80, total: 100 } }, 90),
    ).toBeUndefined();
  });

  it('returns a warning at 92% when the threshold is 90', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 92, total: 100 } }, 90)
        ?.severity,
    ).toBe(UsageLimitBannerSeverity.Warning);
  });

  it('lets a reached row outrank a warning row', () => {
    const result = selectUsageBannerSource(
      {
        weekCostStats: { used: 100, total: 100 },
        dayTokenStats: { used: 95, total: 100 },
      },
      75,
    );

    expect(result).toMatchObject({
      period: UsagePeriod.Week,
      severity: UsageLimitBannerSeverity.Reached,
      usedPercent: 100,
    });
  });

  it('gives a tie to the longer period', () => {
    expect(
      selectUsageBannerSource(
        {
          dayTokenStats: { used: 100, total: 100 },
          monthTokenStats: { used: 100, total: 100 },
        },
        75,
      )?.period,
    ).toBe(UsagePeriod.Month);
  });

  it('gives a tie within a period to the token row', () => {
    expect(
      selectUsageBannerSource(
        {
          dayCostStats: { used: 9, total: 10, resetsAt: 'cost' },
          dayTokenStats: { used: 90, total: 100, resetsAt: 'token' },
        },
        75,
      )?.resetsAt,
    ).toBe('token');
  });

  it('clamps an overshoot to 100% and reports it as reached', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 150, total: 100 } }, 75),
    ).toMatchObject({
      severity: UsageLimitBannerSeverity.Reached,
      usedPercent: 100,
    });
  });

  it('ignores unlimited and zero totals', () => {
    expect(
      selectUsageBannerSource(
        {
          dayTokenStats: {
            used: Number.MAX_SAFE_INTEGER,
            total: Number.MAX_SAFE_INTEGER,
          },
          weekTokenStats: { used: 5, total: 0 },
          monthCostStats: { used: 5, total: -1 },
        },
        75,
      ),
    ).toBeUndefined();
  });

  it('ignores the minute stats', () => {
    expect(
      selectUsageBannerSource(
        {
          minuteTokenStats: { used: 100, total: 100 },
          minuteCostStats: { used: 100, total: 100 },
        },
        75,
      ),
    ).toBeUndefined();
  });

  it('returns undefined for an undefined response', () => {
    expect(selectUsageBannerSource(undefined, 75)).toBeUndefined();
  });
});
