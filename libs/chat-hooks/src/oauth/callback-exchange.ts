import type {
  ExternalServiceSigninBodyDto,
  OfflineCredentialsSigninBodyDto,
  ToolsetLoginBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ExternalServiceAuthType,
  type ExternalServiceCredentialsLevel,
} from '../external-services/useExternalServiceLogin';
import { parseExternalServiceUrl } from '../shared/external-services';
import {
  OAuthResourceKind,
  ToolsetAuthTypes,
  ToolsetOAuthFailureReason,
} from './types';
import type { OAuthExchangeParams } from './useOAuthCallbackCompletion/useOAuthCallbackCompletion';

/**
 * Already-configured DIAL Core sign-in operations the OAuth callback exchange
 * dispatches to, one per {@link OAuthResourceKind}. The host supplies its own
 * adapters (base URL, auth headers and CSRF handling are the host's); the lib
 * never constructs a client. Resolved values are ignored — only a rejection
 * matters, and it reports `ToolsetOAuthFailureReason.LoginRequestFailed`.
 */
export interface OAuthCallbackExchangeOperations {
  /**
   * Exchanges the code for a toolset's credentials. Called for a redirect
   * state whose `resourceKind` is `OAuthResourceKind.Toolset` or absent (states
   * written before the field existed), with the toolset id and the login body.
   */
  loginToolset: (
    toolsetId: string,
    body: ToolsetLoginBodyDto,
  ) => Promise<unknown>;
  /**
   * Exchanges the code for an application's external-service credentials.
   * Called for `OAuthResourceKind.ExternalService` with the `appId` and
   * service id parsed from the stored composite scope id.
   */
  signInExternalService: (
    appId: string,
    serviceId: string,
    body: ExternalServiceSigninBodyDto,
  ) => Promise<unknown>;
  /**
   * Exchanges the code for the user's offline credentials. Called for
   * `OAuthResourceKind.OfflineCredentials`.
   */
  signInOfflineCredentials: (
    body: OfflineCredentialsSigninBodyDto,
  ) => Promise<unknown>;
}

/**
 * Builds the `exchange` callback {@link useOAuthCallbackCompletion} takes,
 * dispatching the authorization code to the sign-in operation for the stored
 * redirect state's resource kind:
 *
 * - `ExternalService` — parses `redirectState.toolsetId` (the composite
 *   `{appId}/external_services/{serviceId}` scope id) back into its parts and
 *   resolves `ToolsetOAuthFailureReason.MissingRedirectState` without calling
 *   anything when it does not parse; otherwise signs in with OAuth at the
 *   stored credentials level and offline-usage consent.
 * - `OfflineCredentials` — signs in with the code and redirect URI only.
 * - `Toolset` or absent — logs the toolset in with OAuth at the stored
 *   credentials level and offline-usage consent.
 *
 * Resolves `null` on success; a rejected operation rejects, which the hook
 * reports as `LoginRequestFailed`. The returned function holds no state, so a
 * host may create it once at module scope or memoize it per render.
 */
export const createOAuthCallbackExchange =
  ({
    loginToolset,
    signInExternalService,
    signInOfflineCredentials,
  }: OAuthCallbackExchangeOperations) =>
  async ({
    code,
    redirectUri,
    credentialsLevel,
    redirectState,
  }: OAuthExchangeParams): Promise<ToolsetOAuthFailureReason | null> => {
    if (redirectState.resourceKind === OAuthResourceKind.ExternalService) {
      /*
       * DIAL's external-service signin takes `appId`/`serviceId` separately
       * and rebuilds the same scope id server-side, so it is parsed back here.
       * External-service OAuth logins only ever use USER or GLOBAL (see
       * `useExternalServiceLogin`) — never `ToolsetCredentialsLevel.App`,
       * which `ExternalServiceCredentialsLevel` has no equivalent for — so the
       * shared 'USER'/'GLOBAL' string values are safe to carry across.
       */
      const parsed = parseExternalServiceUrl(redirectState.toolsetId);
      if (!parsed) {
        return ToolsetOAuthFailureReason.MissingRedirectState;
      }
      await signInExternalService(parsed.appId, parsed.serviceName, {
        credentialsLevel:
          credentialsLevel as string as ExternalServiceCredentialsLevel,
        authenticationType: ExternalServiceAuthType.OAuth,
        code,
        redirectUri,
        /*
         * Decided before the redirect and carried through the popup's
         * redirect state: the exchange happens here, after the round-trip, so
         * this is the only place the user's choice can still be submitted.
         */
        offlineUsageConsent: redirectState.offlineUsageConsent,
      });
      return null;
    }

    if (redirectState.resourceKind === OAuthResourceKind.OfflineCredentials) {
      await signInOfflineCredentials({ code, redirectUri });
      return null;
    }

    await loginToolset(redirectState.toolsetId, {
      url: redirectState.toolsetId,
      credentialsLevel:
        credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
      authenticationType:
        ToolsetAuthTypes.OAuth as ToolsetLoginBodyDto['authenticationType'],
      code,
      redirectUri,
      /* Decided before the redirect — see the external-service branch. */
      offlineUsageConsent: redirectState.offlineUsageConsent,
    });
    return null;
  };
