import type {
  DeploymentItemDto,
  DeploymentLimitsResponseDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { DeploymentItemDtoTypeEnum } from '@epam/ai-dial-chat-api-client';
import {
  ModelLimitMetricKind,
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

const mapUsage = (
  usage: UserLimitStatsResponseDto | undefined,
  items: DeploymentItemDto[] = [modelItem()],
) => mapUserUsageToModelLimits(usage, items, 'en', t);

describe('mapUserUsageToModelLimits', () => {
  it('returns one row per deployment with usage in a displayed period', () => {
    const rows = mapUsage(
      withUsage({
        'gpt-4o': { dayTokenStats: { used: 100, total: 1000 } },
        'claude-3': { monthTokenStats: { used: 50, total: 500 } },
      }),
      [
        modelItem({ id: 'gpt-4o' }),
        modelItem({ id: 'claude-3', displayName: 'Claude 3' }),
      ],
    );

    expect(rows.map((row) => row.name)).toEqual(['GPT-4o', 'Claude 3']);
  });

  it('returns an empty array when usage or deployments is absent', () => {
    expect(mapUsage(undefined)).toEqual([]);
    expect(mapUsage({})).toEqual([]);
  });

  it('excludes a deployment with no non-zero usage across displayed periods', () => {
    const rows = mapUsage(
      withUsage({
        'gpt-4o': {
          dayCostStats: { used: 0, total: 2 ** 53 },
          weekTokenStats: { used: 0, total: 1000 },
          monthTokenStats: { used: Number.NaN, total: 1000 },
        },
      }),
    );

    expect(rows).toEqual([]);
  });

  it('keeps a deployment used in only one displayed period', () => {
    const rows = mapUsage(
      withUsage({
        'gpt-4o': {
          dayTokenStats: { used: 0, total: 1000 },
          monthTokenStats: { used: 25, total: 1000 },
        },
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].last30Days.tokens.usedLabel).toBe('25');
  });

  it('keeps cost-only usage while leaving token Status unavailable', () => {
    const [row] = mapUsage(
      withUsage({
        'gpt-4o': {
          weekCostStats: { used: 1.25, total: 2 ** 53 },
        },
      }),
    );

    expect(row.last7Days.cost.usedLabel).toBe('$1.25');
    expect(row.status).toBe(ModelLimitStatus.Unavailable);
  });

  it('ignores minute, hour, and request usage for row inclusion', () => {
    const rows = mapUsage(
      withUsage({
        'gpt-4o': {
          minuteCostStats: { used: 1, total: 2 ** 53 },
          minuteTokenStats: { used: 10, total: 100 },
          hourRequestStats: { used: 3, total: 10 },
          dayRequestStats: { used: 5, total: 20 },
        },
      }),
    );

    expect(rows).toEqual([]);
  });

  it('falls back to the deployment ID and initials avatar data when metadata is missing', () => {
    const [row] = mapUsage(
      withUsage({
        'unknown-model': { dayTokenStats: { used: 1, total: 10 } },
      }),
      [],
    );

    expect(row.name).toBe('unknown-model');
    expect(row.avatarSrc).toBeUndefined();
  });

  it('resolves a model icon URL before passing it to the dashboard row', () => {
    const [row] = mapUsage(
      withUsage({
        'gpt-4o': { dayTokenStats: { used: 1, total: 10 } },
      }),
      [modelItem({ iconUrl: 'model icon.svg' })],
    );

    expect(row.avatarSrc).toBe('/api/themes/icon?iconName=model%20icon.svg');
  });

  it('does not enrich a model row from a non-model deployment item', () => {
    const [row] = mapUsage(
      withUsage({
        shared_id: { dayTokenStats: { used: 1, total: 10 } },
      }),
      [
        modelItem({
          id: 'shared_id',
          type: DeploymentItemDtoTypeEnum.Application,
          displayName: 'Some App',
        }),
      ],
    );

    expect(row.name).toBe('shared_id');
  });

  it('preserves usage.deployments key order independently of metadata order', () => {
    const rows = mapUsage(
      withUsage({
        a: { dayTokenStats: { used: 1, total: 10 } },
        b: { dayTokenStats: { used: 1, total: 10 } },
      }),
      [
        modelItem({ id: 'b', displayName: 'B' }),
        modelItem({ id: 'a', displayName: 'A' }),
      ],
    );

    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('never adds an accessible model absent from usage.deployments', () => {
    const rows = mapUsage(
      withUsage({
        used: { dayTokenStats: { used: 1, total: 10 } },
      }),
      [modelItem({ id: 'used' }), modelItem({ id: 'never-used' })],
    );

    expect(rows.map((row) => row.id)).toEqual(['used']);
  });

  describe('fixed period mapping', () => {
    const usage = withUsage({
      'gpt-4o': {
        minuteCostStats: { used: 99, total: 2 ** 53 },
        dayCostStats: { used: 1, total: 2 ** 53 },
        weekCostStats: { used: 2, total: 2 ** 53 },
        monthCostStats: { used: 3, total: 2 ** 53 },
        minuteTokenStats: { used: 99, total: 100 },
        dayTokenStats: { used: 100, total: 1000 },
        weekTokenStats: { used: 200, total: 2000 },
        monthTokenStats: { used: 300, total: 3000 },
        hourRequestStats: { used: 99, total: 100 },
        dayRequestStats: { used: 99, total: 100 },
      },
    });

    it('maps day Cost and Tokens to Last 24 hours', () => {
      const [row] = mapUsage(usage);

      expect(row.last24Hours.tokens.usedLabel).toBe('100');
      expect(row.last24Hours.tokens.totalLabel).toBe('1K');
      expect(row.last24Hours.cost.usedLabel).toBe('$1');
    });

    it('maps week Cost and Tokens to Last 7 days', () => {
      const [row] = mapUsage(usage);

      expect(row.last7Days.tokens.usedLabel).toBe('200');
      expect(row.last7Days.tokens.totalLabel).toBe('2K');
      expect(row.last7Days.cost.usedLabel).toBe('$2');
    });

    it('maps month Cost and Tokens to Last 30 days', () => {
      const [row] = mapUsage(usage);

      expect(row.last30Days.tokens.usedLabel).toBe('300');
      expect(row.last30Days.tokens.totalLabel).toBe('3K');
      expect(row.last30Days.cost.usedLabel).toBe('$3');
    });

    it('does not substitute a missing period value', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayTokenStats: { used: 10, total: 100 },
            monthTokenStats: { used: 30, total: 300 },
          },
        }),
      );

      expect(row.last7Days.tokens.kind).toBe(ModelLimitMetricKind.Unavailable);
      expect(row.last24Hours.tokens.usedLabel).toBe('10');
      expect(row.last30Days.tokens.usedLabel).toBe('30');
    });
  });

  describe('metric classification and formatting', () => {
    it('classifies well-formed cost as unlimited attributed spend', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayCostStats: { used: 0.242753, total: 2 ** 53 },
          },
        }),
      );

      expect(row.last24Hours.cost.kind).toBe(ModelLimitMetricKind.Unlimited);
      expect(row.last24Hours.cost.usedLabel).toBe('$0.24');
      expect(row.last24Hours.cost.ariaLabel).toBe('$0.24');
    });

    it('classifies missing cost as unavailable', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': { dayTokenStats: { used: 1, total: 10 } },
        }),
      );

      expect(row.last24Hours.cost.kind).toBe(ModelLimitMetricKind.Unavailable);
    });

    it('keeps finite token percentages uncapped', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': { dayTokenStats: { used: 1500, total: 1000 } },
        }),
      );

      expect(row.last24Hours.tokens.kind).toBe(ModelLimitMetricKind.Finite);
      expect(row.last24Hours.tokens.usedPercent).toBe(150);
      expect(row.last24Hours.tokens.status).toBe(ModelLimitStatus.LimitReached);
    });

    it('classifies unlimited and unavailable token periods distinctly', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayCostStats: { used: 1, total: 2 ** 53 },
            weekTokenStats: { used: 10, total: 2 ** 53 },
          },
        }),
      );

      expect(row.last24Hours.tokens.kind).toBe(
        ModelLimitMetricKind.Unavailable,
      );
      expect(row.last7Days.tokens.kind).toBe(ModelLimitMetricKind.Unlimited);
    });

    it('uses compact visible token values and full accessible values', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': { dayTokenStats: { used: 1000, total: 2000 } },
        }),
      );

      expect(row.last24Hours.tokens.usedLabel).toBe('1K');
      expect(row.last24Hours.tokens.totalLabel).toBe('2K');
      expect(row.last24Hours.tokens.ariaLabel).toBe('1,000 of 2,000, 50% used');
      expect(row.last24Hours.tokens.usedLabel).not.toContain('$');
    });
  });

  describe('cross-period status derivation', () => {
    it('uses LimitReached from any displayed token period', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayTokenStats: { used: 100, total: 100 },
            weekTokenStats: { used: 80, total: 100 },
            monthTokenStats: { used: 20, total: 100 },
          },
        }),
      );

      expect(row.status).toBe(ModelLimitStatus.LimitReached);
    });

    it('uses RunningLow when no period has reached its limit', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayTokenStats: { used: 10, total: 100 },
            weekTokenStats: { used: 75, total: 100 },
            monthTokenStats: { used: 20, total: 100 },
          },
        }),
      );

      expect(row.status).toBe(ModelLimitStatus.RunningLow);
    });

    it('uses WithinLimits when every finite period is healthy', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayTokenStats: { used: 10, total: 100 },
            monthTokenStats: { used: 10, total: 2 ** 53 },
          },
        }),
      );

      expect(row.status).toBe(ModelLimitStatus.WithinLimits);
    });

    it('uses NoLimit only when no finite token period exists', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            weekTokenStats: { used: 10, total: 2 ** 53 },
          },
        }),
      );

      expect(row.status).toBe(ModelLimitStatus.NoLimit);
    });

    it('does not let cost affect token Status', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayCostStats: { used: 1, total: 2 ** 53 },
            weekCostStats: { used: 2, total: 2 ** 53 },
            monthCostStats: { used: 3, total: 2 ** 53 },
          },
        }),
      );

      expect(row.status).toBe(ModelLimitStatus.Unavailable);
    });
  });
});
