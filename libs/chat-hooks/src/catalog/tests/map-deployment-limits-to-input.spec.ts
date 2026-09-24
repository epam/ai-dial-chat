import { CatalogLimitStatus } from '@epam/ai-dial-catalog';
import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import type { FormatResetTime } from '../../usage/map-usage-data-to-dashboard';
import {
  mapDeploymentLimitsToInput,
  type ConversationInputLimitsLabels,
} from '../map-deployment-limits-to-input';

const labels: ConversationInputLimitsLabels = {
  tokenGroup: 'Token limits',
  tokensPerDay: 'Today',
  tokensPerWeek: 'This week',
  tokensPerMonth: 'This month',
  followsCostLimit: 'Follows cost limit',
  formatSpentCaption: (amount) => `${amount} spent`,
  formatValueLabel: (used, total) => `${used} / ${total}`,
  formatProgressAriaLabel: ({ label, used, total }) =>
    `${label}: ${used} of ${total} used`,
  formatFollowsCostLimitAriaLabel: ({ label, used }) =>
    `${label}: ${used} used. Follows cost limit.`,
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
  mapDeploymentLimitsToInput(dto, labels)?.groups[0].rows.map(
    (row) => row.label,
  );

describe('mapDeploymentLimitsToInput', () => {
  it('maps the three configured periods into one group in day, week, month order', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 20, total: 100 },
      weekTokenStats: { used: 30, total: 200 },
      monthTokenStats: { used: 40, total: 400 },
    };

    const result = mapDeploymentLimitsToInput(dto, labels);

    expect(result?.groups).toHaveLength(1);
    expect(result?.groups[0].label).toBe('Token limits');
    expect(result?.groups[0].rows.map((row) => row.label)).toEqual([
      'Today',
      'This week',
      'This month',
    ]);
  });

  it('never maps the rolling-minute stat', () => {
    const dto: DeploymentLimitsResponseDto = {
      minuteTokenStats: { used: 10, total: 100 },
      dayTokenStats: { used: 20, total: 100 },
    };

    expect(rowLabels(dto)).toEqual(['Today']);
  });

  it('returns undefined when only a minute stat qualifies', () => {
    expect(
      mapDeploymentLimitsToInput(
        { minuteTokenStats: { used: 10, total: 100 } },
        labels,
      ),
    ).toBeUndefined();
  });

  it('skips a missing period without shifting the others', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 20, total: 100 },
      monthTokenStats: { used: 40, total: 400 },
    };

    expect(rowLabels(dto)).toEqual(['Today', 'This month']);
  });

  it('formats a capped row through the injected callbacks and clamps a negative used', () => {
    const result = mapDeploymentLimitsToInput(
      {
        dayTokenStats: { used: -5, total: 10000 },
        dayCostStats: { used: 1.2, total: 100 },
      },
      labels,
    );

    expect(result?.groups[0].rows[0]).toMatchObject({
      label: 'Today',
      used: 0,
      total: 10000,
      usedLabel: '0',
      totalLabel: '10K',
      valueLabel: '0 / 10K',
      captionLabel: '$1.2 spent',
      ariaLabel: 'Today: 0 of 10,000 used',
    });
  });

  it('treats the unlimited sentinel as following the cost limit', () => {
    const result = mapDeploymentLimitsToInput(
      { monthTokenStats: { used: 4200, total: Number.MAX_SAFE_INTEGER } },
      labels,
    );
    const row = result?.groups[0].rows[0];

    expect(row?.isUnlimited).toBe(true);
    expect(row?.noteLabel).toBe('Follows cost limit');
    expect(row?.usedLabel).toBeUndefined();
    expect(row?.totalLabel).toBeUndefined();
    expect(row?.valueLabel).toBe('4.2K');
    expect(row?.ariaLabel).toBe('This month: 4,200 used. Follows cost limit.');
  });

  it('returns undefined for an absent dto', () => {
    expect(mapDeploymentLimitsToInput(undefined, labels)).toBeUndefined();
  });

  it.each([
    { used: 1, total: 0 },
    { used: 1, total: -1 },
    { used: Number.NaN, total: 100 },
    { used: Number.POSITIVE_INFINITY, total: 100 },
    { used: 1, total: Number.NaN },
    { used: 1, total: Number.POSITIVE_INFINITY },
  ])('returns undefined for unusable stats %j', (dayTokenStats) => {
    expect(
      mapDeploymentLimitsToInput({ dayTokenStats }, labels),
    ).toBeUndefined();
  });

  describe('status', () => {
    it('reports the worst capped row, not the last one', () => {
      const result = mapDeploymentLimitsToInput(
        {
          dayTokenStats: { used: 100, total: 100 },
          monthTokenStats: { used: 10, total: 100 },
        },
        labels,
      );

      expect(result?.status).toBe(CatalogLimitStatus.LimitReached);
    });

    it('reports running low at three quarters consumed', () => {
      const result = mapDeploymentLimitsToInput(
        {
          dayTokenStats: { used: 75, total: 100 },
          monthTokenStats: { used: 10, total: 100 },
        },
        labels,
      );

      expect(result?.status).toBe(CatalogLimitStatus.RunningLow);
    });

    it('leaves the status absent when every capped row is comfortable', () => {
      const result = mapDeploymentLimitsToInput(
        { dayTokenStats: { used: 10, total: 100 } },
        labels,
      );

      expect(result?.status).toBeUndefined();
    });

    it('ignores an unlimited row when deriving the status', () => {
      const result = mapDeploymentLimitsToInput(
        {
          dayTokenStats: { used: 10, total: 100 },
          monthTokenStats: {
            used: Number.MAX_SAFE_INTEGER,
            total: Number.MAX_SAFE_INTEGER,
          },
        },
        labels,
      );

      expect(result?.status).toBeUndefined();
    });
  });

  describe('reset times', () => {
    it('stores the strings the callback returned and no raw timestamp', () => {
      const result = mapDeploymentLimitsToInput(
        { dayTokenStats: { used: 20, total: 100, resetsAt: DAY_RESETS_AT } },
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

      mapDeploymentLimitsToInput(
        { dayTokenStats: { used: 20, total: 100, resetsAt: DAY_RESETS_AT } },
        labels,
        spy,
      );

      expect(spy).toHaveBeenCalledWith(DAY_RESETS_AT);
    });

    it('leaves all three fields absent when no callback is supplied', () => {
      const result = mapDeploymentLimitsToInput(
        { dayTokenStats: { used: 20, total: 100, resetsAt: DAY_RESETS_AT } },
        labels,
      );
      const row = result?.groups[0].rows[0];

      expect(row).not.toHaveProperty('resetLabel');
      expect(row).not.toHaveProperty('resetIsoValue');
      expect(row).not.toHaveProperty('resetAriaLabel');
    });

    it('leaves all three fields absent when the callback declines the value', () => {
      const result = mapDeploymentLimitsToInput(
        { dayTokenStats: { used: 20, total: 100, resetsAt: 'not-a-date' } },
        labels,
        () => undefined,
      );
      const row = result?.groups[0].rows[0];

      expect(row).not.toHaveProperty('resetLabel');
      expect(row?.used).toBe(20);
      expect(row?.total).toBe(100);
    });

    it('carries a reset line on an unlimited row too', () => {
      const result = mapDeploymentLimitsToInput(
        {
          monthTokenStats: {
            used: 4200,
            total: Number.MAX_SAFE_INTEGER,
            resetsAt: DAY_RESETS_AT,
          },
        },
        labels,
        formatReset,
      );
      const row = result?.groups[0].rows[0];

      expect(row?.isUnlimited).toBe(true);
      expect(row?.resetIsoValue).toBe(DAY_RESETS_AT);
    });
  });
});
