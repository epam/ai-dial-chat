import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { useEffect, useState } from 'react';
import { getUserUsage } from '../server-api/user-limits';

export interface UseUsageDataResult {
  /** Rolling usage and rate-limit stats for every deployment the caller has used in the trailing 30 days, plus the caller's global cost budget. */
  usage: UserLimitStatsResponseDto | undefined;
  /** `true` while the fetch is in flight. */
  isLoading: boolean;
  /** Set if `getUserUsage()` rejects. */
  usageError: Error | undefined;
}

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

/**
 * Fetches GET /api/v1/user/usage on mount.
 *
 * `enabled` (default `true`) lets a caller behind a feature flag skip the
 * fetch entirely, mirroring `useScheduledTasks(enabled)`.
 */
export const useUsageData = (enabled = true): UseUsageDataResult => {
  const [usage, setUsage] = useState<UserLimitStatsResponseDto>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [usageError, setUsageError] = useState<Error>();

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchUsageData = async () => {
      try {
        const result = await getUserUsage();
        if (cancelled) return;
        setUsage(result);
      } catch (reason) {
        if (cancelled) return;
        setUsageError(toError(reason));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchUsageData();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { usage, isLoading, usageError };
};
