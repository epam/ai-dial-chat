import type { OfflineCredentialsApi } from '@epam/ai-dial-chat-api-client';
import { useCallback, useState } from 'react';
import type {
  OfflineCredentialsConnectSettings,
  OfflineCredentialsStatusResult,
} from '../useOfflineCredentialsGate/useOfflineCredentialsGate';
import {
  OfflineCredentialsLoginOutcomeType,
  useOfflineCredentialsLogin,
} from '../useOfflineCredentialsLogin/useOfflineCredentialsLogin';

/** Terminal outcome kinds `logOut` can resolve. */
export enum OfflineCredentialsLogoutOutcomeType {
  /** The sign-out request succeeded and a fresh status refetch confirmed `connected: false`. */
  Disconnected = 'disconnected',
  /** The sign-out request succeeded but the fresh refetch still reported a connection (or failed to resolve). */
  NotDisconnected = 'not-disconnected',
  /** The sign-out request itself failed. */
  Failed = 'failed',
}

/** The slice of `useOfflineCredentialsGate` the auth flow drives and observes. */
export interface OfflineCredentialsAuthGate {
  /** OAuth client settings for a login — absent while no login is possible. */
  connect: OfflineCredentialsConnectSettings | undefined;
  /** Fresh authoritative status check from the gate. */
  refetch: () => Promise<OfflineCredentialsStatusResult | null>;
}

/** Options for `useOfflineCredentialsAuth`. */
export interface UseOfflineCredentialsAuthOptions extends OfflineCredentialsAuthGate {
  /** Host-configured offline-credentials API. */
  offlineCredentialsClient: Pick<
    OfflineCredentialsApi,
    'signOutOfflineCredentials'
  >;
  /** Host route the OAuth popup posts its result back to, e.g. the app's toolset sign-in callback route. */
  callbackPath: string;
}

export interface UseOfflineCredentialsAuthResult {
  isLoggingIn: boolean;
  /**
   * Terminal outcome of the most recent login attempt — `undefined` before
   * the first attempt and while one is in flight; reset at the start of every
   * new attempt.
   */
  loginOutcome: OfflineCredentialsLoginOutcomeType | undefined;
  isLoggingOut: boolean;
  /**
   * Starts the OAuth popup login with the gate's `connect` settings; no-ops
   * while no login is possible (gate reported no offline OAuth client).
   */
  logIn: () => void;
  /**
   * Revokes the stored offline-credentials grant and resolves the logout
   * outcome — the caller's confirmation dialog closes on `Disconnected` and
   * maps every outcome to its own announcement text.
   */
  logOut: () => Promise<OfflineCredentialsLogoutOutcomeType>;
}

/**
 * Shared login/logout orchestration for the external scheduler service's
 * offline credentials, consumed by every presentation of it (a login banner,
 * a settings tab): tracks the in-flight flags and the terminal login outcome,
 * and treats a fresh gate refetch as authoritative for the logout outcome.
 * Presentation and announcement stay with the caller: callers map
 * `loginOutcome` and `logOut`'s resolved outcome onto their own states and
 * text.
 */
export const useOfflineCredentialsAuth = ({
  connect,
  refetch,
  offlineCredentialsClient,
  callbackPath,
}: UseOfflineCredentialsAuthOptions): UseOfflineCredentialsAuthResult => {
  const { login } = useOfflineCredentialsLogin({ callbackPath });

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginOutcome, setLoginOutcome] = useState<
    OfflineCredentialsLoginOutcomeType | undefined
  >(undefined);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logIn = useCallback((): void => {
    if (connect == null) return;
    setIsLoggingIn(true);
    setLoginOutcome(undefined);

    const run = async (): Promise<void> => {
      const outcome = await login(connect, refetch);
      setIsLoggingIn(false);
      setLoginOutcome(outcome.type);
    };
    void run();
  }, [connect, login, refetch]);

  /*
   * The POST's own 200 is a hint, and only a fresh gate refetch reporting
   * `connected: false` counts as logged out — mirrors the login flow's
   * refetch-is-authoritative rule.
   */
  const logOut =
    useCallback(async (): Promise<OfflineCredentialsLogoutOutcomeType> => {
      setIsLoggingOut(true);
      try {
        await offlineCredentialsClient.signOutOfflineCredentials();
        const refreshed = await refetch();
        return refreshed && !refreshed.connected
          ? OfflineCredentialsLogoutOutcomeType.Disconnected
          : OfflineCredentialsLogoutOutcomeType.NotDisconnected;
      } catch {
        return OfflineCredentialsLogoutOutcomeType.Failed;
      } finally {
        setIsLoggingOut(false);
      }
    }, [offlineCredentialsClient, refetch]);

  return {
    isLoggingIn,
    loginOutcome,
    isLoggingOut,
    logIn,
    logOut,
  };
};
