import type {
  GetExternalServiceResponseDto,
  ExternalServiceSigninBodyDto,
  ExternalServiceLogoutBodyDto,
  GetOfflineCredentialsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback } from 'react';
import { waitForToolsetOAuthResult } from '../oauth/handshake';
import {
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
} from '../oauth/popup';
import {
  OAuthResourceKind,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  WithLogin,
} from '../oauth/types';
import {
  OfflineCredentialsLoginOutcomeType,
  type useOfflineCredentialsLogin,
} from '../offline-credentials/useOfflineCredentialsLogin/useOfflineCredentialsLogin';
import { buildExternalServiceScopeId } from '../shared/external-services';
/** External-service authentication method. */
export enum ExternalServiceAuthType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
  DialNative = 'DIAL_NATIVE',
}
/** Credential ownership level. */
export enum ExternalServiceCredentialsLevel {
  Global = 'GLOBAL',
  Application = 'APPLICATION',
  User = 'USER',
}
/** Host operations used by external-service login. */
export interface ExternalServiceLoginOptions {
  /** Host OAuth callback route. */
  callbackPath: string;
  /** Reads authoritative service status. */
  getExternalService: (
    appId: string,
    serviceId: string,
  ) => Promise<GetExternalServiceResponseDto>;
  /** Signs in at the selected level. */
  signInExternalService: (
    appId: string,
    serviceId: string,
    body: ExternalServiceSigninBodyDto,
  ) => Promise<unknown>;
  /** Clears stale credentials. */
  signOutExternalService: (
    appId: string,
    serviceId: string,
    body: ExternalServiceLogoutBodyDto,
  ) => Promise<unknown>;
  /** Reads platform offline availability. */
  getOfflineCredentials: () => Promise<GetOfflineCredentialsResponseDto>;
  /** Composes the existing offline login protocol. */
  loginOfflineCredentials: ReturnType<
    typeof useOfflineCredentialsLogin
  >['login'];
}
/** OAuth client settings needed to build the authorize URL — a subset of an external service's `auth_settings`. */
export interface ExternalServiceOAuthSettings {
  /** OAuth client identity. */
  clientId?: string;
  /** Authorize URL supplied by the host. */
  authorizationEndpoint?: string;
  /** Requested OAuth scopes. */
  scopes?: string[];
  /** PKCE challenge. */
  codeChallenge?: string;
  /** PKCE challenge method. */
  codeChallengeMethod?: string;
}

/** Terminal external-service login outcome. */
export enum ExternalServiceLoginOutcomeType {
  Success = 'success',
  Failure = 'failure',
  PopupBlocked = 'popup-blocked',
  Cancelled = 'cancelled',
  AdminConsentRequired = 'admin-consent-required',
  OfflineUnavailable = 'offline-unavailable',
}

/** Result of one login attempt. */
export type ExternalServiceLoginOutcome = {
  /** Terminal outcome. */
  type: ExternalServiceLoginOutcomeType;
};

/** Resource and consent parameters for one login attempt. */
export interface ExternalServiceLoginParams {
  /** The application's own resource id. */
  appId: string;
  /** The external service id defined in the application's `external_services` config. */
  serviceId: string;
  /** Target credential ownership level. */
  credentialsLevel: ExternalServiceCredentialsLevel;
  /** Authentication mechanism. */
  authenticationType: ExternalServiceAuthType;
  /** Required for `ExternalServiceAuthType.ApiKey`. */
  apiKey?: string;
  /** Required for `ExternalServiceAuthType.OAuth`. */
  oauthSettings?: ExternalServiceOAuthSettings;
  /**
   * Whether the user agreed the application may use the credential while they
   * are away. DIAL Core gates every on-behalf-of mint on it, so an application
   * that works in the background cannot use a credential signed in without it.
   * Absent means not granted — this is never defaulted on the user's behalf.
   */
  offlineUsageConsent?: boolean;
  /**
   * For API-key/OAuth credentials, logs out the target level first regardless of any cached status —
   * a Core-pushed `external-service/signin` event is proof credentials may
   * be stale even if a cached read still reports signed in. The signin
   * dialog always passes `true`, mirroring `useToolsetLogin`'s `forceStale`.
   */
  forceStale?: boolean;
  /**
   * For OAuth and DIAL-native logins, a popup the caller already opened during
   * the user's gesture — used instead of opening one here. A caller that must
   * look the service up first (the application editor's relay) opens the popup
   * before awaiting anything, so the browser still treats it as user-triggered.
   */
  popup?: Window;
}

