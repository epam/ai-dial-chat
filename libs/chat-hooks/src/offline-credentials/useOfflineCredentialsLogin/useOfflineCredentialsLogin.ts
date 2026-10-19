import { useCallback } from 'react';
import { waitForToolsetOAuthResult } from '../../oauth/handshake';
import {
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
} from '../../oauth/popup';
import {
  OAuthResourceKind,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  WithLogin,
} from '../../oauth/types';
import type {
  OfflineCredentialsConnectSettings,
  OfflineCredentialsStatusResult,
} from '../useOfflineCredentialsGate/useOfflineCredentialsGate';

/**
 * Fixed sentinel correlation id for the offline-credentials OAuth flow —
 * there is no per-resource id to encode (unlike a toolset or external-service
 * scope id), so the shared popup/`BroadcastChannel` utilities' generic
 * `toolsetId` correlation slot carries this constant instead.
 */
const OFFLINE_CREDENTIALS_CORRELATION_ID = 'offline-credentials';

/*
 * Mirrors `waitForToolsetOAuthResult`'s own default
 * (`DEFAULT_OAUTH_RESULT_TIMEOUT_MS` in `oauth/handshake.ts`, not exported) so
 * an elapsed duration close to it can be treated as a timeout rather than a
 * user-initiated cancel — the shared utility itself does not distinguish the
 * two outcomes structurally (both resolve to `ToolsetOAuthResultType.Cancelled`),
 * and forking it to add that distinction was judged a larger change than
 * duplicating this one constant.
 */
const OAUTH_RESULT_TIMEOUT_MS = 5 * 60 * 1000;
const TIMEOUT_DETECTION_MARGIN_MS = 5 * 1000;

export enum OfflineCredentialsLoginOutcomeType {
  Success = 'success',
  Failure = 'failure',
  PopupBlocked = 'popup-blocked',
  Cancelled = 'cancelled',
  TimedOut = 'timed-out',
}

export interface OfflineCredentialsLoginOutcome {
  /** Which terminal branch the attempt resolved through. */
  type: OfflineCredentialsLoginOutcomeType;
}

/** Options for `useOfflineCredentialsLogin`. */
export interface UseOfflineCredentialsLoginOptions {
  /** Host route the OAuth popup posts its result back to, e.g. the app's toolset sign-in callback route. */
  callbackPath: string;
}

/**
 * Offline-credentials counterpart to `useToolsetLogin`/`useExternalServiceLogin`:
 * reuses the exact same OAuth popup/`BroadcastChannel` handshake, but drives
 * the `offline-credentials` BFF domain and treats a fresh
 * status refetch as authoritative for reporting success. Callers that fetch
 * settings after the click can pass a popup they already opened synchronously.
 */
export const useOfflineCredentialsLogin = ({
  callbackPath,
}: UseOfflineCredentialsLoginOptions): {
  login: (
    connect: OfflineCredentialsConnectSettings,
    refetch: () => Promise<OfflineCredentialsStatusResult | null>,
    preparedPopup?: Window,
  ) => Promise<OfflineCredentialsLoginOutcome>;
} => {
  const login = useCallback(
    async (
      connect: OfflineCredentialsConnectSettings,
      refetch: () => Promise<OfflineCredentialsStatusResult | null>,
      preparedPopup?: Window,
    ): Promise<OfflineCredentialsLoginOutcome> => {
      const authFormData = {
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: connect.clientId,
        authorizationEndpoint: connect.authorizationEndpoint,
        scopes: connect.scopes,
      };

      /*
       * The popup must be the first synchronous statement of the click
       * handler so the browser still treats it as user-triggered — mirrors
       * `useExternalServiceLogin.loginWithOAuth`.
       */
      const popup = preparedPopup ?? openToolsetOAuthPopup();
      if (!popup) {
        return { type: OfflineCredentialsLoginOutcomeType.PopupBlocked };
      }

      const initiation = navigateToolsetOAuthPopup(
        popup,
        authFormData,
        OFFLINE_CREDENTIALS_CORRELATION_ID,
        callbackPath,
        ToolsetCredentialsLevel.User,
        OAuthResourceKind.OfflineCredentials,
      );

      if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
        return { type: OfflineCredentialsLoginOutcomeType.Failure };
      }

      const startedAt = Date.now();
      const result = await waitForToolsetOAuthResult(
        initiation.popup,
        initiation.flowId,
        {
          toolsetId: OFFLINE_CREDENTIALS_CORRELATION_ID,
          credentialsLevel: ToolsetCredentialsLevel.User,
          callbackPath,
          timeoutMs: OAUTH_RESULT_TIMEOUT_MS,
        },
      );
      const elapsedMs = Date.now() - startedAt;

      /*
       * Authoritative re-verification on every terminal outcome (including a
       * reported Success) — a callback "success" alone is a hint, never the
       * final word, exactly matching `useToolsetLogin.loginWithOAuth`'s
       * existing re-verification against the backend.
       */
      const refreshed = await refetch();
      if (refreshed?.connected) {
        return { type: OfflineCredentialsLoginOutcomeType.Success };
      }

      /*
       * A reported callback Success that the refetch does not confirm is a
       * failed-login retry state, not a cancellation — the callback did run
       * a sign-in attempt, it just didn't end up connected.
       */
      if (
        result.type === ToolsetOAuthResultType.Failure ||
        result.type === ToolsetOAuthResultType.Success
      ) {
        return { type: OfflineCredentialsLoginOutcomeType.Failure };
      }
      if (elapsedMs >= OAUTH_RESULT_TIMEOUT_MS - TIMEOUT_DETECTION_MARGIN_MS) {
        return { type: OfflineCredentialsLoginOutcomeType.TimedOut };
      }
      return { type: OfflineCredentialsLoginOutcomeType.Cancelled };
    },
    [callbackPath],
  );

  return { login };
};
