import type {
  DeploymentLimitsResponseDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** The caller's account-wide cost budget and spend: the top level of a user-usage response. */
export type AccountUsage = Pick<
  UserLimitStatsResponseDto,
  'dayCostStats' | 'weekCostStats' | 'monthCostStats'
>;

/**
 * What the usage dial and the usage banner are mapped from. Each field has a
 * single scope, so a deployment's figures are never read as the account's or
 * the other way round.
 */
export interface UsageLimitsSources {
  /** The selected deployment's own stats (its deployment-usage response). Only its token stats are read. */
  deployment: DeploymentLimitsResponseDto | undefined;
  /** The caller's account budget and spend. Only its cost stats are read. */
  account: AccountUsage | undefined;
}

/** Host-configured calls that fetch the two usage sources. */
export interface UsageLimitsApi {
  /** Fetches one deployment's own usage, every stat scoped to that deployment. */
  getDeploymentUsage: (
    deploymentId: string,
  ) => Promise<DeploymentLimitsResponseDto>;
  /** Fetches the caller's account usage; only its top-level cost stats are read. */
  getAccountUsage: () => Promise<AccountUsage>;
}

/** Return shape of {@link useDeploymentUsageLimits}. */
export interface UseDeploymentUsageLimitsResult {
  /** The last successfully fetched value of each source. */
  sources: UsageLimitsSources;
  /** `true` until both calls of the current fetch have settled. */
  isLoading: boolean;
  /** `true` after either call of the most recent fetch rejected. */
  hasError: boolean;
  /** Re-fetches both sources when no request is in flight. */
  refresh: () => void;
}

/**
 * Fetches the selected deployment's own usage and the caller's account usage
 * through the provided `api`. The hook accepts the calls as a parameter so the
 * caller supplies an already-configured API client; the hook never constructs
 * or imports one itself. The identity of `api` is not a re-fetch trigger; only
 * `deploymentId` and `refresh()` are.
 *
 * Two sources rather than one deployment-limits response: there, the cost
 * stats add an application's aggregated callee cost to the account spend that
 * already contains it, so an agent's spend would be counted twice.
 *
 * Both calls share one monotonic request ID, so a slower response for a
 * previous deployment never replaces the current value. Each source keeps its
 * last known value when its own call fails, so the open popover can surface a
 * non-blocking error while the other source still renders. The account source
 * survives a deployment change, since it does not depend on the selection.
 *
 * The raw responses are returned rather than a mapped display model: mapping
 * needs the caller's translated labels and locale-bound reset formatter, and
 * holding the mapped value in state here would leave it stale after a language
 * change until the next fetch.
 */
export const useDeploymentUsageLimits = (
  deploymentId: string | undefined,
  api: UsageLimitsApi,
): UseDeploymentUsageLimitsResult => {
  const [deploymentUsage, setDeploymentUsage] =
    useState<DeploymentLimitsResponseDto>();
  const [accountUsage, setAccountUsage] = useState<AccountUsage>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const fetchIdRef = useRef(0);
  const isLoadingRef = useRef(false);
  const previousDeploymentIdRef = useRef<string | undefined>(undefined);
  const apiRef = useRef(api);
  apiRef.current = api;

  const refresh = useCallback(() => {
    if (isLoadingRef.current) return;
    setRefreshCounter((counter) => counter + 1);
  }, []);

  useEffect(() => {
    const deploymentChanged = previousDeploymentIdRef.current !== deploymentId;
    previousDeploymentIdRef.current = deploymentId;

    if (!deploymentId) {
      fetchIdRef.current += 1;
      setDeploymentUsage(undefined);
      setIsLoading(false);
      setHasError(false);
      isLoadingRef.current = false;
      return;
    }

    if (deploymentChanged) {
      setDeploymentUsage(undefined);
    }

    const currentFetchId = ++fetchIdRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && currentFetchId === fetchIdRef.current;

    setIsLoading(true);
    setHasError(false);
    isLoadingRef.current = true;

    const fetchSources = async () => {
      const [deploymentResult, accountResult] = await Promise.allSettled([
        apiRef.current.getDeploymentUsage(deploymentId),
        apiRef.current.getAccountUsage(),
      ]);
      if (!isCurrent()) return;

      if (deploymentResult.status === 'fulfilled') {
        setDeploymentUsage(deploymentResult.value);
      }
      if (accountResult.status === 'fulfilled') {
        setAccountUsage(accountResult.value);
      }
      setHasError(
        deploymentResult.status === 'rejected' ||
          accountResult.status === 'rejected',
      );
      setIsLoading(false);
      isLoadingRef.current = false;
    };

    void fetchSources();

    return () => {
      cancelled = true;
    };
  }, [deploymentId, refreshCounter]);

  const sources = useMemo(
    () => ({ deployment: deploymentUsage, account: accountUsage }),
    [deploymentUsage, accountUsage],
  );

  return { sources, isLoading, hasError, refresh };
};
