import type {
  DialToolsetDto,
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback } from 'react';
import { emitToolsetLoginSuccess } from '../../shared/toolset-login-events';
import { waitForToolsetOAuthResult } from '../handshake';
import type { ToolsetOAuthSettings } from '../models';
import {
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
} from '../popup';
import {
  ToolsetAuthStatus,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
} from '../types';

/** Terminal outcome kinds `login` can resolve. */
export enum ToolsetLoginOutcomeType {
  Success = 'success',
  Failure = 'failure',
  PopupBlocked = 'popup-blocked',
  Cancelled = 'cancelled',
}

/** Discriminated outcome of one login attempt. */
export interface ToolsetLoginOutcome {
  /** Which terminal branch the attempt resolved through. */
  type: ToolsetLoginOutcomeType;
}

/** Arguments for one `login` call. */
export interface ToolsetLoginParams {
  /** Already-encoded toolset id/url, as returned by `listToolsets`/`getToolset`. */
  toolsetId: string;
  /** Credentials level the submitted credentials apply to. */
  credentialsLevel: ToolsetCredentialsLevel;
  /** Authentication mechanism the toolset requires. */
  authenticationType: ToolsetAuthTypes;
  /** Required for `ToolsetAuthTypes.ApiKey`. */
  apiKey?: string;
  /** Required for `ToolsetAuthTypes.OAuth`. */
  oauthSettings?: ToolsetOAuthSettings;
  /**
   * Whether the target level's cached status is currently `FAILED` — API key
   * logins log that level out first when true. Ignored when `forceStale` is
   * set, and never consulted for OAuth (OAuth does not log out before
   * retrying).
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

/** Parameters for {@link useToolsetLogin}. */
export interface UseToolsetLoginParams {
  /**
   * The host's OAuth callback route. Resolved against `window.location.origin`
   * for the `redirect_uri`, and compared against the popup's pathname when
   * reading a completion marker out of its URL.
   */
  callbackPath: string;
  /** Submits credentials for one toolset at one credentials level. */
  loginToolset: (
    toolsetId: string,
    body: ToolsetLoginBodyDto,
  ) => Promise<unknown>;
  /** Clears stored credentials for one toolset at one credentials level. */
  logoutToolset: (
    toolsetId: string,
    body: ToolsetLogoutBodyDto,
  ) => Promise<unknown>;
  /** Re-reads a toolset so a reported cancellation can be checked against the backend. */
  getToolset: (toolsetId: string) => Promise<DialToolsetDto>;
}

/** Result returned by {@link useToolsetLogin}. */
export interface UseToolsetLoginResult {
  /** Runs one API-key or OAuth login attempt and resolves its outcome. */
  login: (params: ToolsetLoginParams) => Promise<ToolsetLoginOutcome>;
}

/**
 * Shared toolset API-key/OAuth login orchestration, so no two surfaces fork
 * the popup/`BroadcastChannel` handshake or the stale-credential-clearing
 * rule. Every backend call arrives as an injected callback: the hook
 * constructs no client instance and reads no app context. It resolves an
 * outcome and shows nothing itself — mapping an outcome to notifications is
 * the caller's job.
 */
export const useToolsetLogin = ({
  callbackPath,
  loginToolset,
  logoutToolset,
  getToolset,
}: UseToolsetLoginParams): UseToolsetLoginResult => {
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
    [logoutToolset],
  );

  const loginWithOAuth = useCallback(
    async (params: ToolsetLoginParams): Promise<ToolsetLoginOutcome> => {
      const { toolsetId, credentialsLevel, oauthSettings, forceStale } = params;
      const authSettings: ToolsetOAuthSettings = {
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
              authSettings,
              toolsetId,
              callbackPath,
              credentialsLevel,
            );
          })()
        : initiateOAuthLogin(
            authSettings,
            toolsetId,
            callbackPath,
            credentialsLevel,
          );

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
          callbackPath,
        },
      );

      if (result.type === ToolsetOAuthResultType.Success) {
        emitToolsetLoginSuccess<ToolsetCredentialsLevel>({
          toolsetId,
          credentialsLevel,
        });
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
        if (statusField === ToolsetAuthStatus.SignedIn) {
          emitToolsetLoginSuccess<ToolsetCredentialsLevel>({
            toolsetId,
            credentialsLevel,
          });
          return { type: ToolsetLoginOutcomeType.Success };
        }
      } catch {
        // Best-effort verification only — a genuine cancel stays silent.
      }
      return { type: ToolsetLoginOutcomeType.Cancelled };
    },
    [callbackPath, getToolset, logoutLevel],
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
        emitToolsetLoginSuccess<ToolsetCredentialsLevel>({
          toolsetId,
          credentialsLevel,
        });
        return { type: ToolsetLoginOutcomeType.Success };
      } catch {
        return { type: ToolsetLoginOutcomeType.Failure };
      }
    },
    [loginToolset, logoutLevel],
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
