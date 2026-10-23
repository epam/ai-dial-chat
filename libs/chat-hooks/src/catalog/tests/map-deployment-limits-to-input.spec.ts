import { CatalogLimitStatus } from '@epam/ai-dial-catalog';
import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import type { FormatResetTime } from '../../usage/map-usage-data-to-dashboard';
import type {
  AccountUsage,
  UsageLimitsSources,
} from '../../usage/useDeploymentUsageLimits/useDeploymentUsageLimits';
import {
  mapDeploymentLimitsToInput,
  type ConversationInputLimitsLabels,
} from '../map-deployment-limits-to-input';

const COST_KEYS = ['dayCostStats', 'weekCostStats', 'monthCostStats'] as const;

/*
 * Splits a combined fixture the way the two endpoints return it: day, week,
 * and month cost stats on the account usage, everything else on the
 * deployment usage. The cases below read as one DTO; the cases under
 * "sources" exercise each side directly.
 */
const asSources = (
  dto: DeploymentLimitsResponseDto | undefined,
): UsageLimitsSources => {
  if (dto == null) {
    return { deployment: undefined, account: undefined };
  }
  const deployment: DeploymentLimitsResponseDto = { ...dto };
  const account: AccountUsage = {};
  for (const key of COST_KEYS) {
    account[key] = dto[key];
    delete deployment[key];
  }
  return { deployment, account };
};

const mapInput = (
  dto: DeploymentLimitsResponseDto | undefined,
  inputLabels: ConversationInputLimitsLabels,
  formatResetTime?: FormatResetTime,
) => mapDeploymentLimitsToInput(asSources(dto), inputLabels, formatResetTime);

const labels: ConversationInputLimitsLabels = {
  tokenGroup: 'Token limits',
  costGroup: 'Cost limits',
  periodDay: 'Today',
  periodWeek: 'This week',
  periodMonth: 'This month',
  formatValueLabel: (used, total) => `${used} / ${total}`,
  formatProgressAriaLabel: ({ label, used, total }) =>
    `${label}: ${used} of ${total} used`,
};

const DAY_RESETS_AT = '2026-09-16T00:00:00Z';

const formatReset: FormatResetTime = (resetsAt) =>
  resetsAt == null
    ? undefined
    : {
        resetsAtMs: Date.parse(resetsAt),
        isoValue: resetsAt,
        label: `Resets ${resetsAt}`,
        ariaLabel: `Usage resets ${resetsAt}`,
      };

const rowLabels = (dto: DeploymentLimitsResponseDto) =>
  mapInput(dto, labels)?.groups.flatMap((group) =>
    group.rows.map((row) => row.label),
  );

