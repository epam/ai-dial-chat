import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/chat-api-client';
import { useCallback } from 'react';
import {
  getToolset,
  loginToolset,
  logoutToolset,
} from '../../server-api/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  WithLogin,
} from '../../types/toolsets';
import {
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  waitForToolsetOAuthResult,
} from '../../utils/toolsets';

/** OAuth client settings needed to build the authorize URL — a subset of a toolset's `authSettings`. */
export interface ToolsetOAuthSettings {
  clientId?: string;
  authorizationEndpoint?: string;
  scopes?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export enum ToolsetLoginOutcomeType {
  Success = 'success',
  Failure = 'failure',
  PopupBlocked = 'popup-blocked',
  Cancelled = 'cancelled',
}

export type ToolsetLoginOutcome = { type: ToolsetLoginOutcomeType };

export interface ToolsetLoginParams {
  /** Already-encoded toolset id/url, as returned by `listToolsets`/`getToolset`. */
  toolsetId: string;
  credentialsLevel: ToolsetCredentialsLevel;
  authenticationType: ToolsetAuthTypes;
  /** Required for `ToolsetAuthTypes.ApiKey`. */
  apiKey?: string;
  /** Required for `ToolsetAuthTypes.OAuth`. */
  oauthSettings?: ToolsetOAuthSettings;
  /**
   * Whether the target level's cached status is currently `FAILED` — API key
   * logins log out that level first when true. Ignored when `forceStale` is
   * set. Not consulted for OAuth, matching the existing Catalog behavior
   * (OAuth never logs out before retrying).
   */
  isCurrentlyFailed?: boolean;
  /**
   * Always logs out the target level first (for both API key and OAuth)
   * regardless of the cached status — set by callers reacting to a
   * DIAL-Core-pushed `toolset/signin` event, which is proof the cached
   * status may be stale even when it still reads `SIGNED_IN`.
   */
  forceStale?: boolean;
}

/**
 * Shared toolset API-key/OAuth login orchestration used by both the Catalog
 * details panel and the chat-completion toolset sign-in dialog, so the two
 * surfaces never fork the popup/BroadcastChannel handshake or the
 * stale-credential-clearing rule.
 */
export const useToolsetLogin = (): {
  login: (params: ToolsetLoginParams) => Promise<ToolsetLoginOutcome>;
} => {
  const logoutLevel = useCallback(
    async (
      toolsetId: string,
      credentialsLevel: ToolsetCredentialsLevel,
      authenticationType: ToolsetAuthTypes,
    ): Promise<void> => {
      try {
        await logoutToolset(toolsetId, {
          url: toolsetId,
          credentialsLevel:
            credentialsLevel as ToolsetLogoutBodyDto['credentialsLevel'],
          authenticationType:
            authenticationType as ToolsetLogoutBodyDto['authenticationType'],
        });
      } catch {
        // Best-effort: a failed pre-emptive logout should not block the retry.
      }
    },
    [],
  );

  const loginWithOAuth = useCallback(
    async (params: ToolsetLoginParams): Promise<ToolsetLoginOutcome> => {
      const { toolsetId, credentialsLevel, oauthSettings, forceStale } = params;
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
       * When a pre-emptive logout is needed, the popup must still be opened
       * as the first, fully synchronous statement so the browser treats it
       * as user-triggered — `initiateOAuthLogin` does that internally, but
       * only when it runs with no `await` ahead of it. Opening the popup
       * blank first and navigating it after the logout (via
       * `navigateToolsetOAuthPopup`) preserves that guarantee even though a
       * network call now has to happen before the provider URL is known.
       */
      const initiation = forceStale
        ? await (async () => {
            const popup = openToolsetOAuthPopup();
            if (!popup) {
              return {
                type: ToolsetOAuthInitiationResultType.Blocked,
              } as const;
            }
            await logoutLevel(
              toolsetId,
              credentialsLevel,
              ToolsetAuthTypes.OAuth,
            );
            return navigateToolsetOAuthPopup(
              popup,
              authFormData,
              toolsetId,
              credentialsLevel,
            );
          })()
        : initiateOAuthLogin(authFormData, toolsetId, credentialsLevel);

      if (initiation.type === ToolsetOAuthInitiationResultType.Blocked) {
        return { type: ToolsetLoginOutcomeType.PopupBlocked };
      }
      if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
        return { type: ToolsetLoginOutcomeType.Failure };
      }

      const result = await waitForToolsetOAuthResult(
        initiation.popup,
        initiation.flowId,
        {
          toolsetId,
          credentialsLevel,
        },
      );

      if (result.type === ToolsetOAuthResultType.Success) {
        return { type: ToolsetLoginOutcomeType.Success };
      }
      if (result.type === ToolsetOAuthResultType.Failure) {
        return { type: ToolsetLoginOutcomeType.Failure };
      }

      /*
       * Treat the backend as the final authority if popup tracking or
       * cross-process message delivery ever still reports a false cancel.
       * This avoids reporting cancellation for a login that actually
       * completed server-side.
       */
      try {
        const refreshed = await getToolset(toolsetId);
        const statusField =
          credentialsLevel === ToolsetCredentialsLevel.User
            ? refreshed.authSettings?.userLevelAuthStatus
            : refreshed.authSettings?.globalAuthStatus;
        if (statusField === 'SIGNED_IN') {
          return { type: ToolsetLoginOutcomeType.Success };
        }
      } catch {
        // Best-effort verification only — a genuine cancel stays silent.
      }
      return { type: ToolsetLoginOutcomeType.Cancelled };
    },
    [logoutLevel],
  );

  const loginWithApiKey = useCallback(
    async (params: ToolsetLoginParams): Promise<ToolsetLoginOutcome> => {
      const {
        toolsetId,
        credentialsLevel,
        authenticationType,
        apiKey,
        isCurrentlyFailed,
        forceStale,
      } = params;

      try {
        if (forceStale || isCurrentlyFailed) {
          await logoutLevel(toolsetId, credentialsLevel, authenticationType);
        }
        const body: ToolsetLoginBodyDto = {
          url: toolsetId,
          credentialsLevel:
            credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            authenticationType as ToolsetLoginBodyDto['authenticationType'],
          apiKey: apiKey?.trim(),
        };
        await loginToolset(toolsetId, body);
        return { type: ToolsetLoginOutcomeType.Success };
      } catch {
        return { type: ToolsetLoginOutcomeType.Failure };
      }
    },
    [logoutLevel],
  );

  const login = useCallback(
    (params: ToolsetLoginParams): Promise<ToolsetLoginOutcome> =>
      params.authenticationType === ToolsetAuthTypes.OAuth
        ? loginWithOAuth(params)
        : loginWithApiKey(params),
    [loginWithOAuth, loginWithApiKey],
  );

  return { login };
};
