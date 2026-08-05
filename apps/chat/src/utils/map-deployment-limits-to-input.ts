import type { DeploymentLimitsResponseDto } from '@epam/chat-api-client';

/** Normalized monthly token usage consumed by the conversation input control. */
export interface MonthlyUsageLimit {
  /** Normalized used-token count. */
  used: number;
  /** Configured monthly token limit. */
  total: number;
  /** Remaining monthly tokens, clamped to zero. */
  remaining: number;
  /** Monthly utilization percentage, clamped to 0–100. */
  usedPercent: number;
}

/** Maps the monthly deployment token limit to a display-ready value. */
export const mapDeploymentLimitsToInput = (
  dto: DeploymentLimitsResponseDto | undefined,
): MonthlyUsageLimit | undefined => {
  const stats = dto?.monthTokenStats;

  if (
    stats == null ||
    !Number.isFinite(stats.total) ||
    !Number.isFinite(stats.used) ||
    stats.total <= 0 ||
    stats.total >= Number.MAX_SAFE_INTEGER
  ) {
    return undefined;
  }

  const used = Math.max(0, stats.used);

  return {
    used,
    total: stats.total,
    remaining: Math.max(0, stats.total - used),
    usedPercent: Math.min(100, Math.round((used / stats.total) * 100)),
  };
};
