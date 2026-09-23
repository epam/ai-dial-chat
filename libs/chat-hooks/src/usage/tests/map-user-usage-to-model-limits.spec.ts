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
import { describe, expect, it, vi } from 'vitest';
import type { FormatResetTime } from '../map-user-usage-to-model-limits';
import {
  USAGE_MODEL_LIMITS_I18N_KEYS,
  mapOverallCostLimitsToPeriodStatuses,
  mapUserUsageToModelLimits,
} from '../map-user-usage-to-model-limits';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const t: Translate = (key, params) => {
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.unlimitedProgressAriaLabel) {
    return `${params?.used} used, unlimited`;
  }
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.progressAriaLabel) {
    return `${params?.used} of ${params?.total}, ${params?.percent}% used`;
  }
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.unavailableLabel)
    return 'Not available';
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.noLimitLabel) return 'No limit';
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.followsCostLimitLabel)
    return 'Follows cost limit';
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.followsCostLimitAriaLabel) {
    return `${params?.used} used. Follows cost limit.`;
  }
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.spentLabel)
    return `${params?.amount} spent`;
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.todayPeriodDescription)
    return 'Today';
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.thisWeekPeriodDescription)
    return 'This week';
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.thisMonthPeriodDescription)
    return 'This month';
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.overallCostLimitRunningLowTooltip) {
    return `Overall cost limit for ${params?.period} is running low.`;
  }
  if (key === USAGE_MODEL_LIMITS_I18N_KEYS.overallCostLimitReachedTooltip) {
    return `Overall cost limit for ${params?.period} is reached. Models can't be used until the period resets, regardless of remaining token limits.`;
  }
  return key;
};

const defaultResolveIconUrl = (iconUrl: string | undefined) => iconUrl;
const defaultResolveDisplayName = (
  name: string | Record<string, string> | undefined | null,
  _locale: string,
): string => {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return Object.values(name)[0] ?? '';
};

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
  overrides: Partial<UserLimitStatsResponseDto> = {},
): UserLimitStatsResponseDto => ({ deployments, ...overrides });

/*
 * Reset values and top-level cost figures reproduced from the real
 * GET /api/v1/user/usage capture in
 * openspec/changes/migrate-usage-reset-times/fixtures/.
 */
const DAY_RESETS_AT = '2026-09-16T00:00:00Z';
const WEEK_RESETS_AT = '2026-09-21T00:00:00Z';
const MONTH_RESETS_AT = '2026-10-01T00:00:00Z';
const UNLIMITED_SENTINEL = 9223372036854776000;

const CAPTURED_TOP_LEVEL = {
  dayCostStats: { total: 110, used: 0.42641085, resetsAt: DAY_RESETS_AT },
  weekCostStats: {
    total: UNLIMITED_SENTINEL,
    used: 1.7928459,
    resetsAt: WEEK_RESETS_AT,
  },
  monthCostStats: { total: 500, used: 2.3991724, resetsAt: MONTH_RESETS_AT },
};

/* Echoes the input so each header's trio is traceable to its own stat. */
const formatReset: FormatResetTime = (resetsAt) =>
  resetsAt == null
    ? undefined
    : {
        resetsAtMs: Date.parse(resetsAt),
        isoValue: resetsAt,
        label: `Resets ${resetsAt}`,
        ariaLabel: `Usage resets ${resetsAt}`,
      };

