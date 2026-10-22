import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { UsageLimitBannerSeverity } from '@epam/ai-dial-conversation-input';
import { describe, expect, it } from 'vitest';
import { isCappedStat, selectUsageBannerSource } from '../usage-banner-source';
import { UsagePeriod } from '../usage-period';
import type {
  AccountUsage,
  UsageLimitsSources,
} from '../useDeploymentUsageLimits/useDeploymentUsageLimits';

/*
 * Splits a combined fixture the way the two endpoints return it: day, week,
 * and month cost stats on the account usage, everything else on the
 * deployment usage. The cases under "sources" exercise each side directly.
 */
const asSources = (
  dto: DeploymentLimitsResponseDto | undefined,
): UsageLimitsSources => {
  if (dto == null) {
    return { deployment: undefined, account: undefined };
  }
  const deployment: DeploymentLimitsResponseDto = { ...dto };
  const account: AccountUsage = {};
  for (const key of [
    'dayCostStats',
    'weekCostStats',
    'monthCostStats',
  ] as const) {
    account[key] = dto[key];
    delete deployment[key];
  }
  return { deployment, account };
};

const select = (
  dto: DeploymentLimitsResponseDto | undefined,
  thresholdPercent: number,
) => selectUsageBannerSource(asSources(dto), thresholdPercent);

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

    expect(select(dto, 75)).toEqual({
      period: UsagePeriod.Day,
      severity: UsageLimitBannerSeverity.Warning,
      usedPercent: 80,
      resetsAt: RESETS_AT,
    });
  });

  it('returns undefined when the worst row is below the threshold', () => {
    expect(
      select({ dayTokenStats: { used: 70, total: 100 } }, 75),
    ).toBeUndefined();
  });

  it('returns undefined at 80% when the threshold is 90', () => {
    expect(
      select({ dayTokenStats: { used: 80, total: 100 } }, 90),
    ).toBeUndefined();
  });

  it('returns a warning at 92% when the threshold is 90', () => {
    expect(
      select({ dayTokenStats: { used: 92, total: 100 } }, 90)?.severity,
    ).toBe(UsageLimitBannerSeverity.Warning);
  });

  it('lets a reached row outrank a warning row', () => {
    const result = select(
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
      select(
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
      select(
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
      select({ dayTokenStats: { used: 150, total: 100 } }, 75),
    ).toMatchObject({
      severity: UsageLimitBannerSeverity.Reached,
      usedPercent: 100,
    });
  });

  it('ignores unlimited and zero totals', () => {
    expect(
      select(
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
      select(
        {
          minuteTokenStats: { used: 100, total: 100 },
          minuteCostStats: { used: 100, total: 100 },
        },
        75,
      ),
    ).toBeUndefined();
  });

  it('returns undefined for an undefined response', () => {
    expect(select(undefined, 75)).toBeUndefined();
  });

  describe('sources', () => {
    it('raises no banner for an agent whose spend /limits would count twice', () => {
      expect(
        selectUsageBannerSource(
          {
            deployment: {
              dayTokenStats: { used: 0, total: 2_000_000 },
              weekCostStats: { used: 130.98, total: Number.MAX_SAFE_INTEGER },
            },
            account: { weekCostStats: { used: 132.24, total: 200 } },
          },
          75,
        ),
      ).toBeUndefined();
    });

    it('ignores cost stats on the deployment source', () => {
      expect(
        selectUsageBannerSource(
          {
            deployment: { monthCostStats: { used: 100, total: 100 } },
            account: undefined,
          },
          75,
        ),
      ).toBeUndefined();
    });

    it('warns from the account cost alone when the deployment source is missing', () => {
      expect(
        selectUsageBannerSource(
          {
            deployment: undefined,
            account: { dayCostStats: { used: 90, total: 100 } },
          },
          75,
        ),
      ).toMatchObject({
        period: UsagePeriod.Day,
        severity: UsageLimitBannerSeverity.Warning,
        usedPercent: 90,
      });
    });

    it('warns from the deployment tokens alone when the account source is missing', () => {
      expect(
        selectUsageBannerSource(
          {
            deployment: { monthTokenStats: { used: 100, total: 100 } },
            account: undefined,
          },
          75,
        ),
      ).toMatchObject({
        period: UsagePeriod.Month,
        severity: UsageLimitBannerSeverity.Reached,
      });
    });
  });
});
