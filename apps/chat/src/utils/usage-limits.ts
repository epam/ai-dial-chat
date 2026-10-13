import type {
  CatalogItemLimits,
  UsageLimitProgressRow,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentLimitsResponseDto,
  LimitStatsDto,
} from '@epam/ai-dial-chat-api-client';
import { UsageLimitBannerSeverity } from '@epam/ai-dial-conversation-input';
import { UsagePeriod } from '../types/usage-limits';

/** The capped row closest to its limit, with its consumed percentage. */
export interface WorstCappedRow {
  /** Period label of that row, e.g. `'Today'`. */
  label: string;
  /** Consumed share of that row's limit, rounded and clamped to 0–100. */
  usedPercent: number;
}

/** The day/week/month usage stat the composer banner reports on, and how close it is to its limit. */
export interface UsageBannerSource {
  /** Calendar period of the stat. */
  period: UsagePeriod;
  /** `Reached` at or above 100%, otherwise `Warning`. */
  severity: UsageLimitBannerSeverity;
  /** Consumed share of the stat's limit, rounded and clamped to 0–100. */
  usedPercent: number;
  /** DIAL Core's `resetsAt` for the stat, when it sent one. */
  resetsAt: string | undefined;
}

/*
 * DIAL Core reports an unlimited stat with this sentinel as its `total`; it is
 * not a cap, so it never competes for "worst".
 */
const UNLIMITED_TOTAL_SENTINEL = Number.MAX_SAFE_INTEGER;

/** `true` when `total` is a real cap: finite, positive, and below DIAL Core's unlimited sentinel. */
export const isCappedStat = (total: number): boolean =>
  Number.isFinite(total) && total > 0 && total < UNLIMITED_TOTAL_SENTINEL;

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

type CalendarStatKey = keyof Pick<
  DeploymentLimitsResponseDto,
  | 'dayTokenStats'
  | 'weekTokenStats'
  | 'monthTokenStats'
  | 'dayCostStats'
  | 'weekCostStats'
  | 'monthCostStats'
>;

/*
 * Visited in tie-break order: a longer period wins an equal ratio, and within
 * a period the token stat wins over the cost stat. Only a strictly higher
 * ratio replaces the current pick, so the first entry of a tie is kept. The
 * minute stats are a rolling counter the user cannot act on, so they are left
 * out, as in the usage dial.
 */
const BANNER_CANDIDATE_STATS: ReadonlyArray<
  readonly [CalendarStatKey, UsagePeriod]
> = [
  ['monthTokenStats', UsagePeriod.Month],
  ['monthCostStats', UsagePeriod.Month],
  ['weekTokenStats', UsagePeriod.Week],
  ['weekCostStats', UsagePeriod.Week],
  ['dayTokenStats', UsagePeriod.Day],
  ['dayCostStats', UsagePeriod.Day],
];

/**
 * Returns the capped day/week/month token or cost stat with the highest
 * used/total ratio, classified against `thresholdPercent`, or `undefined` when
 * no stat is capped or the worst one is below the threshold.
 */
export const selectUsageBannerSource = (
  dto: DeploymentLimitsResponseDto | undefined,
  thresholdPercent: number,
): UsageBannerSource | undefined => {
  let worst:
    { stat: LimitStatsDto; period: UsagePeriod; ratio: number } | undefined;

  for (const [key, period] of BANNER_CANDIDATE_STATS) {
    const stat = dto?.[key];
    if (stat == null || !isCappedStat(stat.total)) {
      continue;
    }

    const ratio = Math.max(stat.used, 0) / stat.total;
    if (worst == null || ratio > worst.ratio) {
      worst = { stat, period, ratio };
    }
  }

  if (worst == null) {
    return undefined;
  }

  const usedPercent = Math.min(100, Math.round(worst.ratio * 100));
  let severity: UsageLimitBannerSeverity;
  if (worst.ratio >= 1) {
    severity = UsageLimitBannerSeverity.Reached;
  } else if (usedPercent >= thresholdPercent) {
    severity = UsageLimitBannerSeverity.Warning;
  } else {
    return undefined;
  }

  return {
    period: worst.period,
    severity,
    usedPercent,
    resetsAt: worst.stat.resetsAt,
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

/*
 * Space kept between the usage popover and either viewport edge. Half of the
 * `2rem` the popover's `max-w-[calc(100vw-2rem)]` reserves, so a full-width
 * popover sits centred with an equal gutter on both sides.
 */
export const USAGE_POPOVER_VIEWPORT_GUTTER_PX = 16;

/**
 * Horizontal shift, in px, that moves a box spanning `left`–`right` (viewport
 * coordinates, before any shift) inside `[gutter, viewportWidth - gutter]`.
 * Returns `0` when the box already fits. The left edge wins when the box is
 * wider than the available span.
 */
export const getViewportClampShift = (
  left: number,
  right: number,
  viewportWidth: number,
  gutter: number = USAGE_POPOVER_VIEWPORT_GUTTER_PX,
): number => {
  if (left < gutter) {
    return gutter - left;
  }

  const maxRight = viewportWidth - gutter;
  if (right > maxRight) {
    return Math.max(maxRight - right, gutter - left);
  }

  return 0;
};
