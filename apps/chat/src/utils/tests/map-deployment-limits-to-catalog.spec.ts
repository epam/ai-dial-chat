import { CatalogLimitStatus } from '@epam/ai-dial-catalog';
import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { mapDeploymentLimitsDtoToCatalogLimits } from '../map-deployment-limits-to-catalog';

const labels: Partial<Record<CatalogI18nKeys, string>> = {
  [CatalogI18nKeys.DetailsLimitsTokenGroupLabel]: 'Token limits',
  [CatalogI18nKeys.DetailsLimitsTokensPerDay]: 'Last 24 hours',
  [CatalogI18nKeys.DetailsLimitsTokensPerWeek]: 'Last 7 days',
  [CatalogI18nKeys.DetailsLimitsTokensPerMonth]: 'Last 30 days',
  [CatalogI18nKeys.DetailsLimitsFollowsCostLimitLabel]: 'Follows cost limit',
};

const compactFormat = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format;

const fullFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
}).format;

const t = ((key: string, params?: Record<string, string>) => {
  if (key === CatalogI18nKeys.DetailsLimitsValue) {
    return `${params?.used} / ${params?.total}`;
  }
  if (key === CatalogI18nKeys.DetailsLimitsProgressAriaLabel) {
    return `${params?.label}: ${params?.used} of ${params?.total} used`;
  }
  if (key === CatalogI18nKeys.DetailsLimitsFollowsCostLimitAriaLabel) {
    return `${params?.label}: ${params?.used} used. Follows cost limit.`;
  }
  if (key === CatalogI18nKeys.DetailsLimitsSpentLabel) {
    return `${params?.amount} spent`;
  }
  return labels[key as CatalogI18nKeys] ?? key;
}) as TFunction;

