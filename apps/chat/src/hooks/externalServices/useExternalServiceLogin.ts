import { useCallback } from 'react';
import {
  OAuthResourceKind,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  WithLogin,
} from '../../constants/toolsets';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  getExternalService,
  signInExternalService,
  signOutExternalService,
} from '../../server-api/external-services';
import { buildExternalServiceScopeId } from '../../utils/external-services';
import {
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  waitForToolsetOAuthResult,
} from '../../utils/toolsets';

/** OAuth client settings needed to build the authorize URL — a subset of an external service's `auth_settings`. */
export interface ExternalServiceOAuthSettings {
  clientId?: string;
  authorizationEndpoint?: string;
  scopes?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export enum ExternalServiceLoginOutcomeType {
  Success = 'success',
  Failure = 'failure',
  PopupBlocked = 'popup-blocked',
  Cancelled = 'cancelled',
}

export type ExternalServiceLoginOutcome = {
  type: ExternalServiceLoginOutcomeType;
};

export interface ExternalServiceLoginParams {
  /** The application's own resource id. */
  appId: string;
  /** The external service id defined in the application's `external_services` config. */
  serviceId: string;
  credentialsLevel: ExternalServiceCredentialsLevel;
  authenticationType: ExternalServiceAuthType;
  /** Required for `ExternalServiceAuthType.ApiKey`. */
  apiKey?: string;
  /** Required for `ExternalServiceAuthType.OAuth`. */
  oauthSettings?: ExternalServiceOAuthSettings;
  /**
   * Always logs out the target level first regardless of any cached status —
   * a Core-pushed `external-service/signin` event is proof credentials may
   * be stale even if a cached read still reports signed in. The signin
   * dialog always passes `true`, mirroring `useToolsetLogin`'s `forceStale`.
   */
  forceStale?: boolean;
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
 */
export const useExternalServiceLogin = (): {
  login: (
    params: ExternalServiceLoginParams,
  ) => Promise<ExternalServiceLoginOutcome>;
} => {
  const logoutLevel = useCallback(
    async (
      appId: string,
      serviceId: string,
      credentialsLevel: ExternalServiceCredentialsLevel,
      authenticationType: ExternalServiceAuthType,
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
    [],
  );

  const loginWithOAuth = useCallback(
    async (
      params: ExternalServiceLoginParams,
    ): Promise<ExternalServiceLoginOutcome> => {
      const { appId, serviceId, credentialsLevel, oauthSettings, forceStale } =
        params;
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
       * `useToolsetLogin.loginWithOAuth`'s identical `forceStale` branch.
       */
      const popup = openToolsetOAuthPopup();
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

      const initiation = navigateToolsetOAuthPopup(
        popup,
        authFormData,
        correlationId,
        toolsetLevel,
        OAuthResourceKind.ExternalService,
      );

      if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
        return { type: ExternalServiceLoginOutcomeType.Failure };
      }

      const result = await waitForToolsetOAuthResult(
        initiation.popup,
        initiation.flowId,
        { toolsetId: correlationId, credentialsLevel: toolsetLevel },
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
    },
    [logoutLevel],
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
      } = params;

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
        });
        return { type: ExternalServiceLoginOutcomeType.Success };
      } catch {
        return { type: ExternalServiceLoginOutcomeType.Failure };
      }
    },
    [logoutLevel],
  );

  const login = useCallback(
    (
      params: ExternalServiceLoginParams,
    ): Promise<ExternalServiceLoginOutcome> =>
      params.authenticationType === ExternalServiceAuthType.OAuth
        ? loginWithOAuth(params)
        : loginWithApiKey(params),
    [loginWithOAuth, loginWithApiKey],
  );

  return { login };
};
