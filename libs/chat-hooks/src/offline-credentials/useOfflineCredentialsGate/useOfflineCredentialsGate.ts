import type { OfflineCredentialsApi } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mapOfflineCredentialsResponse } from '../map-offline-credentials-response';

export enum OfflineCredentialsGateStatus {
  /** The status check is in flight (including before the first check resolves). */
  Checking = 'checking',
  /** A stored offline-credentials grant exists — no service-row login affordance is needed. */
  Hidden = 'hidden',
  /** The deployment has an offline OAuth client configured and no stored grant — a login is possible. */
  Available = 'available',
  /** The deployment has no offline OAuth client configured — no login is possible. */
  Unavailable = 'unavailable',
  /** The status check failed — no connection state is asserted. */
  Error = 'error',
}

export interface OfflineCredentialsConnectSettings {
  /** OAuth client id of the configured offline OAuth client. */
  clientId: string;
  /** Authorization endpoint of the configured offline OAuth client. */
  authorizationEndpoint: string;
  /** OAuth scopes requested for the offline grant. */
  scopes: string[];
}

export interface OfflineCredentialsStatusResult {
  /** Whether the deployment has an offline OAuth client configured. */
  available: boolean;
  /** Whether a stored offline-credentials grant exists. */
  connected: boolean;
  /** OAuth client settings usable for a login — present only while available and not connected. */
  connect?: OfflineCredentialsConnectSettings;
}

export interface UseOfflineCredentialsGateResult {
  status: OfflineCredentialsGateStatus;
  /** OAuth client settings from the most recent check — set only while `status` is `Available`. */
  connect: OfflineCredentialsConnectSettings | undefined;
  /** Whether the most recent successful check reported a stored offline-credentials grant; a failed check keeps the last resolved value. `false` before the first check resolves. */
  connected: boolean;
  /**
   * Re-runs the status check and returns its freshly resolved
   * `{ available, connected }` result (or `null` on failure/abort), so a
   * caller such as `useOfflineCredentialsLogin` can decide a login outcome
   * from the same authoritative call that also updates `status`.
   */
  refetch: () => Promise<OfflineCredentialsStatusResult | null>;
}

/** Options for `useOfflineCredentialsGate`. */
export interface UseOfflineCredentialsGateOptions {
  /** Host-configured offline-credentials API. */
  offlineCredentialsClient: Pick<
    OfflineCredentialsApi,
    'getOfflineCredentials'
  >;
}

/**
 * Offline-credentials status check behind a host's offline-credentials
 * surfaces (a login banner, a settings tab): fires on mount, cancels the
 * in-flight request on unmount, and never collapses a fetch failure into
 * `connected: false` — a failed check must not incorrectly trigger a
 * login-required surface. Re-fire the check at any time via `refetch`.
 */
export const useOfflineCredentialsGate = ({
  offlineCredentialsClient,
}: UseOfflineCredentialsGateOptions): UseOfflineCredentialsGateResult => {
  const [status, setStatus] = useState<OfflineCredentialsGateStatus>(
    OfflineCredentialsGateStatus.Checking,
  );
  const [connect, setConnect] = useState<
    OfflineCredentialsConnectSettings | undefined
  >(undefined);
  const [connected, setConnected] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStatus =
    useCallback(async (): Promise<OfflineCredentialsStatusResult | null> => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStatus(OfflineCredentialsGateStatus.Checking);

      try {
        const response = await offlineCredentialsClient.getOfflineCredentials({
          signal: controller.signal,
        });
        if (controller.signal.aborted) return null;

        const {
          available,
          connected,
          connect: connectSettings,
        } = mapOfflineCredentialsResponse(response);

        setStatus(
          connected
            ? OfflineCredentialsGateStatus.Hidden
            : available
              ? OfflineCredentialsGateStatus.Available
              : OfflineCredentialsGateStatus.Unavailable,
        );
        setConnect(connectSettings);
        setConnected(connected);
        return { available, connected, connect: connectSettings };
      } catch {
        if (controller.signal.aborted) return null;
        setStatus(OfflineCredentialsGateStatus.Error);
        setConnect(undefined);
        return null;
      }
    }, [offlineCredentialsClient]);

  useEffect(() => {
    void fetchStatus();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchStatus]);

  return {
    status,
    connect,
    connected,
    refetch: fetchStatus,
  };
};
