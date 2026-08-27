import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { useEffect, useState } from 'react';

/** Return shape of {@link useUsageData}. */
export interface UseUsageDataResult {
  /** Rolling usage and rate-limit stats for every deployment the caller has used in the trailing 30 days, plus the caller's global cost budget. */
  usage: UserLimitStatsResponseDto | undefined;
  /** `true` while the fetch is in flight. */
  isLoading: boolean;
  /** Set when the `getUserUsage` call rejects. */
  usageError: Error | undefined;
}

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

/**
 * Fetches usage stats via the provided `getUserUsage` function on mount.
 *
 * `enabled` (default `true`) lets callers behind a feature flag skip the fetch
 * entirely. The hook accepts the fetch function as a parameter so the caller
 * supplies an already-configured API client — the hook never constructs or
 * imports one itself.
 */
export const useUsageData = (
  getUserUsage: () => Promise<UserLimitStatsResponseDto>,
  enabled = true,
): UseUsageDataResult => {
  const [usage, setUsage] = useState<UserLimitStatsResponseDto>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [usageError, setUsageError] = useState<Error>();

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

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
  }, [enabled, getUserUsage]);

  return { usage, isLoading, usageError };
};
