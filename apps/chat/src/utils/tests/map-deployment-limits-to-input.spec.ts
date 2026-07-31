import type { DeploymentLimitsResponseDto } from '@epam/chat-api-client';
import { describe, expect, it } from 'vitest';
import { mapDeploymentLimitsToInput } from '../map-deployment-limits-to-input';

describe('mapDeploymentLimitsToInput', () => {
  it('returns undefined when monthly stats are absent', () => {
    expect(mapDeploymentLimitsToInput(undefined)).toBeUndefined();
    expect(mapDeploymentLimitsToInput({})).toBeUndefined();
  });

  it('ignores other token windows when monthly stats are absent', () => {
    const dto: DeploymentLimitsResponseDto = {
      minuteTokenStats: { used: 10, total: 100 },
      dayTokenStats: { used: 20, total: 100 },
      weekTokenStats: { used: 30, total: 100 },
    };

    expect(mapDeploymentLimitsToInput(dto)).toBeUndefined();
  });

  it('normalizes a finite monthly limit', () => {
    const dto: DeploymentLimitsResponseDto = {
      monthTokenStats: { used: 2500, total: 10000 },
    };

    expect(mapDeploymentLimitsToInput(dto)).toEqual({
      used: 2500,
      total: 10000,
      remaining: 7500,
      usedPercent: 25,
      isUnlimited: false,
    });
  });

  it.each([
    { used: 1, total: 0 },
    { used: 1, total: -1 },
    { used: Number.NaN, total: 100 },
    { used: Number.POSITIVE_INFINITY, total: 100 },
    { used: 1, total: Number.NaN },
    { used: 1, total: Number.POSITIVE_INFINITY },
  ])('omits invalid monthly stats: %o', (monthTokenStats) => {
    expect(mapDeploymentLimitsToInput({ monthTokenStats })).toBeUndefined();
  });

  it('normalizes negative used tokens to zero', () => {
    expect(
      mapDeploymentLimitsToInput({
        monthTokenStats: { used: -100, total: 1000 },
      }),
    ).toEqual({
      used: 0,
      total: 1000,
      remaining: 1000,
      usedPercent: 0,
      isUnlimited: false,
    });
  });

  it('returns undefined for MAX_SAFE_INTEGER totals (unlimited allowance)', () => {
    expect(
      mapDeploymentLimitsToInput({
        monthTokenStats: {
          used: 500,
          total: Number.MAX_SAFE_INTEGER,
        },
      }),
    ).toBeUndefined();
  });

  it('clamps over-limit percentage and remaining tokens', () => {
    expect(
      mapDeploymentLimitsToInput({
        monthTokenStats: { used: 12000, total: 10000 },
      }),
    ).toEqual({
      used: 12000,
      total: 10000,
      remaining: 0,
      usedPercent: 100,
      isUnlimited: false,
    });
  });

  it.each([
    { used: 8900, expectedPercent: 89 },
    { used: 9000, expectedPercent: 90 },
  ])(
    'preserves the threshold boundary for $expectedPercent%',
    ({ used, expectedPercent }) => {
      expect(
        mapDeploymentLimitsToInput({
          monthTokenStats: { used, total: 10000 },
        })?.usedPercent,
      ).toBe(expectedPercent);
    },
  );
});
