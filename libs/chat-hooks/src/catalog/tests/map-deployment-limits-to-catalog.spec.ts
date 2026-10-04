import { CatalogLimitStatus } from '@epam/ai-dial-catalog';
import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import type { DeploymentLimitsLabels } from '../map-deployment-limits-to-catalog';
import { mapDeploymentLimitsDtoToCatalogLimits } from '../map-deployment-limits-to-catalog';

const compactFormat = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format;

const fullFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
}).format;

const labels: DeploymentLimitsLabels = {
  tokenGroup: 'Token limits',
  tokensPerDay: 'Today',
  tokensPerWeek: 'This week',
  tokensPerMonth: 'This month',
  followsCostLimit: 'Follows cost limit',
  formatValueLabel: (used, total) => `${used} / ${total}`,
  formatProgressAriaLabel: ({ label, used, total }) =>
    `${label}: ${used} of ${total} used`,
  formatFollowsCostLimitAriaLabel: ({ label, used }) =>
    `${label}: ${used} used. Follows cost limit.`,
};

describe('mapDeploymentLimitsDtoToCatalogLimits', () => {
  it('maps token stats into a single "Token limits" group, smallest period first', () => {
    const dto: DeploymentLimitsResponseDto = {
      monthTokenStats: { used: 9000, total: 20000 },
      dayTokenStats: { used: 2500, total: 10000 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)).toEqual({
      groups: [
        {
          label: 'Token limits',
          rows: [
            {
              label: 'Today',
              used: 2500,
              total: 10000,
              usedLabel: compactFormat(2500),
              totalLabel: compactFormat(10000),
              valueLabel: `${compactFormat(2500)} / ${compactFormat(10000)}`,
              ariaLabel: `Today: ${fullFormat(2500)} of ${fullFormat(10000)} used`,
            },
            {
              label: 'This month',
              used: 9000,
              total: 20000,
              usedLabel: compactFormat(9000),
              totalLabel: compactFormat(20000),
              valueLabel: `${compactFormat(9000)} / ${compactFormat(20000)}`,
              ariaLabel: `This month: ${fullFormat(9000)} of ${fullFormat(20000)} used`,
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

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, labels);
    const row = result?.groups[0].rows[0];
    expect(row?.usedLabel).toBe(compactFormat(1900000));
    expect(row?.usedLabel).toContain('M');
    expect(row?.totalLabel).toBe(compactFormat(2000000));
    expect(row?.totalLabel).toContain('M');
    expect(row?.ariaLabel).toBe(
      `Today: ${fullFormat(1900000)} of ${fullFormat(2000000)} used`,
    );
  });

  it('truncates the used figure instead of rounding it up past what was consumed', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 1999000, total: 5000000 },
      weekTokenStats: { used: 999999, total: 5000000 },
    };

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, labels);
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

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, labels);
    expect(result?.groups[0].rows).toHaveLength(1);
    expect(result?.groups[0].rows[0].label).toBe('Today');
  });

  it('omits request stats entirely, even when present on the DTO', () => {
    const dto: DeploymentLimitsResponseDto = {
      hourRequestStats: { used: 2, total: 10 },
      dayRequestStats: { used: 5, total: 20 },
      dayTokenStats: { used: 2500, total: 10000 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)).toEqual({
      groups: [
        {
          label: 'Token limits',
          rows: [
            {
              label: 'Today',
              used: 2500,
              total: 10000,
              usedLabel: compactFormat(2500),
              totalLabel: compactFormat(10000),
              valueLabel: `${compactFormat(2500)} / ${compactFormat(10000)}`,
              ariaLabel: `Today: ${fullFormat(2500)} of ${fullFormat(10000)} used`,
            },
          ],
        },
      ],
    });
  });

  /*
   * The cost stats are the caller's account-wide spend, not this deployment's,
   * so they must neither caption a token row nor add a row of their own.
   */
  it('ignores cost stats: no spent caption and no cost row', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 2500, total: 10000 },
      dayCostStats: { used: 0.5, total: 10 },
      weekCostStats: { used: 0.56, total: 200 },
    };

    const result = mapDeploymentLimitsDtoToCatalogLimits(dto, labels);
    expect(result?.groups).toHaveLength(1);
    expect(result?.groups[0].rows).toHaveLength(1);
    expect(result?.groups[0].rows[0]).not.toHaveProperty('captionLabel');
  });

  it("adds each period's reset line from its own `resetsAt`, on capped and unlimited rows alike", () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: {
        used: 3222,
        total: 1000000,
        resetsAt: '2026-10-02T00:00:00Z',
      },
      weekTokenStats: {
        used: 3222,
        total: 9223372036854776000,
        resetsAt: '2026-10-05T00:00:00Z',
      },
    };
    const formatResetTime = (resetsAt: string | undefined) =>
      resetsAt == null
        ? undefined
        : {
            resetsAtMs: Date.parse(resetsAt),
            isoValue: resetsAt,
            label: `Resets ${resetsAt}`,
            ariaLabel: `Usage resets ${resetsAt}`,
          };

    const rows = mapDeploymentLimitsDtoToCatalogLimits(dto, {
      ...labels,
      formatResetTime,
    })?.groups[0].rows;

    expect(rows?.map((row) => row.resetLabel)).toEqual([
      'Resets 2026-10-02T00:00:00Z',
      'Resets 2026-10-05T00:00:00Z',
    ]);
    expect(rows?.[1]).toMatchObject({
      resetIsoValue: '2026-10-05T00:00:00Z',
      resetAriaLabel: 'Usage resets 2026-10-05T00:00:00Z',
    });
  });

  it('leaves the reset fields absent when no formatter is given or it cannot format', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 1, total: 10, resetsAt: 'not-a-date' },
    };

    const withoutFormatter = mapDeploymentLimitsDtoToCatalogLimits(dto, labels)
      ?.groups[0].rows[0];
    const withFailingFormatter = mapDeploymentLimitsDtoToCatalogLimits(dto, {
      ...labels,
      formatResetTime: () => undefined,
    })?.groups[0].rows[0];

    for (const row of [withoutFormatter, withFailingFormatter]) {
      expect(row).not.toHaveProperty('resetLabel');
      expect(row).not.toHaveProperty('resetIsoValue');
      expect(row).not.toHaveProperty('resetAriaLabel');
    }
  });

  it('omits empty and zero-total stats', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 5, total: 0 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)).toBeUndefined();
    expect(
      mapDeploymentLimitsDtoToCatalogLimits(undefined, labels),
    ).toBeUndefined();
  });

  it('shows the actual tokens consumed and a "Follows cost limit" note for an unlimited row', () => {
    const unlimitedTotal = 9223372036854776000;
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 210000, total: unlimitedTotal },
      weekTokenStats: { used: 2.5, total: 10 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)).toEqual({
      groups: [
        {
          label: 'Token limits',
          rows: [
            {
              label: 'Today',
              used: 210000,
              total: unlimitedTotal,
              isUnlimited: true,
              noteLabel: 'Follows cost limit',
              valueLabel: compactFormat(210000),
              ariaLabel: `Today: ${fullFormat(210000)} used. Follows cost limit.`,
            },
            {
              label: 'This week',
              used: 2.5,
              total: 10,
              usedLabel: compactFormat(2.5),
              totalLabel: compactFormat(10),
              valueLabel: `${compactFormat(2.5)} / ${compactFormat(10)}`,
              ariaLabel: `This week: ${fullFormat(2.5)} of ${fullFormat(10)} used`,
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
        mapDeploymentLimitsDtoToCatalogLimits(dto, labels)?.status,
      ).toBeUndefined();
    });

    it('is RunningLow once a capped row reaches 75% usage', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 750, total: 1000 },
      };

      expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)?.status).toBe(
        CatalogLimitStatus.RunningLow,
      );
    });

    it('is LimitReached once a capped row reaches its limit', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 1000, total: 1000 },
      };

      expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)?.status).toBe(
        CatalogLimitStatus.LimitReached,
      );
    });

    it('takes the worst status across rows, LimitReached outranking RunningLow', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 750, total: 1000 },
        weekTokenStats: { used: 1000, total: 1000 },
      };

      expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)?.status).toBe(
        CatalogLimitStatus.LimitReached,
      );
    });

    it('ignores unlimited rows regardless of how much was consumed', () => {
      const unlimitedTotal = 9223372036854776000;
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 999999999, total: unlimitedTotal },
      };

      expect(
        mapDeploymentLimitsDtoToCatalogLimits(dto, labels)?.status,
      ).toBeUndefined();
    });
  });
});