describe('mapDeploymentLimitsToInput', () => {
  describe('the running-low threshold decides what is listed', () => {
    it('omits a row below three quarters of its cap', () => {
      expect(
        mapInput({ dayTokenStats: { used: 74, total: 100 } }, labels),
      ).toBeUndefined();
    });

    it('lists a row exactly at three quarters', () => {
      expect(rowLabels({ dayTokenStats: { used: 75, total: 100 } })).toEqual([
        'Today',
      ]);
    });

    it('keeps only the periods that are close to their cap', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 90, total: 100 },
        weekTokenStats: { used: 5, total: 100 },
        monthTokenStats: { used: 80, total: 100 },
      };

      expect(rowLabels(dto)).toEqual(['Today', 'This month']);
    });

    it('surfaces a stretched account budget even when this model is barely used', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 2, total: 100 },
        weekTokenStats: { used: 2, total: 100 },
        monthTokenStats: { used: 2, total: 100 },
        monthCostStats: { used: 90, total: 100 },
      };

      const result = mapInput(dto, labels);

      expect(result?.groups).toHaveLength(1);
      expect(result?.groups[0].label).toBe('Cost limits');
      expect(result?.groups[0].rows.map((row) => row.label)).toEqual([
        'This month',
      ]);
    });

    it('produces nothing at all when every limit is comfortable', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 2, total: 100 },
        monthTokenStats: { used: 10, total: 100 },
        monthCostStats: { used: 1, total: 500 },
      };

      expect(mapInput(dto, labels)).toBeUndefined();
    });

    it('never lists a period with no cap of its own, which has no ratio to compare', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: {
          used: Number.MAX_SAFE_INTEGER,
          total: Number.MAX_SAFE_INTEGER,
        },
        dayCostStats: { used: 5, total: Number.MAX_SAFE_INTEGER },
      };

      expect(mapInput(dto, labels)).toBeUndefined();
    });
  });

  describe('grouping and order', () => {
    it('puts the deployment token limits before the account cost budget', () => {
      const dto: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 90, total: 100 },
        weekTokenStats: { used: 95, total: 100 },
        dayCostStats: { used: 80, total: 100 },
        monthCostStats: { used: 99, total: 100 },
      };

      const result = mapInput(dto, labels);

      expect(result?.groups.map((group) => group.label)).toEqual([
        'Token limits',
        'Cost limits',
      ]);
      expect(result?.groups[0].rows.map((row) => row.label)).toEqual([
        'Today',
        'This week',
      ]);
      expect(result?.groups[1].rows.map((row) => row.label)).toEqual([
        'Today',
        'This month',
      ]);
    });

    it('never maps the rolling-minute stats', () => {
      const dto: DeploymentLimitsResponseDto = {
        minuteTokenStats: { used: 17549, total: 10000 },
        minuteCostStats: { used: 9, total: 10 },
      };

      expect(mapInput(dto, labels)).toBeUndefined();
    });

    it('never maps the request stats', () => {
      const dto: DeploymentLimitsResponseDto = {
        hourRequestStats: { used: 9, total: 10 },
        dayRequestStats: { used: 9, total: 10 },
      };

      expect(mapInput(dto, labels)).toBeUndefined();
    });

    it('returns undefined for an absent dto', () => {
      expect(mapInput(undefined, labels)).toBeUndefined();
    });

    it.each([
      { used: 100, total: 0 },
      { used: 100, total: -1 },
      { used: Number.NaN, total: 100 },
      { used: Number.POSITIVE_INFINITY, total: 100 },
      { used: 100, total: Number.NaN },
      { used: 100, total: Number.POSITIVE_INFINITY },
    ])('returns undefined for unusable stats %j', (dayTokenStats) => {
      expect(mapInput({ dayTokenStats }, labels)).toBeUndefined();
    });
  });

  describe('row contents', () => {
    it('formats a token row compactly through the injected callbacks', () => {
      const result = mapInput(
        { dayTokenStats: { used: 9000, total: 10000 } },
        labels,
      );

      expect(result?.groups[0].rows[0]).toMatchObject({
        label: 'Today',
        used: 9000,
        total: 10000,
        usedLabel: '9K',
        totalLabel: '10K',
        valueLabel: '9K / 10K',
        ariaLabel: 'Today: 9,000 of 10,000 used',
      });
    });

    it('formats a cost row as currency', () => {
      const result = mapInput(
        { dayCostStats: { used: 90.5, total: 100 } },
        labels,
      );

      expect(result?.groups[0].rows[0]).toMatchObject({
        usedLabel: '$90.5',
        totalLabel: '$100',
        valueLabel: '$90.5 / $100',
      });
    });

    it('never captions a token row with the account-wide spend', () => {
      const result = mapInput(
        {
          dayTokenStats: { used: 90, total: 100 },
          dayCostStats: { used: 90, total: 100 },
        },
        labels,
      );

      expect(result?.groups[0].rows[0]).not.toHaveProperty('captionLabel');
    });
  });

  describe('status', () => {
    it('reports the worst listed row', () => {
      const result = mapInput(
        {
          dayTokenStats: { used: 100, total: 100 },
          monthTokenStats: { used: 80, total: 100 },
        },
        labels,
      );

      expect(result?.status).toBe(CatalogLimitStatus.LimitReached);
    });

    it('reports running low when nothing has reached its cap', () => {
      const result = mapInput(
        { dayTokenStats: { used: 80, total: 100 } },
        labels,
      );

      expect(result?.status).toBe(CatalogLimitStatus.RunningLow);
    });

    it('lets a cost row drive the status', () => {
      const result = mapInput(
        {
          dayTokenStats: { used: 80, total: 100 },
          dayCostStats: { used: 100, total: 100 },
        },
        labels,
      );

      expect(result?.status).toBe(CatalogLimitStatus.LimitReached);
    });

    it('is never absent, every listed row being at or past the running-low mark', () => {
      const result = mapInput(
        { dayTokenStats: { used: 75, total: 100 } },
        labels,
      );

      expect(result?.status).toBe(CatalogLimitStatus.RunningLow);
    });
  });

  describe('reset times', () => {
    it('stores the strings the callback returned and no raw timestamp', () => {
      const result = mapInput(
        { dayTokenStats: { used: 90, total: 100, resetsAt: DAY_RESETS_AT } },
        labels,
        formatReset,
      );
      const row = result?.groups[0].rows[0];

      expect(row?.resetLabel).toBe(`Resets ${DAY_RESETS_AT}`);
      expect(row?.resetIsoValue).toBe(DAY_RESETS_AT);
      expect(row?.resetAriaLabel).toBe(`Usage resets ${DAY_RESETS_AT}`);
    });

    it('passes the raw resetsAt straight to the callback', () => {
      const spy = vi.fn(formatReset);

      mapInput(
        { dayTokenStats: { used: 90, total: 100, resetsAt: DAY_RESETS_AT } },
        labels,
        spy,
      );

      expect(spy).toHaveBeenCalledWith(DAY_RESETS_AT);
    });

    it('carries reset times on cost rows too', () => {
      const result = mapInput(
        { dayCostStats: { used: 90, total: 100, resetsAt: DAY_RESETS_AT } },
        labels,
        formatReset,
      );

      expect(result?.groups[0].rows[0].resetIsoValue).toBe(DAY_RESETS_AT);
    });

    it('leaves all three fields absent when no callback is supplied', () => {
      const result = mapInput(
        { dayTokenStats: { used: 90, total: 100, resetsAt: DAY_RESETS_AT } },
        labels,
      );
      const row = result?.groups[0].rows[0];

      expect(row).not.toHaveProperty('resetLabel');
      expect(row).not.toHaveProperty('resetIsoValue');
      expect(row).not.toHaveProperty('resetAriaLabel');
    });

    it('leaves all three fields absent when the callback declines the value', () => {
      const result = mapInput(
        { dayTokenStats: { used: 90, total: 100, resetsAt: 'not-a-date' } },
        labels,
        () => undefined,
      );
      const row = result?.groups[0].rows[0];

      expect(row).not.toHaveProperty('resetLabel');
      expect(row?.used).toBe(90);
    });
  });

  describe('sources', () => {
    const agentUsage: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 0, total: 2_000_000 },
      weekCostStats: { used: 130.98, total: Number.MAX_SAFE_INTEGER },
    };

    it('does not count an agent’s spend twice against the account budget', () => {
      const result = mapDeploymentLimitsToInput(
        {
          deployment: agentUsage,
          account: { weekCostStats: { used: 132.24, total: 200 } },
        },
        labels,
      );

      expect(result).toBeUndefined();
    });

    it('lists the same cost group whichever deployment is selected', () => {
      const account: AccountUsage = {
        weekCostStats: { used: 180, total: 200 },
      };
      const modelUsage: DeploymentLimitsResponseDto = {
        dayTokenStats: { used: 10, total: 1_000_000 },
      };

      const forModel = mapDeploymentLimitsToInput(
        { deployment: modelUsage, account },
        labels,
      );
      const forAgent = mapDeploymentLimitsToInput(
        { deployment: agentUsage, account },
        labels,
      );

      expect(forModel?.groups).toEqual(forAgent?.groups);
      expect(forModel?.groups.map((group) => group.label)).toEqual([
        'Cost limits',
      ]);
    });

    it('ignores cost stats on the deployment source', () => {
      expect(
        mapDeploymentLimitsToInput(
          {
            deployment: { weekCostStats: { used: 100, total: 100 } },
            account: undefined,
          },
          labels,
        ),
      ).toBeUndefined();
    });

    it('ignores token stats on the account source', () => {
      expect(
        mapDeploymentLimitsToInput(
          {
            deployment: undefined,
            account: {
              dayTokenStats: { used: 100, total: 100 },
            } as AccountUsage,
          },
          labels,
        ),
      ).toBeUndefined();
    });

    it('drops only the group of a missing source', () => {
      const result = mapDeploymentLimitsToInput(
        {
          deployment: undefined,
          account: { dayCostStats: { used: 90, total: 100 } },
        },
        labels,
      );

      expect(result?.groups.map((group) => group.label)).toEqual([
        'Cost limits',
      ]);
    });

    it('returns undefined when both sources are missing', () => {
      expect(
        mapDeploymentLimitsToInput(
          { deployment: undefined, account: undefined },
          labels,
        ),
      ).toBeUndefined();
    });
  });
});