const mapUsage = (
  usage: UserLimitStatsResponseDto | undefined,
  items: DeploymentItemDto[] = [modelItem()],
  overrides?: {
    resolveIconUrl?: (iconUrl: string | undefined) => string | undefined;
    resolveDisplayName?: (
      name: string | Record<string, string> | undefined | null,
      locale: string,
    ) => string;
  },
) =>
  mapUserUsageToModelLimits(
    usage,
    items,
    'en',
    t,
    overrides?.resolveIconUrl ?? defaultResolveIconUrl,
    overrides?.resolveDisplayName ?? defaultResolveDisplayName,
  );

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

  it('returns an empty array when usage is absent', () => {
    expect(mapUsage(undefined)).toEqual([]);
  });

  it('returns an empty array when deployments is empty', () => {
    expect(mapUsage(withUsage({}))).toEqual([]);
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
    expect(rows[0].month.tokens.usedLabel).toBe('25');
  });

  it('keeps cost-only usage while leaving token Status unavailable', () => {
    const [row] = mapUsage(
      withUsage({
        'gpt-4o': {
          weekCostStats: { used: 1.25, total: 2 ** 53 },
        },
      }),
    );

    expect(row.week.cost.usedLabel).toBe('$1.25 spent');
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

  it('falls back to the deployment ID and no avatar when metadata is missing', () => {
    const [row] = mapUsage(
      withUsage({
        'unknown-model': { dayTokenStats: { used: 1, total: 10 } },
      }),
      [],
    );

    expect(row.name).toBe('unknown-model');
    expect(row.avatarSrc).toBeUndefined();
  });

  it('falls back to item.id when a matched item resolves an empty display name', () => {
    const [row] = mapUsage(
      withUsage({ 'gpt-4o': { dayTokenStats: { used: 1, total: 10 } } }),
      [modelItem({ id: 'gpt-4o', displayName: '' })],
      { resolveDisplayName: () => '' },
    );

    expect(row.name).toBe('gpt-4o');
  });

  it('lets a later deployment item with the same ID win enrichment', () => {
    const [row] = mapUsage(
      withUsage({ 'gpt-4o': { dayTokenStats: { used: 1, total: 10 } } }),
      [
        modelItem({ id: 'gpt-4o', displayName: 'First' }),
        modelItem({ id: 'gpt-4o', displayName: 'Second' }),
      ],
    );

    expect(row.name).toBe('Second');
  });

  it('calls resolveIconUrl and forwards its result to avatarSrc', () => {
    const resolveIconUrl = vi
      .fn()
      .mockImplementation((iconUrl: string | undefined) =>
        iconUrl ? `resolved:${iconUrl}` : undefined,
      );
    const [row] = mapUsage(
      withUsage({ 'gpt-4o': { dayTokenStats: { used: 1, total: 10 } } }),
      [modelItem({ iconUrl: 'model-icon.svg' })],
      { resolveIconUrl },
    );

    expect(resolveIconUrl).toHaveBeenCalledWith('model-icon.svg');
    expect(row.avatarSrc).toBe('resolved:model-icon.svg');
  });

  it('does not enrich a model row from a non-model deployment item', () => {
    const [row] = mapUsage(
      withUsage({ shared_id: { dayTokenStats: { used: 1, total: 10 } } }),
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

  it('never adds a deployment absent from usage.deployments', () => {
    const rows = mapUsage(
      withUsage({ used: { dayTokenStats: { used: 1, total: 10 } } }),
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

      expect(row.day.tokens.usedLabel).toBe('100');
      expect(row.day.tokens.totalLabel).toBe('1K');
      expect(row.day.cost.usedLabel).toBe('$1 spent');
    });

    it('maps week Cost and Tokens to Last 7 days', () => {
      const [row] = mapUsage(usage);

      expect(row.week.tokens.usedLabel).toBe('200');
      expect(row.week.tokens.totalLabel).toBe('2K');
      expect(row.week.cost.usedLabel).toBe('$2 spent');
    });

    it('maps month Cost and Tokens to Last 30 days', () => {
      const [row] = mapUsage(usage);

      expect(row.month.tokens.usedLabel).toBe('300');
      expect(row.month.tokens.totalLabel).toBe('3K');
      expect(row.month.cost.usedLabel).toBe('$3 spent');
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

      expect(row.week.tokens.kind).toBe(ModelLimitMetricKind.Unavailable);
      expect(row.day.tokens.usedLabel).toBe('10');
      expect(row.month.tokens.usedLabel).toBe('30');
    });
  });

  describe('metric classification and formatting', () => {
    it('classifies well-formed cost as unlimited attributed spend', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': { dayCostStats: { used: 0.242753, total: 2 ** 53 } },
        }),
      );

      expect(row.day.cost.kind).toBe(ModelLimitMetricKind.Unlimited);
      expect(row.day.cost.usedLabel).toBe('$0.24 spent');
      expect(row.day.cost.ariaLabel).toBe('$0.24 spent');
    });

    it('classifies missing cost as unavailable', () => {
      const [row] = mapUsage(
        withUsage({ 'gpt-4o': { dayTokenStats: { used: 1, total: 10 } } }),
      );

      expect(row.day.cost.kind).toBe(ModelLimitMetricKind.Unavailable);
    });

    it('keeps finite token percentages uncapped', () => {
      const [row] = mapUsage(
        withUsage({ 'gpt-4o': { dayTokenStats: { used: 1500, total: 1000 } } }),
      );

      expect(row.day.tokens.kind).toBe(ModelLimitMetricKind.Finite);
      expect(row.day.tokens.usedPercent).toBe(150);
      expect(row.day.tokens.status).toBe(ModelLimitStatus.LimitReached);
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

      expect(row.day.tokens.kind).toBe(ModelLimitMetricKind.Unavailable);
      expect(row.week.tokens.kind).toBe(ModelLimitMetricKind.Unlimited);
    });

    it('shows that unlimited model tokens follow the matching finite overall Cost limit', () => {
      const [row] = mapUsage(
        withUsage(
          { 'gpt-4o': { weekTokenStats: { used: 10, total: 2 ** 53 } } },
          { weekCostStats: { used: 5, total: 100 } },
        ),
      );

      expect(row.week.tokens.supportingLabel).toBe('Follows cost limit');
      expect(row.week.tokens.ariaLabel).toBe('10 used. Follows cost limit.');
    });

    it('uses compact visible token values and full accessible values', () => {
      const [row] = mapUsage(
        withUsage({ 'gpt-4o': { dayTokenStats: { used: 1000, total: 2000 } } }),
      );

      expect(row.day.tokens.usedLabel).toBe('1K');
      expect(row.day.tokens.totalLabel).toBe('2K');
      expect(row.day.tokens.ariaLabel).toBe('1,000 of 2,000, 50% used');
      expect(row.day.tokens.usedLabel).not.toContain('$');
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
          'gpt-4o': { weekTokenStats: { used: 10, total: 2 ** 53 } },
        }),
      );

      expect(row.status).toBe(ModelLimitStatus.NoLimit);
    });

    it('does not treat per-model attributed cost as a finite limit', () => {
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

    it('prefers a finite cost status over the NoLimit fallback when every token period is unlimited', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayTokenStats: { used: 10, total: 2 ** 53 },
            weekTokenStats: { used: 10, total: 2 ** 53 },
            monthTokenStats: { used: 10, total: 2 ** 53 },
            dayCostStats: { used: 9, total: 10 },
          },
        }),
      );

      expect(row.day.tokens.kind).toBe(ModelLimitMetricKind.Unlimited);
      expect(row.day.cost.status).toBe(ModelLimitStatus.RunningLow);
      expect(row.status).toBe(ModelLimitStatus.RunningLow);
    });

    it('applies the worst overall Cost status to every model row', () => {
      const [row] = mapUsage(
        withUsage(
          {
            'gpt-4o': {
              dayTokenStats: { used: 10, total: 100 },
              weekTokenStats: { used: 20, total: 100 },
            },
          },
          {
            dayCostStats: { used: 75, total: 100 },
            weekCostStats: { used: 100, total: 100 },
          },
        ),
      );

      expect(row.status).toBe(ModelLimitStatus.LimitReached);
    });
  });

  describe('overall Cost period statuses', () => {
    it('maps top-level Cost limits to period-aware header tooltips', () => {
      const statuses = mapOverallCostLimitsToPeriodStatuses(
        withUsage(
          {},
          {
            dayCostStats: { used: 100, total: 100 },
            weekCostStats: { used: 80, total: 100 },
            monthCostStats: { used: 20, total: 100 },
          },
        ),
        'en',
        t,
      );

      expect(statuses.day).toEqual({
        status: ModelLimitStatus.LimitReached,
        tooltipLabel:
          "Overall cost limit for today is reached. Models can't be used until the period resets, regardless of remaining token limits.",
      });
      expect(statuses.week).toEqual({
        status: ModelLimitStatus.RunningLow,
        tooltipLabel: 'Overall cost limit for this week is running low.',
      });
      expect(statuses.month).toEqual({
        status: ModelLimitStatus.WithinLimits,
        tooltipLabel: undefined,
      });
    });

    it('keys the statuses day/week/month', () => {
      const statuses = mapOverallCostLimitsToPeriodStatuses(
        withUsage({}, CAPTURED_TOP_LEVEL),
        'en',
        t,
        formatReset,
      );

      expect(Object.keys(statuses)).toEqual(['day', 'week', 'month']);
    });

    it('sources each header reset trio from its own top-level stat', () => {
      const statuses = mapOverallCostLimitsToPeriodStatuses(
        withUsage({}, CAPTURED_TOP_LEVEL),
        'en',
        t,
        formatReset,
      );

      expect(statuses.day.resetIsoValue).toBe(DAY_RESETS_AT);
      expect(statuses.day.resetLabel).toBe(`Resets ${DAY_RESETS_AT}`);
      expect(statuses.day.resetAriaLabel).toBe(`Usage resets ${DAY_RESETS_AT}`);
      expect(statuses.week.resetIsoValue).toBe(WEEK_RESETS_AT);
      expect(statuses.month.resetIsoValue).toBe(MONTH_RESETS_AT);
    });

    it('ignores a differing per-deployment resetsAt for the header', () => {
      const statuses = mapOverallCostLimitsToPeriodStatuses(
        withUsage(
          {
            'gpt-4o': {
              dayCostStats: {
                used: 0.0048335,
                total: UNLIMITED_SENTINEL,
                resetsAt: '2027-01-01T00:00:00Z',
              },
            },
          },
          CAPTURED_TOP_LEVEL,
        ),
        'en',
        t,
        formatReset,
      );

      expect(statuses.day.resetIsoValue).toBe(DAY_RESETS_AT);
      expect(statuses.day.resetIsoValue).not.toBe('2027-01-01T00:00:00Z');
    });

    it('omits the reset trio when no formatter is supplied', () => {
      const statuses = mapOverallCostLimitsToPeriodStatuses(
        withUsage({}, CAPTURED_TOP_LEVEL),
        'en',
        t,
      );

      expect(statuses.day).not.toHaveProperty('resetLabel');
      expect(statuses.day).not.toHaveProperty('resetIsoValue');
      expect(statuses.day).not.toHaveProperty('resetAriaLabel');
    });
  });

  describe('per-deployment Cost sentinel detection', () => {
    it('keeps a sentinel cost cell Unlimited with the spent label', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayCostStats: { used: 0.24, total: UNLIMITED_SENTINEL },
          },
        }),
      );

      expect(row.day.cost.kind).toBe(ModelLimitMetricKind.Unlimited);
      expect(row.day.cost.usedLabel).toBe('$0.24 spent');
      expect(row.day.cost.ariaLabel).toBe('$0.24 spent');
      expect(row.day.cost).not.toHaveProperty('usedPercent');
      expect(row.day.cost).not.toHaveProperty('totalLabel');
    });

    it('produces a Finite cell for a genuinely finite cost total', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': { dayCostStats: { used: 8, total: 10 } },
        }),
      );

      expect(row.day.cost.kind).toBe(ModelLimitMetricKind.Finite);
      expect(row.day.cost.usedPercent).toBe(80);
      expect(row.day.cost.status).toBe(ModelLimitStatus.RunningLow);
      expect(row.day.cost.usedLabel).toBe('$8 spent');
      expect(row.day.cost.totalLabel).toBe('$10');
      expect(row.day.cost.ariaLabel).toBe('$8 of $10, 80% used');
    });

    it('folds a finite cost status into the row status', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayTokenStats: { used: 10, total: 1000 },
            dayCostStats: { used: 10, total: 10 },
          },
        }),
      );

      expect(row.day.tokens.status).toBe(ModelLimitStatus.WithinLimits);
      expect(row.day.cost.status).toBe(ModelLimitStatus.LimitReached);
      expect(row.status).toBe(ModelLimitStatus.LimitReached);
    });

    it('keeps sentinel cost cells from promoting an all-unavailable row', () => {
      const [row] = mapUsage(
        withUsage({
          'gpt-4o': {
            dayCostStats: { used: 0.24, total: UNLIMITED_SENTINEL },
          },
        }),
      );

      expect(row.day.tokens.kind).toBe(ModelLimitMetricKind.Unavailable);
      expect(row.status).toBe(ModelLimitStatus.Unavailable);
    });
  });
});
