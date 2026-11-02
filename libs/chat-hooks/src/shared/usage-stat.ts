/*
 * DIAL Core reports an unlimited stat with this sentinel as its `total`; it is
 * not a cap, so it never competes for "worst".
 */
const UNLIMITED_TOTAL_SENTINEL = Number.MAX_SAFE_INTEGER;

/** `true` when `total` is a real cap: finite, positive, and below DIAL Core's unlimited sentinel. */
export const isCappedStat = (total: number): boolean =>
  Number.isFinite(total) && total > 0 && total < UNLIMITED_TOTAL_SENTINEL;
