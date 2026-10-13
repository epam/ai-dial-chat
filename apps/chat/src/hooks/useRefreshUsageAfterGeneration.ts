import { useEffect, useRef } from 'react';

export interface UseRefreshUsageAfterGenerationOptions {
  /** Whether the selected deployment is currently generating a response. */
  isGenerationInProgress: boolean;
  /** `true` while the usage fetch is in flight; a pending refresh waits for it. */
  isLoading: boolean;
  /** Re-fetches the usage limits. */
  refresh: () => void;
}

/**
 * Refreshes usage limits once after a response finishes streaming
 * (`isGenerationInProgress` `true` → `false`), deferring the refresh while a
 * fetch is still in flight. Shared by the usage dial and the usage banner so
 * the two cannot drift.
 */
export const useRefreshUsageAfterGeneration = ({
  isGenerationInProgress,
  isLoading,
  refresh,
}: UseRefreshUsageAfterGenerationOptions): void => {
  const wasGenerationInProgressRef = useRef(isGenerationInProgress);
  const hasPendingGenerationRefreshRef = useRef(false);

  useEffect(() => {
    if (wasGenerationInProgressRef.current && !isGenerationInProgress) {
      hasPendingGenerationRefreshRef.current = true;
    }
    wasGenerationInProgressRef.current = isGenerationInProgress;

    if (hasPendingGenerationRefreshRef.current && !isLoading) {
      hasPendingGenerationRefreshRef.current = false;
      refresh();
    }
  }, [isGenerationInProgress, isLoading, refresh]);
};
