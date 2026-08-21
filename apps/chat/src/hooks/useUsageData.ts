import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { useEffect, useState } from 'react';
import { getUserLimits, getUserUsage } from '../server-api/user-limits';

export interface UseUsageDataResult {
  /** Aggregate limits for every deployment visible to the caller. */
  limits: UserLimitStatsResponseDto | undefined;
  /** Limits restricted to deployments used in the trailing 30 days. */
  usage: UserLimitStatsResponseDto | undefined;
  /** `true` while either fetch is in flight. */
  isLoading: boolean;
  /** Set if `getUserLimits()` rejects; `usage` is still returned if it succeeded. */
  limitsError: Error | undefined;
  /** Set if `getUserUsage()` rejects; `limits` is still returned if it succeeded. */
  usageError: Error | undefined;
}

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

/**
 * Fetches GET /api/v1/user/limits and GET /api/v1/user/usage on mount.
 *
 * Uses `Promise.allSettled` (not `Promise.all`) so one endpoint rejecting
 * doesn't discard data the other endpoint successfully returned. Each
 * endpoint's failure is reported independently via `limitsError`/`usageError`
 * so a caller can tell which call failed.
 *
 * `enabled` (default `true`) lets a caller behind a feature flag skip the
 * fetch entirely, mirroring `useScheduledTasks(enabled)`.
 */
export const useUsageData = (enabled = true): UseUsageDataResult => {
  const [limits, setLimits] = useState<UserLimitStatsResponseDto>();
  const [usage, setUsage] = useState<UserLimitStatsResponseDto>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [limitsError, setLimitsError] = useState<Error>();
  const [usageError, setUsageError] = useState<Error>();

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchUsageData = async () => {
      const [limitsResult, usageResult] = await Promise.allSettled([
        getUserLimits(),
        getUserUsage(),
      ]);

      if (cancelled) return;

      if (limitsResult.status === 'fulfilled') {
        setLimits(limitsResult.value);
      } else {
        setLimitsError(toError(limitsResult.reason));
      }

      if (usageResult.status === 'fulfilled') {
        setUsage(usageResult.value);
      } else {
        setUsageError(toError(usageResult.reason));
      }

      setIsLoading(false);
    };

    void fetchUsageData();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { limits, usage, isLoading, limitsError, usageError };
};
