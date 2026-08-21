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
  /** Set if either call rejects; the other call's data is still returned. */
  error: Error | undefined;
}

/**
 * Fetches GET /api/v1/user/limits and GET /api/v1/user/usage on mount.
 *
 * Uses `Promise.allSettled` (not `Promise.all`) so one endpoint rejecting
 * doesn't discard data the other endpoint successfully returned.
 *
 * `enabled` (default `true`) lets a caller behind a feature flag skip the
 * fetch entirely, mirroring `useScheduledTasks(enabled)`.
 */
export const useUsageData = (enabled = true): UseUsageDataResult => {
  const [limits, setLimits] = useState<UserLimitStatsResponseDto>();
  const [usage, setUsage] = useState<UserLimitStatsResponseDto>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error>();

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
      }
      if (usageResult.status === 'fulfilled') {
        setUsage(usageResult.value);
      }

      let rejected: unknown;
      if (limitsResult.status === 'rejected') {
        rejected = limitsResult.reason;
      } else if (usageResult.status === 'rejected') {
        rejected = usageResult.reason;
      }

      if (rejected !== undefined) {
        setError(
          rejected instanceof Error ? rejected : new Error(String(rejected)),
        );
      }

      setIsLoading(false);
    };

    void fetchUsageData();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { limits, usage, isLoading, error };
};
