import type { CatalogItemLimits } from '@epam/ai-dial-catalog';
import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { UsageLimitBannerSeverity } from '@epam/ai-dial-conversation-input';
import { describe, expect, it } from 'vitest';
import { UsagePeriod } from '../../types/usage-limits';
import {
  findWorstCappedRow,
  getGaugeNeedleAngle,
  getViewportClampShift,
  isCappedStat,
  selectUsageBannerSource,
} from '../usage-limits';

const limitsOf = (
  rows: CatalogItemLimits['groups'][number]['rows'],
): CatalogItemLimits => ({ groups: [{ label: 'Token limits', rows }] });

describe('findWorstCappedRow', () => {
  it('returns the row closest to its limit, not the last one', () => {
    const result = findWorstCappedRow(
      limitsOf([
        { label: 'Today', used: 90, total: 100 },
        { label: 'This week', used: 10, total: 100 },
      ]),
    );

    expect(result).toEqual({ label: 'Today', usedPercent: 90 });
  });

  it('compares ratios rather than raw used values', () => {
    const result = findWorstCappedRow(
      limitsOf([
        { label: 'Today', used: 5, total: 10 },
        { label: 'This month', used: 500, total: 10000 },
      ]),
    );

    expect(result?.label).toBe('Today');
  });

  it('looks across every group', () => {
    const result = findWorstCappedRow({
      groups: [
        {
          label: 'Token limits',
          rows: [{ label: 'Today', used: 1, total: 10 }],
        },
        {
          label: 'Cost limits',
          rows: [{ label: 'Spend', used: 9, total: 10 }],
        },
      ],
    });

    expect(result?.label).toBe('Spend');
  });

  it('ignores an unlimited row, whose total is a sentinel rather than a cap', () => {
    const result = findWorstCappedRow(
      limitsOf([
        { label: 'Today', used: 10, total: 100 },
        {
          label: 'This month',
          used: Number.MAX_SAFE_INTEGER,
          total: Number.MAX_SAFE_INTEGER,
          isUnlimited: true,
        },
      ]),
    );

    expect(result).toEqual({ label: 'Today', usedPercent: 10 });
  });

  it('clamps an overshoot to 100 percent', () => {
    const result = findWorstCappedRow(
      limitsOf([{ label: 'Today', used: 150, total: 100 }]),
    );

    expect(result?.usedPercent).toBe(100);
  });

  it('returns undefined when nothing is capped', () => {
    expect(findWorstCappedRow(undefined)).toBeUndefined();
    expect(findWorstCappedRow({ groups: [] })).toBeUndefined();
    expect(
      findWorstCappedRow(limitsOf([{ label: 'Today', used: 1, total: 0 }])),
    ).toBeUndefined();
  });
});

describe('getGaugeNeedleAngle', () => {
  it.each([
    [0, -135],
    [25, -67.5],
    [50, 0],
    [75, 67.5],
    [100, 135],
  ])('aims the needle at %i%% with %f degrees', (percent, expected) => {
    expect(getGaugeNeedleAngle(percent)).toBeCloseTo(expected);
  });

  it('rests at the zero mark for a negative value', () => {
    expect(getGaugeNeedleAngle(-10)).toBe(-135);
  });

  it('stops at the full mark for an overshoot', () => {
    expect(getGaugeNeedleAngle(150)).toBe(135);
  });
});

describe('getViewportClampShift', () => {
  it('leaves a box that already fits where it is', () => {
    expect(getViewportClampShift(20, 300, 390, 16)).toBe(0);
  });

  it('pushes a box that overflows the left edge back to the gutter', () => {
    expect(getViewportClampShift(-175, 183, 390, 16)).toBe(191);
  });

  it('pulls a box that overflows the right edge back to the gutter', () => {
    expect(getViewportClampShift(200, 558, 390, 16)).toBe(-184);
  });

  it('keeps the left edge visible when the box is wider than the viewport span', () => {
    expect(getViewportClampShift(100, 500, 300, 16)).toBe(-84);
  });
});

describe('isCappedStat', () => {
  it.each([
    [100, true],
    [0, false],
    [-1, false],
    [Number.POSITIVE_INFINITY, false],
    [Number.NaN, false],
    [Number.MAX_SAFE_INTEGER, false],
  ])('treats a total of %d as capped: %s', (total, expected) => {
    expect(isCappedStat(total)).toBe(expected);
  });
});

describe('selectUsageBannerSource', () => {
  const RESETS_AT = '2026-10-14T00:00:00Z';

  it('returns a daily warning at 80% with the default 75% threshold', () => {
    const dto: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 80, total: 100, resetsAt: RESETS_AT },
      weekTokenStats: { used: 50, total: 100 },
      monthCostStats: { used: 10, total: 100 },
    };

    expect(selectUsageBannerSource(dto, 75)).toEqual({
      period: UsagePeriod.Day,
      severity: UsageLimitBannerSeverity.Warning,
      usedPercent: 80,
      resetsAt: RESETS_AT,
    });
  });

  it('returns undefined when the worst row is below the threshold', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 70, total: 100 } }, 75),
    ).toBeUndefined();
  });

  it('returns undefined at 80% when the threshold is 90', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 80, total: 100 } }, 90),
    ).toBeUndefined();
  });

  it('returns a warning at 92% when the threshold is 90', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 92, total: 100 } }, 90)
        ?.severity,
    ).toBe(UsageLimitBannerSeverity.Warning);
  });

  it('lets a reached row outrank a warning row', () => {
    const result = selectUsageBannerSource(
      {
        weekCostStats: { used: 100, total: 100 },
        dayTokenStats: { used: 95, total: 100 },
      },
      75,
    );

    expect(result).toMatchObject({
      period: UsagePeriod.Week,
      severity: UsageLimitBannerSeverity.Reached,
      usedPercent: 100,
    });
  });

  it('gives a tie to the longer period', () => {
    expect(
      selectUsageBannerSource(
        {
          dayTokenStats: { used: 100, total: 100 },
          monthTokenStats: { used: 100, total: 100 },
        },
        75,
      )?.period,
    ).toBe(UsagePeriod.Month);
  });

  it('gives a tie within a period to the token row', () => {
    expect(
      selectUsageBannerSource(
        {
          dayCostStats: { used: 9, total: 10, resetsAt: 'cost' },
          dayTokenStats: { used: 90, total: 100, resetsAt: 'token' },
        },
        75,
      )?.resetsAt,
    ).toBe('token');
  });

  it('clamps an overshoot to 100% and reports it as reached', () => {
    expect(
      selectUsageBannerSource({ dayTokenStats: { used: 150, total: 100 } }, 75),
    ).toMatchObject({
      severity: UsageLimitBannerSeverity.Reached,
      usedPercent: 100,
    });
  });

  it('ignores unlimited and zero totals', () => {
    expect(
      selectUsageBannerSource(
        {
          dayTokenStats: {
            used: Number.MAX_SAFE_INTEGER,
            total: Number.MAX_SAFE_INTEGER,
          },
          weekTokenStats: { used: 5, total: 0 },
          monthCostStats: { used: 5, total: -1 },
        },
        75,
      ),
    ).toBeUndefined();
  });

  it('ignores the minute stats', () => {
    expect(
      selectUsageBannerSource(
        {
          minuteTokenStats: { used: 100, total: 100 },
          minuteCostStats: { used: 100, total: 100 },
        },
        75,
      ),
    ).toBeUndefined();
  });

  it('returns undefined for an undefined response', () => {
    expect(selectUsageBannerSource(undefined, 75)).toBeUndefined();
  });
});