describe('mapDeploymentLimitsDtoToCatalogLimits', () => {
  it('maps token stats into a single "Token limits" group, smallest period first', () => {
    const dto: DeploymentLimitsResponseDto = {
      monthTokenStats: { used: 9000, total: 20000 },
      dayTokenStats: { used: 2500, total: 10000 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)).toEqual({
      groups: [
        {
          label: 'Token limits',
          rows: [
            {
              label: 'Last 24 hours',
              used: 2500,
              total: 10000,
              usedLabel: compactFormat(2500),
              totalLabel: compactFormat(10000),
              valueLabel: `${compactFormat(2500)} / ${compactFormat(10000)}`,
              ariaLabel: `Last 24 hours: ${fullFormat(2500)} of ${fullFormat(10000)} used`,
            },
            {
              label: 'Last 30 days',
              used: 9000,
              total: 20000,
              usedLabel: compactFormat(9000),
              totalLabel: compactFormat(20000),
              valueLabel: `${compactFormat(9000)} / ${compactFormat(20000)}`,
              ariaLabel: `Last 30 days: ${fullFormat(9000)} of ${fullFormat(20000)} used`,
            },
          ],
        },
      ],
    });
  });

  it('formats large token counts with K/M compact suffixes for display, keeping full numbers in the aria label', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 1900000, total: 2000000 },
    };

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, t);
    const row = result?.groups[0].rows[0];
    expect(row?.usedLabel).toBe(compactFormat(1900000));
    expect(row?.usedLabel).toContain('M');
    expect(row?.totalLabel).toBe(compactFormat(2000000));
    expect(row?.totalLabel).toContain('M');
    expect(row?.ariaLabel).toBe(
      `Last 24 hours: ${fullFormat(1900000)} of ${fullFormat(2000000)} used`,
    );
  });

  it('truncates the used figure instead of rounding it up past what was consumed', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 1999000, total: 5000000 },
      weekTokenStats: { used: 999999, total: 5000000 },
    };

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, t);
    const [dayRow, weekRow] = result?.groups[0].rows ?? [];
    expect(dayRow.usedLabel).toBe('1.9M');
    expect(weekRow.usedLabel).toBe('999.9K');
    // The total figure is unaffected — only the "used" figure truncates.
    expect(dayRow.totalLabel).toBe(compactFormat(5000000));
  });

  it('does not map a minute-period row at all', () => {
    const dto: DeploymentLimitsResponseDto = {
      minuteTokenStats: { used: 1, total: 5 },
      dayTokenStats: { used: 2500, total: 10000 },
    };

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, t);
    expect(result?.groups[0].rows).toHaveLength(1);
    expect(result?.groups[0].rows[0].label).toBe('Last 24 hours');
  });

  it('omits request stats entirely, even when present on the DTO', () => {
    const dto: DeploymentLimitsResponseDto = {
      hourRequestStats: { used: 2, total: 10 },
      dayRequestStats: { used: 5, total: 20 },
      dayTokenStats: { used: 2500, total: 10000 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)).toEqual({
      groups: [
        {
          label: 'Token limits',
          rows: [
            {
              label: 'Last 24 hours',
              used: 2500,
              total: 10000,
              usedLabel: compactFormat(2500),
              totalLabel: compactFormat(10000),
              valueLabel: `${compactFormat(2500)} / ${compactFormat(10000)}`,
              ariaLabel: `Last 24 hours: ${fullFormat(2500)} of ${fullFormat(10000)} used`,
            },
          ],
        },
      ],
    });
  });

  it("adds a spent caption from the sibling period's cost stat, without a separate cost row", () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 2500, total: 10000 },
      dayCostStats: { used: 0.5, total: 10 },
    };

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, t);
    expect(result?.groups).toHaveLength(1);
    expect(result?.groups[0].rows).toHaveLength(1);
    expect(result?.groups[0].rows[0].captionLabel).toBe(
      `${formatCost(0.5)} spent`,
    );
  });

  it('omits the spent caption when the sibling cost stat is unusable', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 2500, total: 10000 },
    };

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, t);
    expect(result?.groups[0].rows[0].captionLabel).toBeUndefined();
  });

  it('omits empty and zero-total stats', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 5, total: 0 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)).toBeUndefined();
    expect(mapDeploymentLimitsDtoToCatalogLimits(undefined, t)).toBeUndefined();
  });

  it('shows the actual tokens consumed and a "Follows cost limit" note for an unlimited row', () => {
    const unlimitedTotal = 9223372036854776000;
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 210000, total: unlimitedTotal },
      weekTokenStats: { used: 2.5, total: 10 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)).toEqual({
      groups: [
        {
          label: 'Token limits',
          rows: [
            {
              label: 'Last 24 hours',
              used: 210000,
              total: unlimitedTotal,
              isUnlimited: true,
              noteLabel: 'Follows cost limit',
              valueLabel: compactFormat(210000),
              ariaLabel: `Last 24 hours: ${fullFormat(210000)} used. Follows cost limit.`,
            },
            {
              label: 'Last 7 days',
              used: 2.5,
              total: 10,
              usedLabel: compactFormat(2.5),
              totalLabel: compactFormat(10),
              valueLabel: `${compactFormat(2.5)} / ${compactFormat(10)}`,
              ariaLabel: `Last 7 days: ${fullFormat(2.5)} of ${fullFormat(10)} used`,
            },
          ],
        },
      ],
    });
  });

  describe('status', () => {
    it('is undefined when every capped row is comfortably under the running-low threshold', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 100, total: 1000 },
      };

      expect(
        mapDeploymentLimitsDtoToCatalogLimits(dto, t)?.status,
      ).toBeUndefined();
    });

    it('is RunningLow once a capped row reaches 75% usage', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 750, total: 1000 },
      };

      expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)?.status).toBe(
        CatalogLimitStatus.RunningLow,
      );
    });

    it('is LimitReached once a capped row reaches its limit', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 1000, total: 1000 },
      };

      expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)?.status).toBe(
        CatalogLimitStatus.LimitReached,
      );
    });

    it('takes the worst status across rows, LimitReached outranking RunningLow', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 750, total: 1000 },
        weekTokenStats: { used: 1000, total: 1000 },
      };

      expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)?.status).toBe(
        CatalogLimitStatus.LimitReached,
      );
    });

    it('ignores unlimited rows regardless of how much was consumed', () => {
      const unlimitedTotal = 9223372036854776000;
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 999999999, total: unlimitedTotal },
      };

      expect(
        mapDeploymentLimitsDtoToCatalogLimits(dto, t)?.status,
      ).toBeUndefined();
    });
  });
});
