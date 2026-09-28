import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDeploymentLimits } from '../server-api/deployment-limits';

export interface UseDeploymentUsageLimitsResult {
  /** Raw limits response for the selected deployment, or `undefined` before the first success. */
  limitsDto: DeploymentLimitsResponseDto | undefined;
  /** `true` while a fetch is in flight. */
  isLoading: boolean;
  /** `true` after the most recent fetch rejected. */
  hasError: boolean;
  /** Re-fetches the current deployment when no request is in flight. */
  refresh: () => void;
}

/**
 * Fetches the selected deployment's token limits.
 *
 * A monotonic request ID prevents a slower response for a previous deployment
 * from replacing the current value. Refresh failures preserve the last known
 * response so the open popover can surface a non-blocking error.
 *
 * The raw response is returned rather than a mapped display model: mapping
 * needs the caller's translated labels and locale-bound reset formatter, and
 * holding the mapped value in state here would leave it stale after a language
 * change until the next fetch.
 */
export const useDeploymentUsageLimits = (
  deploymentId: string | undefined,
): UseDeploymentUsageLimitsResult => {
  const [limitsDto, setLimitsDto] = useState<DeploymentLimitsResponseDto>();
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
      setLimitsDto(undefined);
      setIsLoading(false);
      setHasError(false);
      isLoadingRef.current = false;
      return;
    }

    if (deploymentChanged) {
      setLimitsDto(undefined);
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
        setLimitsDto(dto);
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

  return { limitsDto, isLoading, hasError, refresh };
};
