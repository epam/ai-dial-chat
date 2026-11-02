import { describe, expect, it } from 'vitest';
import { getGaugeNeedleAngle } from '../usage-limits';

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
