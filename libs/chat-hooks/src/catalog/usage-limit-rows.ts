import type {
  CatalogItemLimits,
  UsageLimitProgressRow,
} from '@epam/ai-dial-catalog';
import { isCappedStat } from '../shared/usage-stat';

/** The capped row closest to its limit, with its consumed percentage. */
export interface WorstCappedRow {
  /** Period label of that row, e.g. `'Today'`. */
  label: string;
  /** Consumed share of that row's limit, rounded and clamped to 0–100. */
  usedPercent: number;
}

const isCapped = (row: UsageLimitProgressRow): boolean =>
  row.isUnlimited !== true && isCappedStat(row.total);

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
