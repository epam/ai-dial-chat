import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { getOfflineCredentials } from '../../server-api/offline-credentials';

export enum OfflineCredentialsGateStatus {
  Checking = 'checking',
  Hidden = 'hidden',
  Available = 'available',
  Error = 'error',
}

export interface OfflineCredentialsConnectSettings {
  clientId: string;
  authorizationEndpoint: string;
  scopes: string[];
}

export interface OfflineCredentialsStatusResult {
  available: boolean;
  connected: boolean;
  connect?: OfflineCredentialsConnectSettings;
}

export interface UseOfflineCredentialsGateResult {
  status: OfflineCredentialsGateStatus;
  /** OAuth client settings from the most recent check — set only while `status` is `Available`. */
  connect: OfflineCredentialsConnectSettings | undefined;
  /**
   * Re-runs the status check and returns its freshly resolved
   * `{ available, connected }` result (or `null` on failure/abort), so a
   * caller such as `useOfflineCredentialsLogin` can decide a login outcome
   * from the same authoritative call that also updates `status`.
   */
  refetch: () => Promise<OfflineCredentialsStatusResult | null>;
}

/**
 * Route-scoped offline-credentials status check for the Scheduled Tasks
 * routes (see `ScheduledTasksRouteGate`). Fires on mount and on every
 * pathname change (re-fireable per route entry, not a once-ever guard,
 * since the user can navigate in and out of Scheduled Tasks repeatedly
 * within a session), cancels the in-flight request on unmount/route change,
 * and never collapses a fetch failure into `connected: false` — a failed
 * check must not incorrectly trigger the "please log in" modal.
 */
export const useOfflineCredentialsGate =
  (): UseOfflineCredentialsGateResult => {
    const { pathname } = useLocation();
    const [status, setStatus] = useState<OfflineCredentialsGateStatus>(
      OfflineCredentialsGateStatus.Checking,
    );
    const [connect, setConnect] = useState<
      OfflineCredentialsConnectSettings | undefined
    >(undefined);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchStatus =
      useCallback(async (): Promise<OfflineCredentialsStatusResult | null> => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setStatus(OfflineCredentialsGateStatus.Checking);

        try {
          const response = await getOfflineCredentials(controller.signal);
          if (controller.signal.aborted) return null;

          const available = response.available ?? false;
          const connected = response.connected ?? false;
          const connectSettings =
            available &&
            !connected &&
            response.connect?.clientId != null &&
            response.connect?.authorizationEndpoint != null
              ? {
                  clientId: response.connect.clientId,
                  authorizationEndpoint: response.connect.authorizationEndpoint,
                  scopes: response.connect.scopes ?? [],
                }
              : undefined;

          setStatus(
            available && !connected
              ? OfflineCredentialsGateStatus.Available
              : OfflineCredentialsGateStatus.Hidden,
          );
          setConnect(connectSettings);
          return { available, connected, connect: connectSettings };
        } catch {
          if (controller.signal.aborted) return null;
          setStatus(OfflineCredentialsGateStatus.Error);
          setConnect(undefined);
          return null;
        }
      }, []);

    useEffect(() => {
      void fetchStatus();
      return () => {
        abortControllerRef.current?.abort();
      };
    }, [pathname, fetchStatus]);

    return { status, connect, refetch: fetchStatus };
  };
