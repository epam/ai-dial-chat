import type {
  DeploymentItemDto,
  DeploymentLimitsResponseDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { DeploymentItemDtoTypeEnum } from '@epam/ai-dial-chat-api-client';
import {
  ModelLimitMetricKind,
  ModelLimitsPeriod,
  ModelLimitStatus,
} from '@epam/ai-dial-usage-dashboard';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { UsageI18nKeys } from '../../constants/translation-keys';
import { mapUserUsageToModelLimits } from '../map-user-usage-to-model-limits';

const t = ((key: string, params?: Record<string, unknown>) => {
  if (key === UsageI18nKeys.UnlimitedProgressAriaLabel) {
    return `${params?.used} used, unlimited`;
  }
  if (key === UsageI18nKeys.ProgressAriaLabel) {
    return `${params?.used} of ${params?.total}, ${params?.percent}% used`;
  }
  if (key === UsageI18nKeys.UnavailableLabel) {
    return 'Not available';
  }
  return key;
}) as TFunction;

const modelItem = (
  overrides: Partial<DeploymentItemDto> = {},
): DeploymentItemDto => ({
  id: 'gpt-4o',
  displayName: 'GPT-4o',
  type: DeploymentItemDtoTypeEnum.Model,
  ...overrides,
});

const withUsage = (
  deployments: Record<string, DeploymentLimitsResponseDto>,
): UserLimitStatsResponseDto => ({ deployments });

describe('mapUserUsageToModelLimits', () => {
  it('returns one row per entry in `usage.deployments`', () => {
    const usage = withUsage({
      'gpt-4o': { dayTokenStats: { used: 100, total: 1000 } },
      'claude-3': { dayTokenStats: { used: 50, total: 500 } },
    });
    const items = [
      modelItem({ id: 'gpt-4o' }),
      modelItem({ id: 'claude-3', displayName: 'Claude 3' }),
    ];

    const rows = mapUserUsageToModelLimits(
      usage,
      items,
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows).toHaveLength(2);
  });

  it('returns an empty array when `usage` is undefined', () => {
    expect(
      mapUserUsageToModelLimits(
        undefined,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      ),
    ).toEqual([]);
  });

  it('returns an empty array when `usage.deployments` is undefined', () => {
    expect(
      mapUserUsageToModelLimits(
        {},
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      ),
    ).toEqual([]);
  });

  it('excludes a deployment with all-zero usage for the selected period', () => {
    const usage = withUsage({
      'gpt-4o': {
        dayCostStats: { used: 0, total: 2 ** 53 },
        dayTokenStats: { used: 0, total: 1000 },
        dayRequestStats: { used: 0, total: 100 },
      },
    });

    const rows = mapUserUsageToModelLimits(
      usage,
      [modelItem()],
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows).toHaveLength(0);
  });

  it('falls back to the deployment ID and no avatar when the ID has no matching item', () => {
    const usage = withUsage({
      'unknown-model': { dayTokenStats: { used: 1, total: 10 } },
    });

    const rows = mapUserUsageToModelLimits(
      usage,
      [],
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('unknown-model');
    expect(rows[0].avatarSrc).toBeUndefined();
  });

  it('resolves a model icon URL before passing it to the dashboard row', () => {
    const usage = withUsage({
      'gpt-4o': { dayTokenStats: { used: 1, total: 10 } },
    });

    const rows = mapUserUsageToModelLimits(
      usage,
      [modelItem({ iconUrl: 'model icon.svg' })],
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows[0].avatarSrc).toBe(
      '/api/themes/icon?iconName=model%20icon.svg',
    );
  });

  it('does not use a non-model item to resolve a matching deployment ID', () => {
    const usage = withUsage({
      shared_id: { dayTokenStats: { used: 1, total: 10 } },
    });
    const items = [
      modelItem({
        id: 'shared_id',
        type: DeploymentItemDtoTypeEnum.Application,
        displayName: 'Some App',
      }),
    ];

    const rows = mapUserUsageToModelLimits(
      usage,
      items,
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows[0].name).toBe('shared_id');
  });

  it('orders rows by `usage.deployments` key order, regardless of the model-items order', () => {
    const items = [
      modelItem({ id: 'b', displayName: 'B' }),
      modelItem({ id: 'a', displayName: 'A' }),
    ];
    const usage = withUsage({
      a: { dayTokenStats: { used: 1, total: 10 } },
      b: { dayTokenStats: { used: 1, total: 10 } },
    });

    const rows = mapUserUsageToModelLimits(
      usage,
      items,
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('produces a row for every deployment key regardless of item-resolution order, in key order', () => {
    const items = [modelItem({ id: 'known' })];
    const usage = withUsage({
      unresolved: { dayTokenStats: { used: 1, total: 10 } },
      known: { dayTokenStats: { used: 1, total: 10 } },
    });

    const rows = mapUserUsageToModelLimits(
      usage,
      items,
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows.map((row) => row.id)).toEqual(['unresolved', 'known']);
  });

  it('never adds a row for an accessible model absent from `usage.deployments`', () => {
    const items = [
      modelItem({ id: 'used-model' }),
      modelItem({ id: 'never-used-model' }),
    ];
    const usage = withUsage({
      'used-model': { dayTokenStats: { used: 1, total: 10 } },
    });

    const rows = mapUserUsageToModelLimits(
      usage,
      items,
      ModelLimitsPeriod.Last24Hours,
      'en',
      t,
    );

    expect(rows.map((row) => row.id)).toEqual(['used-model']);
  });

  describe('period-to-field mapping', () => {
    const usage = withUsage({
      'gpt-4o': {
        minuteCostStats: { used: 0.1, total: 2 ** 53 },
        dayCostStats: { used: 1, total: 2 ** 53 },
        weekCostStats: { used: 2, total: 2 ** 53 },
        monthCostStats: { used: 3, total: 2 ** 53 },
        minuteTokenStats: { used: 10, total: 100 },
        dayTokenStats: { used: 100, total: 1000 },
        weekTokenStats: { used: 200, total: 2000 },
        monthTokenStats: { used: 300, total: 3000 },
        hourRequestStats: { used: 2, total: 20 },
        dayRequestStats: { used: 5, total: 50 },
      },
    });
    const items = [modelItem()];

    it('reads minute-scoped fields for LastMinute and marks Requests unavailable', () => {
      const [row] = mapUserUsageToModelLimits(
        usage,
        items,
        ModelLimitsPeriod.LastMinute,
        'en',
        t,
      );

      expect(row.tokens.usedLabel).toBe('10');
      expect(row.tokens.totalLabel).toBe('100');
      expect(row.cost.usedLabel).toContain('0.1');
      expect(row.requests.kind).toBe(ModelLimitMetricKind.Unavailable);
    });

    it('reads hour-scoped Requests for LastHour and marks Cost/Tokens unavailable', () => {
      const [row] = mapUserUsageToModelLimits(
        usage,
        items,
        ModelLimitsPeriod.LastHour,
        'en',
        t,
      );

      expect(row.requests.kind).toBe(ModelLimitMetricKind.Finite);
      expect(row.requests.usedLabel).toBe('2');
      expect(row.requests.totalLabel).toBe('20');
      expect(row.cost.kind).toBe(ModelLimitMetricKind.Unavailable);
      expect(row.tokens.kind).toBe(ModelLimitMetricKind.Unavailable);
    });

    it('reads day-scoped fields for Last24Hours, including a real Requests value', () => {
      const [row] = mapUserUsageToModelLimits(
        usage,
        items,
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.tokens.usedLabel).toBe('100');
      expect(row.tokens.totalLabel).toBe('1,000');
      expect(row.requests.kind).toBe(ModelLimitMetricKind.Finite);
      expect(row.requests.usedLabel).toBe('5');
    });

    it('reads week-scoped fields for Last7Days and marks Requests unavailable', () => {
      const [row] = mapUserUsageToModelLimits(
        usage,
        items,
        ModelLimitsPeriod.Last7Days,
        'en',
        t,
      );

      expect(row.tokens.usedLabel).toBe('200');
      expect(row.requests.kind).toBe(ModelLimitMetricKind.Unavailable);
    });

    it('reads month-scoped fields for Last30Days and marks Requests unavailable', () => {
      const [row] = mapUserUsageToModelLimits(
        usage,
        items,
        ModelLimitsPeriod.Last30Days,
        'en',
        t,
      );

      expect(row.tokens.usedLabel).toBe('300');
      expect(row.requests.kind).toBe(ModelLimitMetricKind.Unavailable);
    });

    it('never falls back to dayRequestStats for the week/month periods', () => {
      const [weekRow] = mapUserUsageToModelLimits(
        usage,
        items,
        ModelLimitsPeriod.Last7Days,
        'en',
        t,
      );
      const [monthRow] = mapUserUsageToModelLimits(
        usage,
        items,
        ModelLimitsPeriod.Last30Days,
        'en',
        t,
      );

      expect(weekRow.requests.usedLabel).toBeUndefined();
      expect(monthRow.requests.usedLabel).toBeUndefined();
    });
  });

  describe('per-metric classification', () => {
    it('classifies cost as always unlimited when the stat entry is well-formed', () => {
      const usage = withUsage({
        'gpt-4o': { dayCostStats: { used: 4.2, total: 2 ** 53 } },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.cost.kind).toBe(ModelLimitMetricKind.Unlimited);
      expect(row.cost.usedLabel).toContain('4.2');
      expect(row.status).not.toBe(ModelLimitStatus.LimitReached);
    });

    it('classifies cost as unavailable when the stat entry is missing', () => {
      const usage = withUsage({
        'gpt-4o': { dayTokenStats: { used: 1, total: 10 } },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.cost.kind).toBe(ModelLimitMetricKind.Unavailable);
    });

    it('classifies a finite token stat as progress-capable with an uncapped usedPercent', () => {
      const usage = withUsage({
        'gpt-4o': { dayTokenStats: { used: 1500, total: 1000 } },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.tokens.kind).toBe(ModelLimitMetricKind.Finite);
      expect(row.tokens.usedPercent).toBe(150);
      expect(row.tokens.usedLabel).toBe('1,500');
    });

    it('treats a missing token stat as unavailable, not zero', () => {
      const usage = withUsage({
        'gpt-4o': { dayCostStats: { used: 1, total: 2 ** 53 } },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.tokens.kind).toBe(ModelLimitMetricKind.Unavailable);
      expect(row.tokens.usedLabel).toBeUndefined();
    });

    it('classifies a token stat at the unlimited sentinel as unlimited', () => {
      const usage = withUsage({
        'gpt-4o': {
          dayTokenStats: { used: 10, total: 2 ** 53 },
        },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.tokens.kind).toBe(ModelLimitMetricKind.Unlimited);
    });
  });

  describe('status derivation', () => {
    const rowWithTokens = (used: number, total: number) => {
      const usage = withUsage({
        'gpt-4o': { dayTokenStats: { used, total } },
      });
      return mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      )[0];
    };

    it('is WithinLimits below 75%', () => {
      expect(rowWithTokens(70, 100).status).toBe(ModelLimitStatus.WithinLimits);
    });

    it('is RunningLow at exactly 75%', () => {
      expect(rowWithTokens(75, 100).status).toBe(ModelLimitStatus.RunningLow);
    });

    it('is LimitReached at exactly 100%', () => {
      expect(rowWithTokens(100, 100).status).toBe(
        ModelLimitStatus.LimitReached,
      );
    });

    it('is LimitReached above 100%', () => {
      expect(rowWithTokens(150, 100).status).toBe(
        ModelLimitStatus.LimitReached,
      );
    });

    it('is NoLimit when every metric is unlimited', () => {
      const usage = withUsage({
        'gpt-4o': {
          dayCostStats: { used: 1, total: 2 ** 53 },
          dayTokenStats: { used: 1, total: 2 ** 53 },
          dayRequestStats: { used: 1, total: 2 ** 53 },
        },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.status).toBe(ModelLimitStatus.NoLimit);
    });

    it('produces no row (rather than an Unavailable one) when no metric is usable at all', () => {
      // A row with no usable metric also has no evidence of usage in the selected period, so
      // the period-scoped usage filter excludes it before `ModelLimitStatus.Unavailable` would
      // ever reach the UI — see the "period-scoped usage filtering" describe block below.
      const usage = withUsage({ 'gpt-4o': {} });

      const rows = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(rows).toHaveLength(0);
    });

    it('derives status from the one finite metric among unlimited/unavailable ones', () => {
      const usage = withUsage({
        'gpt-4o': {
          dayCostStats: { used: 1, total: 2 ** 53 },
          dayTokenStats: { used: 92, total: 100 },
        },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.status).toBe(ModelLimitStatus.RunningLow);
    });
  });

  describe('period-scoped usage filtering', () => {
    it('keeps a row when only one of cost/tokens/requests has usage in the period', () => {
      const usage = withUsage({
        'gpt-4o': {
          dayCostStats: { used: 0, total: 2 ** 53 },
          dayTokenStats: { used: 250, total: 10000 },
        },
      });

      const rows = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(rows).toHaveLength(1);
    });

    it('excludes a row whose only mapped entry for the period is unavailable', () => {
      const usage = withUsage({
        'gpt-4o': {},
      });

      const rows = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.LastHour,
        'en',
        t,
      );

      expect(rows).toHaveLength(0);
    });

    it('shows the same deployment for one period and hides it for another', () => {
      const usage = withUsage({
        'gpt-4o': {
          monthTokenStats: { used: 100, total: 1000 },
          dayTokenStats: { used: 0, total: 1000 },
        },
      });

      const monthRows = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last30Days,
        'en',
        t,
      );
      const dayRows = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(monthRows).toHaveLength(1);
      expect(dayRows).toHaveLength(0);
    });

    it('does not change an included row cell classification or formatting', () => {
      const usage = withUsage({
        'gpt-4o': {
          dayCostStats: { used: 4.2, total: 2 ** 53 },
          dayTokenStats: { used: 250, total: 10000 },
        },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.cost.kind).toBe(ModelLimitMetricKind.Unlimited);
      expect(row.tokens.kind).toBe(ModelLimitMetricKind.Finite);
      expect(row.tokens.usedPercent).toBe(2.5);
    });
  });

  describe('formatting', () => {
    it('rounds accumulated model costs to cents', () => {
      const usage = withUsage({
        'gpt-4o': {
          dayCostStats: { used: 0.242753, total: 2 ** 53 },
        },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.cost.usedLabel).toBe('$0.24');
      expect(row.cost.ariaLabel).toBe('$0.24 used, unlimited');
    });

    it('never adds a currency symbol to token/request labels', () => {
      const usage = withUsage({
        'gpt-4o': {
          dayTokenStats: { used: 1234, total: 5000 },
          dayRequestStats: { used: 12, total: 50 },
        },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.tokens.usedLabel).not.toContain('$');
      expect(row.requests.usedLabel).not.toContain('$');
    });

    it('produces a full-value accessible label for a finite metric', () => {
      const usage = withUsage({
        'gpt-4o': { dayTokenStats: { used: 1000, total: 2000 } },
      });

      const [row] = mapUserUsageToModelLimits(
        usage,
        [modelItem()],
        ModelLimitsPeriod.Last24Hours,
        'en',
        t,
      );

      expect(row.tokens.ariaLabel).toBe('1,000 of 2,000, 50% used');
    });
  });
});
