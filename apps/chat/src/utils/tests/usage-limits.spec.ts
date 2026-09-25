import type { CatalogItemLimits } from '@epam/ai-dial-catalog';
import { describe, expect, it } from 'vitest';
import { findWorstCappedRow, getGaugeNeedleAngle } from '../usage-limits';

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
