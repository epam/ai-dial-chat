import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Host-configured call that fetches the limits of one deployment. */
export type GetDeploymentLimits = (
  deploymentId: string,
) => Promise<DeploymentLimitsResponseDto>;

/** Return shape of {@link useDeploymentUsageLimits}. */
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
 * Fetches the selected deployment's usage limits via the provided
 * `getDeploymentLimits` function. The hook accepts the fetch function as a
 * parameter so the caller supplies an already-configured API client — the hook
 * never constructs or imports one itself. The function's identity is not a
 * re-fetch trigger; only `deploymentId` and `refresh()` are.
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
  getDeploymentLimits: GetDeploymentLimits,
): UseDeploymentUsageLimitsResult => {
  const [limitsDto, setLimitsDto] = useState<DeploymentLimitsResponseDto>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const fetchIdRef = useRef(0);
  const isLoadingRef = useRef(false);
  const previousDeploymentIdRef = useRef<string | undefined>(undefined);
  const getDeploymentLimitsRef = useRef(getDeploymentLimits);
  getDeploymentLimitsRef.current = getDeploymentLimits;

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

    const currentFetchId = ++fetchIdRef.current;
    let cancelled = false;

    setIsLoading(true);
    setHasError(false);
    isLoadingRef.current = true;

    const fetchLimits = async () => {
      try {
        const dto = await getDeploymentLimitsRef.current(deploymentId);
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
    };
  }, [deploymentId, refreshCounter]);

  return { limitsDto, isLoading, hasError, refresh };
};
