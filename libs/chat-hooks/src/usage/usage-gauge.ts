/*
 * Speedometer sweep, in degrees clockwise from 12 o'clock: 0% rests at the
 * 7-o'clock mark, the needle passes straight up at 50%, and 100% lands at the
 * 5-o'clock mark. Kept as two constants so the dial can be re-aimed without
 * touching the call sites.
 */
const GAUGE_ZERO_DEG = -135;
const GAUGE_SWEEP_DEG = 270;

/** Angle, in degrees clockwise from 12 o'clock, at which the usage dial's needle points for `usedPercent`. */
export const getGaugeNeedleAngle = (usedPercent: number): number => {
  const clamped = Math.min(100, Math.max(0, usedPercent));

  return GAUGE_ZERO_DEG + (clamped / 100) * GAUGE_SWEEP_DEG;
};
