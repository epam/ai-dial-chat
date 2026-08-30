/*
 * Registered as the sole OAuth redirect_uri for every toolset's IdP client
 * (ROUTES.ToolsetEditorCallback = '/toolset-editor/callback'; also reachable
 * via ROUTES.ToolsetSignIn = '/auth/toolset-signin' — both routes render this
 * component). The flow's initiator (`initiateOAuthLogin`, from
 * `@epam/ai-dial-chat-hooks`) opens this route in a same-origin popup it
 * controls and writes the redirect state into *that popup's own*
 * `sessionStorage` before navigating it to the provider;
 * `useOAuthCallbackCompletion` then exposes success/failure through the popup
 * URL and a flow-scoped `BroadcastChannel`. All this page owns is the
 * per-resource-kind dispatch of the exchange call, and what the user sees.
 */
import type { ToolsetLoginBodyDto } from '@epam/ai-dial-chat-api-client';
import {
  OAuthResourceKind,
  parseExternalServiceUrl,
  ToolsetAuthTypes,
  ToolsetOAuthFailureReason,
  useOAuthCallbackCompletion,
  type OAuthExchangeParams,
} from '@epam/ai-dial-chat-hooks';
import type { FC } from 'react';
import { memo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  signInExternalService,
} from '../../server-api/external-services';
import { signInOfflineCredentials } from '../../server-api/offline-credentials';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';

/**
 * This route only ever runs inside the popup window the login flow opened —
 * it never navigates, since the editor/Catalog tab that opened it never
 * navigated away either.
 */
const ToolsetAuthCallback: FC = () => {
  const [searchParams] = useSearchParams();

  const exchange = useCallback(
    async ({
      code,
      redirectUri,
      credentialsLevel,
      redirectState,
    }: OAuthExchangeParams): Promise<ToolsetOAuthFailureReason | null> => {
      if (redirectState.resourceKind === OAuthResourceKind.ExternalService) {
        /*
         * `toolsetId` holds the composite scope id built by
         * `buildExternalServiceScopeId` (`{appId}/external_services/
         * {serviceId}`) — the BFF's signin route takes `appId`/`serviceId`
         * separately and reconstructs this same scope id server-side, so it
         * must be parsed back here. External-service OAuth logins triggered
         * by this app only ever use USER or GLOBAL (see
         * useExternalServiceLogin) — never ToolsetCredentialsLevel.App, which
         * ExternalServiceCredentialsLevel has no equivalent for — so the
         * shared 'USER'/'GLOBAL' string values are safe to carry across the
         * two enums here.
         */
        const parsed = parseExternalServiceUrl(redirectState.toolsetId);
        if (!parsed) {
          return ToolsetOAuthFailureReason.MissingRedirectState;
        }
        await signInExternalService(parsed.appId, parsed.serviceName, {
          credentialsLevel:
            credentialsLevel as unknown as ExternalServiceCredentialsLevel,
          authenticationType: ExternalServiceAuthType.OAuth,
          code,
          redirectUri,
          /*
           * Decided before the redirect, carried through the popup's redirect
           * state: the code exchange happens here, after the round-trip, so
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

      const body: ToolsetLoginBodyDto = {
        url: redirectState.toolsetId,
        credentialsLevel:
          credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
        authenticationType:
          ToolsetAuthTypes.OAuth as ToolsetLoginBodyDto['authenticationType'],
        code,
        redirectUri,
        /* Decided before the redirect; the exchange happens here — see the external-service branch. */
        offlineUsageConsent: redirectState.offlineUsageConsent,
      };
      await loginToolset(redirectState.toolsetId, body);
      return null;
    },
    [],
  );

  useOAuthCallbackCompletion({
    searchParams,
    /*
     * Only reached for a redirect state written before `redirectUri` was
     * stored on it; this is the route those older flows registered as their
     * `redirect_uri`.
     */
    callbackPath: ROUTES.ToolsetEditorCallback,
    exchange,
  });

  return <RouteFallback />;
};

export default memo(ToolsetAuthCallback);
