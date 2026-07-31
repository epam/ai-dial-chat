import { useCallback, useEffect, useRef, useState } from 'react';
import { getDeploymentLimits } from '../server-api/deployment-limits';
import type { MonthlyUsageLimit } from '../utils/map-deployment-limits-to-input';
import { mapDeploymentLimitsToInput } from '../utils/map-deployment-limits-to-input';

export interface UseDeploymentUsageLimitsResult {
  /** Normalized monthly token limit for the selected deployment. */
  limit: MonthlyUsageLimit | undefined;
  /** `true` while a fetch is in flight. */
  isLoading: boolean;
  /** `true` after the most recent fetch rejected. */
  hasError: boolean;
  /** Re-fetches the current deployment when no request is in flight. */
  refresh: () => void;
}

/**
 * Fetches the selected deployment's monthly token limit.
 *
 * A monotonic request ID prevents a slower response for a previous deployment
 * from replacing the current value. Refresh failures preserve the last known
 * limit so the open popover can surface a non-blocking error.
 */
export const useDeploymentUsageLimits = (
  deploymentId: string | undefined,
): UseDeploymentUsageLimitsResult => {
  const [limit, setLimit] = useState<MonthlyUsageLimit>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const fetchIdRef = useRef(0);
  const isLoadingRef = useRef(false);
  const previousDeploymentIdRef = useRef<string | undefined>(undefined);

  const refresh = useCallback(() => {
    if (isLoadingRef.current) return;
    setRefreshCounter((counter) => counter + 1);
  }, []);

  useEffect(() => {
    const deploymentChanged = previousDeploymentIdRef.current !== deploymentId;
    previousDeploymentIdRef.current = deploymentId;

    if (!deploymentId) {
      fetchIdRef.current += 1;
      setLimit(undefined);
      setIsLoading(false);
      setHasError(false);
      isLoadingRef.current = false;
      return;
    }

    if (deploymentChanged) {
      setLimit(undefined);
    }

    const controller = new AbortController();
    const currentFetchId = ++fetchIdRef.current;
    let cancelled = false;

    setIsLoading(true);
    setHasError(false);
    isLoadingRef.current = true;

    const fetchLimits = async () => {
      try {
        const dto = await getDeploymentLimits(deploymentId);
        if (cancelled || currentFetchId !== fetchIdRef.current) return;
        setLimit(mapDeploymentLimitsToInput(dto));
      } catch {
        if (cancelled || currentFetchId !== fetchIdRef.current) return;
        setHasError(true);
      } finally {
        if (!cancelled && currentFetchId === fetchIdRef.current) {
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      }
    };

    void fetchLimits();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deploymentId, refreshCounter]);

  return { limit, isLoading, hasError, refresh };
};
