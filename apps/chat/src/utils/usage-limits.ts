import type {
  CatalogItemLimits,
  UsageLimitProgressRow,
} from '@epam/ai-dial-catalog';

/** The capped row closest to its limit, with its consumed percentage. */
export interface WorstCappedRow {
  /** Period label of that row, e.g. `'Today'`. */
  label: string;
  /** Consumed share of that row's limit, rounded and clamped to 0–100. */
  usedPercent: number;
}

/*
 * An unlimited row has no ratio to compare — its `total` is the upstream
 * sentinel, not a cap — so it never competes for "worst".
 */
const isCapped = (row: UsageLimitProgressRow): boolean =>
  row.isUnlimited !== true && Number.isFinite(row.total) && row.total > 0;

/**
 * Returns the capped row with the highest used/total ratio across every group,
 * or `undefined` when no row is capped.
 */
export const findWorstCappedRow = (
  limits: CatalogItemLimits | undefined,
): WorstCappedRow | undefined => {
  let worst: { label: string; ratio: number } | undefined;

  for (const group of limits?.groups ?? []) {
    for (const row of group.rows) {
      if (!isCapped(row)) {
        continue;
      }

      const ratio = Math.max(row.used, 0) / row.total;
      if (worst == null || ratio > worst.ratio) {
        worst = { label: row.label, ratio };
      }
    }
  }

  if (worst == null) {
    return undefined;
  }

  return {
    label: worst.label,
    usedPercent: Math.min(100, Math.round(worst.ratio * 100)),
  };
};

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
