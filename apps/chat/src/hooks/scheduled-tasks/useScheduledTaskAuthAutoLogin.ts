import { openToolsetOAuthPopup } from '@epam/ai-dial-chat-hooks';
import { useCallback } from 'react';
import { getOfflineCredentials } from '../../server-api/offline-credentials';
import type {
  OfflineCredentialsConnectSettings,
  OfflineCredentialsStatusResult,
} from '../offlineCredentials/useOfflineCredentialsGate';
import {
  useOfflineCredentialsLogin,
  type OfflineCredentialsLoginOutcome,
} from '../offlineCredentials/useOfflineCredentialsLogin';

/**
 * Reserved-popup auto-login orchestration for the scheduled-task create/edit
 * submit failure path. `window.open` is permitted only synchronously inside a
 * user gesture, and by the time a failed submit is attributed to the
 * logged-out external Scheduler auth service (403 → status check) the click's
 * user activation is already consumed — a popup opened there is blocked. So
 * the popup is reserved at click time and navigated only when the login turns
 * out to be needed, exactly `useExternalServiceLogin.loginWithDialNative`'s
 * reserve pattern: call `reserveLoginPopup` in the submit click handler
 * before any `await`, pass the reserved popup to `autoLogin` on the
 * 403-with-connect path, and close it when the submit never needed a login.
 */
export const useScheduledTaskAuthAutoLogin = (): {
  /** Reserves the OAuth popup synchronously; `null` when the browser blocks it. */
  reserveLoginPopup: () => Window | null;
  /**
   * Drives the reserved-popup offline-credentials OAuth flow and resolves its
   * outcome; a `null` reserved popup falls back to the login flow's own
   * (blocked) popup open, surfacing as `popup-blocked`.
   */
  autoLogin: (
    connect: OfflineCredentialsConnectSettings,
    reservedPopup: Window | null,
  ) => Promise<OfflineCredentialsLoginOutcome>;
} => {
  const { login } = useOfflineCredentialsLogin();

  const reserveLoginPopup = useCallback(() => openToolsetOAuthPopup(), []);

  /*
   * A plain fresh status check stands in for the gate's refetch — the
   * create/edit routes mount no gate hook, so no status request is issued
   * outside the 403 path — and never rejects (the login flow treats a null
   * refetch as not-connected, matching the gate's contract).
   */
  const refetch =
    useCallback(async (): Promise<OfflineCredentialsStatusResult | null> => {
      try {
        return await getOfflineCredentials();
      } catch {
        return null;
      }
    }, []);

  const autoLogin = useCallback(
    async (
      connect: OfflineCredentialsConnectSettings,
      reservedPopup: Window | null,
    ): Promise<OfflineCredentialsLoginOutcome> =>
      login(connect, refetch, reservedPopup ?? undefined),
    [login, refetch],
  );

  return { reserveLoginPopup, autoLogin };
};