/*
 * Maps the shared string-valued credentials level onto the toolset-side enum
 * for calls into the shared OAuth popup/BroadcastChannel utilities in
 * `utils/toolsets.ts`. External-service logins only ever use USER or GLOBAL
 * (never `ToolsetCredentialsLevel.App`, which has no external-service
 * equivalent), so the shared string values round-trip safely.
 */
const toToolsetCredentialsLevel = (
  level: ExternalServiceCredentialsLevel,
): ToolsetCredentialsLevel =>
  level === ExternalServiceCredentialsLevel.Global
    ? ToolsetCredentialsLevel.Global
    : ToolsetCredentialsLevel.User;

/**
 * External-service counterpart to `useToolsetLogin`: shares the exact same
 * OAuth popup/BroadcastChannel handshake and stale-credential-clearing rule,
 * driving the `external-services` BFF endpoints instead of the toolset ones.
 * DIAL-native services use platform offline credentials and separate admin consent.
 */
export const useExternalServiceLogin = ({
  callbackPath,
  getExternalService,
  signInExternalService,
  signOutExternalService,
  getOfflineCredentials,
  loginOfflineCredentials,
}: ExternalServiceLoginOptions): {
  login: (
    params: ExternalServiceLoginParams,
  ) => Promise<ExternalServiceLoginOutcome>;
} => {
  const loginWithDialNative = useCallback(
    async ({
      appId,
      serviceId,
      popup: reservedPopup,
    }: ExternalServiceLoginParams): Promise<ExternalServiceLoginOutcome> => {
      /* Reserve the popup during the click, before fetching consent and OAuth settings. */
      const popup = reservedPopup ?? openToolsetOAuthPopup();
      if (!popup) return { type: ExternalServiceLoginOutcomeType.PopupBlocked };

      try {
        const service = await getExternalService(appId, serviceId);
        if (service.appLevelAuthStatus !== 'SIGNED_IN') {
          popup.close();
          return {
            type:
              service.appLevelAuthStatus === 'SIGNED_OUT'
                ? ExternalServiceLoginOutcomeType.AdminConsentRequired
                : ExternalServiceLoginOutcomeType.Failure,
          };
        }

        const status = await getOfflineCredentials();
        if (status.connected) {
          popup.close();
          return { type: ExternalServiceLoginOutcomeType.Success };
        }
        if (!status.available || !status.connect) {
          popup.close();
          return { type: ExternalServiceLoginOutcomeType.OfflineUnavailable };
        }

        const outcome = await loginOfflineCredentials(
          status.connect,
          getOfflineCredentials,
          popup,
        );
        if (outcome.type === OfflineCredentialsLoginOutcomeType.Success) {
          const refreshed = await getExternalService(appId, serviceId);
          return {
            type:
              refreshed.appLevelAuthStatus === 'SIGNED_IN'
                ? ExternalServiceLoginOutcomeType.Success
                : refreshed.appLevelAuthStatus === 'SIGNED_OUT'
                  ? ExternalServiceLoginOutcomeType.AdminConsentRequired
                  : ExternalServiceLoginOutcomeType.Failure,
          };
        }
        if (outcome.type === OfflineCredentialsLoginOutcomeType.Cancelled) {
          return { type: ExternalServiceLoginOutcomeType.Cancelled };
        }
        return { type: ExternalServiceLoginOutcomeType.Failure };
      } catch {
        popup.close();
        return { type: ExternalServiceLoginOutcomeType.Failure };
      }
    },
    [loginOfflineCredentials, getExternalService, getOfflineCredentials],
  );

  const logoutLevel = useCallback(
    async (
      appId: string,
      serviceId: string,
      credentialsLevel: ExternalServiceCredentialsLevel,
      authenticationType: Exclude<
        ExternalServiceAuthType,
        ExternalServiceAuthType.DialNative
      >,
    ): Promise<void> => {
      try {
        await signOutExternalService(appId, serviceId, {
          credentialsLevel,
          authenticationType,
        });
      } catch {
        // Best-effort: a failed pre-emptive logout should not block the retry.
      }
    },
    [signOutExternalService],
  );

  const loginWithOAuth = useCallback(
    async (
      params: ExternalServiceLoginParams,
    ): Promise<ExternalServiceLoginOutcome> => {
      const {
        appId,
        serviceId,
        credentialsLevel,
        oauthSettings,
        forceStale,
        offlineUsageConsent,
        popup: reservedPopup,
      } = params;
      /*
       * The shared OAuth popup/BroadcastChannel utilities (`utils/toolsets.ts`)
       * correlate a flow by a single opaque string id — this composite id is
       * used only as that client-side correlation key, never sent to the BFF
       * (the BFF calls below always take `appId`/`serviceId` separately).
       */
      const correlationId = buildExternalServiceScopeId(appId, serviceId);
      const toolsetLevel = toToolsetCredentialsLevel(credentialsLevel);
      const authFormData = {
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: oauthSettings?.clientId,
        authorizationEndpoint: oauthSettings?.authorizationEndpoint,
        scopes: oauthSettings?.scopes,
        codeChallenge: oauthSettings?.codeChallenge,
        codeChallengeMethod: oauthSettings?.codeChallengeMethod,
      };

      /*
       * The popup must be opened as the very first synchronous statement so
       * the browser still treats it as user-triggered — see
       * `useToolsetLogin.loginWithOAuth`'s identical `forceStale` branch —
       * unless the caller already reserved one during the gesture.
       */
      const popup = reservedPopup ?? openToolsetOAuthPopup();
      if (!popup) {
        return { type: ExternalServiceLoginOutcomeType.PopupBlocked };
      }

      if (forceStale) {
        await logoutLevel(
          appId,
          serviceId,
          credentialsLevel,
          ExternalServiceAuthType.OAuth,
        );
      }

      try {
        const initiation = navigateToolsetOAuthPopup(
          popup,
          authFormData,
          correlationId,
          callbackPath,
          toolsetLevel,
          OAuthResourceKind.ExternalService,
          offlineUsageConsent,
        );

        if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
          return { type: ExternalServiceLoginOutcomeType.Failure };
        }

        const result = await waitForToolsetOAuthResult(
          initiation.popup,
          initiation.flowId,
          {
            toolsetId: correlationId,
            credentialsLevel: toolsetLevel,
            callbackPath: callbackPath,
          },
        );

        if (result.type === ToolsetOAuthResultType.Success) {
          return { type: ExternalServiceLoginOutcomeType.Success };
        }
        if (result.type === ToolsetOAuthResultType.Failure) {
          return { type: ExternalServiceLoginOutcomeType.Failure };
        }

        /*
         * Treat the backend as the final authority if popup tracking or
         * cross-process message delivery ever still reports a false cancel —
         * mirrors `useToolsetLogin`'s identical re-verification.
         */
        try {
          const refreshed = await getExternalService(appId, serviceId);
          const statusField =
            credentialsLevel === ExternalServiceCredentialsLevel.User
              ? refreshed.userLevelAuthStatus
              : refreshed.globalAuthStatus;
          if (statusField === 'SIGNED_IN') {
            return { type: ExternalServiceLoginOutcomeType.Success };
          }
        } catch {
          // Best-effort verification only — a genuine cancel stays silent.
        }
        return { type: ExternalServiceLoginOutcomeType.Cancelled };
      } catch {
        popup.close();
        return { type: ExternalServiceLoginOutcomeType.Failure };
      }
    },
    [logoutLevel, callbackPath, getExternalService],
  );

  const loginWithApiKey = useCallback(
    async (
      params: ExternalServiceLoginParams,
    ): Promise<ExternalServiceLoginOutcome> => {
      const {
        appId,
        serviceId,
        credentialsLevel,
        authenticationType,
        apiKey,
        forceStale,
        offlineUsageConsent,
      } = params;

      if (authenticationType === ExternalServiceAuthType.DialNative) {
        return { type: ExternalServiceLoginOutcomeType.Failure };
      }

      try {
        if (forceStale) {
          await logoutLevel(
            appId,
            serviceId,
            credentialsLevel,
            authenticationType,
          );
        }
        await signInExternalService(appId, serviceId, {
          credentialsLevel,
          authenticationType,
          apiKey: apiKey?.trim(),
          offlineUsageConsent,
        });
        return { type: ExternalServiceLoginOutcomeType.Success };
      } catch {
        return { type: ExternalServiceLoginOutcomeType.Failure };
      }
    },
    [logoutLevel, signInExternalService],
  );

  const login = useCallback(
    (
      params: ExternalServiceLoginParams,
    ): Promise<ExternalServiceLoginOutcome> =>
      params.authenticationType === ExternalServiceAuthType.DialNative
        ? loginWithDialNative(params)
        : params.authenticationType === ExternalServiceAuthType.OAuth
          ? loginWithOAuth(params)
          : loginWithApiKey(params),
    [loginWithDialNative, loginWithOAuth, loginWithApiKey],
  );

  return { login };
};
