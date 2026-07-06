import { describe, expect, it } from 'vitest';
import { UsageLimitState, UsageRowScope } from '../../types/usage-limit';
import {
  formatUsageAmount,
  getModelRowState,
  getUsageLimitState,
  getUsagePercentage,
} from '../usage-limit';

describe('getUsageLimitState', () => {
  it('returns Unlimited when limit is null', () => {
    expect(getUsageLimitState(500, null)).toBe(UsageLimitState.Unlimited);
  });

  it('returns Blocked when used equals limit', () => {
    expect(getUsageLimitState(120, 120)).toBe(UsageLimitState.Blocked);
  });

  it('returns Blocked when used exceeds limit', () => {
    expect(getUsageLimitState(130, 120)).toBe(UsageLimitState.Blocked);
  });

  it('returns Warning when remaining fraction is at the threshold', () => {
    expect(getUsageLimitState(90, 120, 0.25)).toBe(UsageLimitState.Warning);
  });

  it('returns Normal when remaining fraction is above the threshold', () => {
    expect(getUsageLimitState(41, 120, 0.25)).toBe(UsageLimitState.Normal);
  });

  it('uses the default warning threshold (85% used) when none is provided', () => {
    expect(getUsageLimitState(85, 100)).toBe(UsageLimitState.Warning);
    expect(getUsageLimitState(84, 100)).toBe(UsageLimitState.Normal);
  });
});

describe('getUsagePercentage', () => {
  it('returns 100 when limit is null', () => {
    expect(getUsagePercentage(50, null)).toBe(100);
  });

  it('computes the used/limit ratio as a percentage', () => {
    expect(getUsagePercentage(30, 120)).toBe(25);
  });

  it('clamps above 100 when used exceeds limit', () => {
    expect(getUsagePercentage(200, 120)).toBe(100);
  });

  it('clamps below 0 for a negative used amount', () => {
    expect(getUsagePercentage(-10, 120)).toBe(0);
  });
});

describe('formatUsageAmount', () => {
  it('formats a whole-dollar amount with two decimal places by default', () => {
    expect(formatUsageAmount(79, 'USD')).toBe('$79.00');
  });

  it('formats with zero fraction digits when requested', () => {
    expect(formatUsageAmount(79.4, 'USD', 0)).toBe('$79');
  });
});

describe('getModelRowState', () => {
  it('picks Blocked from daily over Normal on monthly (Claude Opus case)', () => {
    const result = getModelRowState({
      today: { used: 2, limit: 2 },
      thisMonth: { used: 12, limit: 30 },
    });
    expect(result).toEqual({
      state: UsageLimitState.Blocked,
      scope: UsageRowScope.Daily,
    });
  });

  it('picks Warning from monthly when daily has no cap (deepseek-flash case)', () => {
    const result = getModelRowState({
      today: { used: 0.4, limit: null },
      thisMonth: { used: 17, limit: 20 },
    });
    expect(result).toEqual({
      state: UsageLimitState.Warning,
      scope: UsageRowScope.Monthly,
    });
  });

  it('picks Normal from monthly when daily has no cap (GLM case)', () => {
    const result = getModelRowState({
      today: { used: 0.5, limit: null },
      thisMonth: { used: 6.2, limit: 40 },
    });
    expect(result).toEqual({
      state: UsageLimitState.Normal,
      scope: UsageRowScope.Monthly,
    });
  });

  it('resolves to Unlimited with no scope when neither period has a cap', () => {
    const result = getModelRowState({
      today: { used: 0.2, limit: null },
      thisMonth: { used: 4.1, limit: null },
    });
    expect(result).toEqual({ state: UsageLimitState.Unlimited, scope: null });
  });

  it('prefers daily on a tie between equal non-unlimited states', () => {
    const result = getModelRowState({
      today: { used: 50, limit: 100 },
      thisMonth: { used: 500, limit: 1000 },
    });
    expect(result).toEqual({
      state: UsageLimitState.Normal,
      scope: UsageRowScope.Daily,
    });
  });

  it('picks Blocked when both scopes are capped and blocked', () => {
    const result = getModelRowState({
      today: { used: 10, limit: 10 },
      thisMonth: { used: 200, limit: 200 },
    });
    expect(result.state).toBe(UsageLimitState.Blocked);
  });
});
