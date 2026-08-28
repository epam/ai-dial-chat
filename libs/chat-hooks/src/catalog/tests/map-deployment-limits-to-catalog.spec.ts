import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import type { DeploymentLimitsLabels } from '../map-deployment-limits-to-catalog';
import { mapDeploymentLimitsDtoToCatalogLimits } from '../map-deployment-limits-to-catalog';

const format = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
}).format;

const costFormat = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
}).format;

const labels: DeploymentLimitsLabels = {
  requestsPerHour: 'Requests per hour',
  requestsPerDay: 'Requests per day',
  tokensPerMinute: 'Tokens per minute',
  tokensPerDay: 'Tokens per day',
  tokensPerWeek: 'Tokens per week',
  tokensPerMonth: 'Tokens per month',
  costPerMinute: 'Cost per minute',
  costPerDay: 'Cost per day',
  costPerWeek: 'Cost per week',
  costPerMonth: 'Cost per month',
  unlimitedValue: 'Unlimited',
  formatValueLabel: (used, total) => `${used} / ${total}`,
  formatProgressAriaLabel: ({ label, used, total }) =>
    `${label}: ${used} of ${total} used`,
};

describe('mapDeploymentLimitsDtoToCatalogLimits', () => {
  it('maps supported deployment limit stats into progress rows in display order', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 2500, total: 10000 },
      hourRequestStats: { used: 2, total: 10 },
      monthCostStats: { used: 12.345, total: 25 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)).toEqual({
      rows: [
        {
          label: 'Requests per hour',
          used: 2,
          total: 10,
          usedLabel: '2',
          totalLabel: '10',
          valueLabel: '2 / 10',
          ariaLabel: 'Requests per hour: 2 of 10 used',
        },
        {
          label: 'Tokens per day',
          used: 2500,
          total: 10000,
          usedLabel: format(2500),
          totalLabel: format(10000),
          valueLabel: `${format(2500)} / ${format(10000)}`,
          ariaLabel: `Tokens per day: ${format(2500)} of ${format(10000)} used`,
        },
        {
          label: 'Cost per month',
          used: 12.345,
          total: 25,
          usedLabel: costFormat(12.345),
          totalLabel: costFormat(25),
          valueLabel: `${costFormat(12.345)} / ${costFormat(25)}`,
          ariaLabel: `Cost per month: ${costFormat(12.345)} of ${costFormat(25)} used`,
        },
      ],
    });
  });

  it('omits empty and zero-total stats', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayRequestStats: { used: 5, total: 0 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)).toBeUndefined();
    expect(
      mapDeploymentLimitsDtoToCatalogLimits(undefined, labels),
    ).toBeUndefined();
  });

  it('keeps unlimited stats and formats their value as Unlimited', () => {
    const unlimitedTotal = 9223372036854776000;
    const dto: DeploymentLimitsResponseDto = {
      minuteTokenStats: { used: 0, total: unlimitedTotal },
      dayTokenStats: { used: 0, total: unlimitedTotal },
      weekCostStats: { used: 0.11901255, total: unlimitedTotal },
      dayCostStats: { used: 0.003852, total: 100 },
      monthCostStats: { used: 3.64120297, total: 500 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, labels)).toEqual({
      rows: [
        {
          label: 'Tokens per minute',
          used: 0,
          total: unlimitedTotal,
          isUnlimited: true,
          valueLabel: 'Unlimited',
          ariaLabel: 'Tokens per minute: 0 of Unlimited used',
        },
        {
          label: 'Tokens per day',
          used: 0,
          total: unlimitedTotal,
          isUnlimited: true,
          valueLabel: 'Unlimited',
          ariaLabel: 'Tokens per day: 0 of Unlimited used',
        },
        {
          label: 'Cost per day',
          used: 0.003852,
          total: 100,
          usedLabel: costFormat(0.003852),
          totalLabel: costFormat(100),
          valueLabel: `${costFormat(0.003852)} / ${costFormat(100)}`,
          ariaLabel: `Cost per day: ${costFormat(0.003852)} of ${costFormat(100)} used`,
        },
        {
          label: 'Cost per week',
          used: 0.11901255,
          total: unlimitedTotal,
          isUnlimited: true,
          valueLabel: 'Unlimited',
          ariaLabel: `Cost per week: ${costFormat(0.11901255)} of Unlimited used`,
        },
        {
          label: 'Cost per month',
          used: 3.64120297,
          total: 500,
          usedLabel: costFormat(3.64120297),
          totalLabel: costFormat(500),
          valueLabel: `${costFormat(3.64120297)} / ${costFormat(500)}`,
          ariaLabel: `Cost per month: ${costFormat(3.64120297)} of ${costFormat(500)} used`,
        },
      ],
    });
  });
});
