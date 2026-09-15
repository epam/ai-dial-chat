import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { useEffect, useState } from 'react';

/** Return shape of {@link useUsageData}. */
export interface UseUsageDataResult {
  /** Calendar-period usage and rate-limit stats for every deployment the caller has used in the current UTC day, week, and month, plus the caller's global cost budget. Retained across a `refreshToken`-triggered re-fetch until the new response resolves. */
  usage: UserLimitStatsResponseDto | undefined;
  /** `true` while a fetch is in flight, including a `refreshToken`-triggered re-fetch. */
  isLoading: boolean;
  /** Set when the `getUserUsage` call rejects. */
  usageError: Error | undefined;
}

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

/**
 * Fetches usage stats via the provided `getUserUsage` function on mount, and
 * again whenever `refreshToken` changes.
 *
 * `enabled` (default `true`) lets callers behind a feature flag skip the fetch
 * entirely. The hook accepts the fetch function as a parameter so the caller
 * supplies an already-configured API client — the hook never constructs or
 * imports one itself.
 *
 * `refreshToken` (default `0`) is a caller-driven re-fetch trigger, subject to
 * the same `enabled` gate. The hook owns no timer and reads no clock: the
 * caller decides when to change the token. A previously resolved `usage` value
 * is retained while a token-triggered re-fetch is in flight, so the consumer
 * can keep rendering the last known figures and suppress a full-page loading
 * state for a refresh.
 */
export const useUsageData = (
  getUserUsage: () => Promise<UserLimitStatsResponseDto>,
  enabled = true,
  refreshToken = 0,
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
  }, [enabled, getUserUsage, refreshToken]);

  return { usage, isLoading, usageError };
};
