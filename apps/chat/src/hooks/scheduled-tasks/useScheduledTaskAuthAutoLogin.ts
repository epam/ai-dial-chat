import type {
  OfflineCredentialsConnectSettings,
  OfflineCredentialsLoginOutcome,
  OfflineCredentialsStatusResult,
} from '@epam/ai-dial-chat-hooks';
import { mapOfflineCredentialsResponse } from '@epam/ai-dial-chat-hooks';
import { useCallback } from 'react';
import { getOfflineCredentials } from '../../server-api/offline-credentials';
import { useOfflineCredentialsLogin } from '../offlineCredentials/useOfflineCredentialsLogin';

/**
 * Login orchestration for the scheduled-task create/edit save-failure path.
 * The login is driven by a fresh user gesture — the login-required toast's
 * "Log in and retry" action — exactly like the Scheduled Tasks banner's and
 * the Extensions row's login buttons, so the OAuth popup opens inside that
 * click's user activation and no popup is pre-reserved at Save-click time.
 */
export const useScheduledTaskAuthAutoLogin = (): {
  /**
   * Drives the offline-credentials OAuth flow and resolves its outcome; the
   * caller invokes it from a click handler so the popup is not blocked.
   */
  autoLogin: (
    connect: OfflineCredentialsConnectSettings,
  ) => Promise<OfflineCredentialsLoginOutcome>;
} => {
  const { login } = useOfflineCredentialsLogin();

  /*
   * A plain fresh status check stands in for the gate's refetch — the
   * create/edit routes mount no gate hook, so no status request is issued
   * outside the 403 path — and never rejects (the login flow treats a null
   * refetch as not-connected, matching the gate's contract).
   */
  const refetch =
    useCallback(async (): Promise<OfflineCredentialsStatusResult | null> => {
      try {
        return mapOfflineCredentialsResponse(await getOfflineCredentials());
      } catch {
        return null;
      }
    }, []);

  const autoLogin = useCallback(
    async (
      connect: OfflineCredentialsConnectSettings,
    ): Promise<OfflineCredentialsLoginOutcome> => login(connect, refetch),
    [login, refetch],
  );

  return { autoLogin };
};
