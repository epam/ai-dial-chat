import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  SpendingLimitsMode,
  omitAccountCostStats,
  parseSpendingLimitsMode,
  resolveSpendingLimitsMode,
  withholdAccountCostInEnforce,
} from '../spending-limits-mode';

const budget = {
  costObject: 'ORG',
  policy: 'org-wide',
  day: { total: 10, used: 1 },
  month: { total: 100, used: 20 },
};

const usage: UserLimitStatsResponseDto = {
  deployments: {
    'gpt-4o': {
      monthTokenStats: { total: 1000, used: 990 },
      monthCostStats: { total: 2 ** 63, used: 3 },
    },
  },
  minuteCostStats: { total: 2 ** 63, used: 0 },
  dayCostStats: { total: 10, used: 9.5 },
  weekCostStats: { total: 50, used: 12 },
  monthCostStats: { total: 100, used: 95 },
  costObject: 'ORG',
  budgets: [budget],
};

describe('parseSpendingLimitsMode', () => {
  it.each([
    ['off', SpendingLimitsMode.Off],
    ['shadow', SpendingLimitsMode.Shadow],
    ['enforce', SpendingLimitsMode.Enforce],
  ])('parses %s', (value, expected) => {
    expect(parseSpendingLimitsMode(value)).toBe(expected);
  });

  it.each(['ENFORCE', 'on', '', null, undefined, 1])(
    'falls back to off for %j',
    (value) => {
      expect(parseSpendingLimitsMode(value)).toBe(SpendingLimitsMode.Off);
    },
  );
});

describe('resolveSpendingLimitsMode', () => {
  it('returns the configured mode when Core reports budgets and a cost object', () => {
    expect(resolveSpendingLimitsMode(SpendingLimitsMode.Enforce, usage)).toBe(
      SpendingLimitsMode.Enforce,
    );
    expect(resolveSpendingLimitsMode(SpendingLimitsMode.Shadow, usage)).toBe(
      SpendingLimitsMode.Shadow,
    );
  });

  it('returns off when Core reports no cost object (spending limits off)', () => {
    expect(
      resolveSpendingLimitsMode(SpendingLimitsMode.Enforce, { budgets: [] }),
    ).toBe(SpendingLimitsMode.Off);
  });

  it('returns off when Core reports a blank cost object', () => {
    expect(
      resolveSpendingLimitsMode(SpendingLimitsMode.Enforce, {
        budgets: [budget],
        costObject: '  ',
      }),
    ).toBe(SpendingLimitsMode.Off);
  });

  it('returns off for an older Core without budgets', () => {
    expect(
      resolveSpendingLimitsMode(SpendingLimitsMode.Shadow, {
        costObject: 'ORG',
      }),
    ).toBe(SpendingLimitsMode.Off);
  });

  it('returns off when configured off, whatever Core reports', () => {
    expect(resolveSpendingLimitsMode(SpendingLimitsMode.Off, usage)).toBe(
      SpendingLimitsMode.Off,
    );
  });

  it('returns off while usage is not loaded', () => {
    expect(
      resolveSpendingLimitsMode(SpendingLimitsMode.Enforce, undefined),
    ).toBe(SpendingLimitsMode.Off);
  });
});

describe('omitAccountCostStats', () => {
  it('drops the four role cost stats and keeps every other field', () => {
    const result = omitAccountCostStats(usage);

    expect(result).not.toHaveProperty('minuteCostStats');
    expect(result).not.toHaveProperty('dayCostStats');
    expect(result).not.toHaveProperty('weekCostStats');
    expect(result).not.toHaveProperty('monthCostStats');
    expect(result).toEqual({
      deployments: usage.deployments,
      costObject: 'ORG',
      budgets: [budget],
    });
  });

  it('leaves its input unchanged', () => {
    const input = { ...usage };

    omitAccountCostStats(input);

    expect(input).toEqual(usage);
  });
});

describe('withholdAccountCostInEnforce', () => {
  it('withholds the role cost stats in an effective enforce mode', () => {
    const result = withholdAccountCostInEnforce(
      usage,
      SpendingLimitsMode.Enforce,
    );

    expect(result).not.toHaveProperty('monthCostStats');
    expect(result?.deployments).toBe(usage.deployments);
  });

  it.each([SpendingLimitsMode.Off, SpendingLimitsMode.Shadow])(
    'returns the same object in %s',
    (mode) => {
      expect(withholdAccountCostInEnforce(usage, mode)).toBe(usage);
    },
  );

  it('returns the same object when enforce is configured but Core has spending limits off', () => {
    const legacy = { ...usage, costObject: undefined, budgets: [] };

    expect(
      withholdAccountCostInEnforce(legacy, SpendingLimitsMode.Enforce),
    ).toBe(legacy);
  });

  it('returns undefined for undefined usage', () => {
    expect(
      withholdAccountCostInEnforce(undefined, SpendingLimitsMode.Enforce),
    ).toBeUndefined();
  });
});
