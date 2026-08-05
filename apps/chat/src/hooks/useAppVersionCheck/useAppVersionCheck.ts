import { useCallback, useEffect, useRef, useState } from 'react';
import { checkHealth } from '../../server-api/health.api';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface UseAppVersionCheckResult {
  isNewVersionAvailable: boolean;
}

/**
 * Polls `GET /api/health`'s `buildId` while this tab stays open, so a
 * long-lived tab notices a new deployment and can prompt the user to reload
 * instead of continuing to request hashed asset filenames that no longer
 * exist on the server. Stops polling once a new version has been detected —
 * there is nothing further to observe.
 */
export const useAppVersionCheck = (): UseAppVersionCheckResult => {
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);
  const baselineBuildIdRef = useRef<string | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const checkVersion = useCallback(
    async (isCancelled: () => boolean) => {
      try {
        const { buildId } = await checkHealth();
        if (isCancelled() || !buildId) {
          return;
        }
        if (baselineBuildIdRef.current === null) {
          baselineBuildIdRef.current = buildId;
          return;
        }
        if (buildId !== baselineBuildIdRef.current) {
          setIsNewVersionAvailable(true);
          stopPolling();
        }
      } catch {
        // Transient health-check failure: keep current state, retry on the next interval/visibility check.
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    void checkVersion(isCancelled);

    intervalIdRef.current = setInterval(() => {
      void checkVersion(isCancelled);
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVersion(isCancelled);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersion, stopPolling]);

  return { isNewVersionAvailable };
};
