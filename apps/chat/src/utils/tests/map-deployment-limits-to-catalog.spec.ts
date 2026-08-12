import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { mapDeploymentLimitsDtoToCatalogLimits } from '../map-deployment-limits-to-catalog';

const labels: Partial<Record<CatalogI18nKeys, string>> = {
  [CatalogI18nKeys.DetailsLimitsRequestsPerHour]: 'Requests per hour',
  [CatalogI18nKeys.DetailsLimitsRequestsPerDay]: 'Requests per day',
  [CatalogI18nKeys.DetailsLimitsTokensPerMinute]: 'Tokens per minute',
  [CatalogI18nKeys.DetailsLimitsTokensPerDay]: 'Tokens per day',
  [CatalogI18nKeys.DetailsLimitsTokensPerWeek]: 'Tokens per week',
  [CatalogI18nKeys.DetailsLimitsTokensPerMonth]: 'Tokens per month',
  [CatalogI18nKeys.DetailsLimitsCostPerMinute]: 'Cost per minute',
  [CatalogI18nKeys.DetailsLimitsCostPerDay]: 'Cost per day',
  [CatalogI18nKeys.DetailsLimitsCostPerWeek]: 'Cost per week',
  [CatalogI18nKeys.DetailsLimitsCostPerMonth]: 'Cost per month',
};

const format = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 6,
}).format;

const t = ((key: string, params?: Record<string, string>) => {
  if (key === CatalogI18nKeys.DetailsLimitsValue) {
    return `${params?.used} / ${params?.total}`;
  }
  if (key === CatalogI18nKeys.DetailsLimitsUnlimitedValue) {
    return 'Unlimited';
  }
  if (key === CatalogI18nKeys.DetailsLimitsProgressAriaLabel) {
    return `${params?.label}: ${params?.used} of ${params?.total} used`;
  }
  return labels[key as CatalogI18nKeys] ?? key;
}) as TFunction;

describe('mapDeploymentLimitsDtoToCatalogLimits', () => {
  it('maps supported deployment limit stats into progress rows in display order', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 2500, total: 10000 },
      hourRequestStats: { used: 2, total: 10 },
      monthCostStats: { used: 12.345, total: 25 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)).toEqual({
      rows: [
        {
          label: 'Requests per hour',
          used: 2,
          total: 10,
          valueLabel: '2 / 10',
          ariaLabel: 'Requests per hour: 2 of 10 used',
        },
        {
          label: 'Tokens per day',
          used: 2500,
          total: 10000,
          valueLabel: `${format(2500)} / ${format(10000)}`,
          ariaLabel: `Tokens per day: ${format(2500)} of ${format(10000)} used`,
        },
        {
          label: 'Cost per month',
          used: 12.345,
          total: 25,
          valueLabel: `${format(12.345)} / ${format(25)}`,
          ariaLabel: `Cost per month: ${format(12.345)} of ${format(25)} used`,
        },
      ],
    });
  });

  it('omits empty and zero-total stats', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayRequestStats: { used: 5, total: 0 },
    };

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)).toBeUndefined();
    expect(mapDeploymentLimitsDtoToCatalogLimits(undefined, t)).toBeUndefined();
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

    expect(mapDeploymentLimitsDtoToCatalogLimits(dto, t)).toEqual({
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
          valueLabel: '0.003852 / 100',
          ariaLabel: 'Cost per day: 0.003852 of 100 used',
        },
        {
          label: 'Cost per week',
          used: 0.11901255,
          total: unlimitedTotal,
          isUnlimited: true,
          valueLabel: 'Unlimited',
          ariaLabel: `Cost per week: ${format(0.11901255)} of Unlimited used`,
        },
        {
          label: 'Cost per month',
          used: 3.64120297,
          total: 500,
          valueLabel: `${format(3.64120297)} / 500`,
          ariaLabel: `Cost per month: ${format(3.64120297)} of 500 used`,
        },
      ],
    });
  });
});
