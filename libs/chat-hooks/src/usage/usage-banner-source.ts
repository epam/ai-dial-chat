import type {
  DeploymentLimitsResponseDto,
  LimitStatsDto,
} from '@epam/ai-dial-chat-api-client';
import { UsageLimitBannerSeverity } from '@epam/ai-dial-conversation-input';
import { UsagePeriod } from './usage-period';
import type { UsageLimitsSources } from './useDeploymentUsageLimits/useDeploymentUsageLimits';

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

type CalendarStatKey = keyof Pick<
  DeploymentLimitsResponseDto,
  | 'dayTokenStats'
  | 'weekTokenStats'
  | 'monthTokenStats'
  | 'dayCostStats'
  | 'weekCostStats'
  | 'monthCostStats'
>;

/** Which source a candidate stat is read from. */
type StatSource = keyof UsageLimitsSources;

/*
 * Visited in tie-break order: a longer period wins an equal ratio, and within
 * a period the token stat wins over the cost stat. Only a strictly higher
 * ratio replaces the current pick, so the first entry of a tie is kept. The
 * minute stats are a rolling counter the user cannot act on, so they are left
 * out, as in the usage dial.
 *
 * Token stats come from the deployment's own usage and cost stats from the
 * account usage, never the other way round: the account budget is the only
 * cost cap, and reading it from a deployment-limits response would count an
 * agent's spend twice (#9361).
 */
const BANNER_CANDIDATE_STATS: ReadonlyArray<
  readonly [StatSource, CalendarStatKey, UsagePeriod]
> = [
  ['deployment', 'monthTokenStats', UsagePeriod.Month],
  ['account', 'monthCostStats', UsagePeriod.Month],
  ['deployment', 'weekTokenStats', UsagePeriod.Week],
  ['account', 'weekCostStats', UsagePeriod.Week],
  ['deployment', 'dayTokenStats', UsagePeriod.Day],
  ['account', 'dayCostStats', UsagePeriod.Day],
];

/**
 * Returns the capped day/week/month token stat of `sources.deployment` or cost
 * stat of `sources.account` with the highest used/total ratio, classified
 * against `thresholdPercent`, or `undefined` when no stat is capped or the
 * worst one is below the threshold.
 */
export const selectUsageBannerSource = (
  sources: UsageLimitsSources,
  thresholdPercent: number,
): UsageBannerSource | undefined => {
  let worst:
    { stat: LimitStatsDto; period: UsagePeriod; ratio: number } | undefined;

  for (const [source, key, period] of BANNER_CANDIDATE_STATS) {
    const stats: Partial<Record<CalendarStatKey, LimitStatsDto>> | undefined =
      sources[source];
    const stat = stats?.[key];
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
