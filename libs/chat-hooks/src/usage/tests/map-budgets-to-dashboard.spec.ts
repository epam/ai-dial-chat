import type {
  BudgetStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import { UsageLimitStatus } from '@epam/ai-dial-usage-dashboard';
import { describe, expect, it, vi } from 'vitest';
import type { FormatResetTime } from '../map-usage-data-to-dashboard';
import {
  BUDGET_DATA_I18N_KEYS,
  USAGE_DATA_I18N_KEYS,
  mapBudgetsToDashboard,
} from '../map-usage-data-to-dashboard';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const t: Translate = (key, params) => {
  switch (key) {
    case USAGE_DATA_I18N_KEYS.todayTitle:
      return 'Today';
    case USAGE_DATA_I18N_KEYS.thisMonthTitle:
      return 'This month';
    case BUDGET_DATA_I18N_KEYS.allModels:
      return 'All models';
    case BUDGET_DATA_I18N_KEYS.coveredModels:
      return `Models: ${params?.models}`;
    default:
      return key;
  }
};

const noReset: FormatResetTime = () => undefined;
const names: Record<string, string> = { 'gpt-4o': 'GPT-4o' };
const resolveModelName = (id: string) => names[id];

const budget = (overrides: Partial<BudgetStatsDto> = {}): BudgetStatsDto => ({
  costObject: 'ORG',
  policy: 'org-wide',
  day: { total: 10, used: 1, resetsAt: '2026-11-18T00:00:00Z' },
  month: { total: 200, used: 20, resetsAt: '2026-12-01T00:00:00Z' },
  ...overrides,
});

const usageWith = (
  budgets: BudgetStatsDto[],
  costObject: string | undefined = 'ORG',
): Pick<UserLimitStatsResponseDto, 'budgets' | 'costObject'> => ({
  budgets,
  ...(costObject == null ? {} : { costObject }),
});

const map = (
  usage: Pick<UserLimitStatsResponseDto, 'budgets' | 'costObject'> | undefined,
) => mapBudgetsToDashboard(usage, t, noReset, resolveModelName);

describe('mapBudgetsToDashboard', () => {
  it('lists only the budgets of the charged cost object, in response order', () => {
    const result = map(
      usageWith([
        budget({ policy: 'first' }),
        budget({ policy: 'other', costObject: 'project-a' }),
        budget({ policy: 'second' }),
      ]),
    );

    expect(result.map((entry) => entry.title)).toEqual(['first', 'second']);
  });

  it('keeps a distinct stable id for a policy listed twice', () => {
    const usage = usageWith([budget(), budget()]);

    const first = map(usage).map((entry) => entry.id);
    const second = map(usage).map((entry) => entry.id);

    expect(new Set(first).size).toBe(2);
    expect(second).toEqual(first);
  });

  it('returns an empty list without a cost object', () => {
    expect(map({ budgets: [budget()] })).toEqual([]);
  });

  it('returns an empty list without budgets or usage', () => {
    expect(map({ costObject: 'ORG' })).toEqual([]);
    expect(map(undefined)).toEqual([]);
  });

  it('titles a budget with its display name', () => {
    const [entry] = map(
      usageWith([budget({ displayName: 'Organization-wide' })]),
    );

    expect(entry.title).toBe('Organization-wide');
  });

  it('falls back to the policy for a blank display name', () => {
    const [entry] = map(
      usageWith([budget({ displayName: '  ', policy: 'policies/team' })]),
    );

    expect(entry.title).toBe('policies/team');
  });

  it('builds a Today card and a This month card, in that order', () => {
    const [entry] = map(usageWith([budget()]));

    expect(entry.cards.map((card) => card.title)).toEqual([
      'Today',
      'This month',
    ]);
  });

  it('renders an unlimited day window as spend only', () => {
    const [entry] = map(
      usageWith([
        budget({
          day: { total: 2 ** 63, used: 1.5 },
          month: { total: 200, used: 50 },
        }),
      ]),
    );

    expect(entry.cards[0]).toMatchObject({
      isUnlimited: true,
      status: UsageLimitStatus.Default,
    });
    expect(entry.cards[0]).not.toHaveProperty('totalLabel');
    expect(entry.cards[1]).toMatchObject({
      total: 200,
      totalLabel: formatCost(200),
      usedPercent: 25,
      status: UsageLimitStatus.Default,
    });
    expect(entry.cards[1].remainingLabel).toBeDefined();
  });

  it('keeps an over-budget percent unclamped', () => {
    const [entry] = map(
      usageWith([budget({ month: { total: 200, used: 210 } })]),
    );

    expect(entry.cards[1]).toMatchObject({
      usedPercent: 105,
      status: UsageLimitStatus.LimitReached,
    });
  });

  it('reads a budget that covers every model as All models', () => {
    const [entry] = map(usageWith([budget({ object: '*' })]));

    expect(entry.coverageLabel).toBe('All models');
  });

  it('lists covered models by display name and an unknown id as is', () => {
    const [entry] = map(
      usageWith([budget({ object: ['gpt-4o', 'unknown-model'] })]),
    );

    expect(entry.coverageLabel).toBe('Models: GPT-4o, unknown-model');
  });

  it('omits the coverage line when the budget reports no object', () => {
    const [entry] = map(usageWith([budget()]));

    expect(entry).not.toHaveProperty('coverageLabel');
  });

  it('passes each window reset time through the host formatter', () => {
    const formatResetTime = vi.fn<FormatResetTime>((resetsAt) =>
      resetsAt == null
        ? undefined
        : {
            resetsAtMs: Date.parse(resetsAt),
            label: `resets ${resetsAt}`,
            isoValue: resetsAt,
            ariaLabel: 'a',
          },
    );

    const [entry] = mapBudgetsToDashboard(
      usageWith([budget()]),
      t,
      formatResetTime,
      resolveModelName,
    );

    expect(formatResetTime).toHaveBeenCalledWith('2026-11-18T00:00:00Z');
    expect(entry.cards[0].resetIsoValue).toBe('2026-11-18T00:00:00Z');
    expect(entry.cards[1].resetIsoValue).toBe('2026-12-01T00:00:00Z');
  });

  it('returns deep-equal results for the same arguments', () => {
    const usage = usageWith([budget({ object: '*' })]);

    expect(map(usage)).toEqual(map(usage));
  });
});
