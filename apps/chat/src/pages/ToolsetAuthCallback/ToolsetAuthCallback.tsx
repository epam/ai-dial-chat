/*
 * Registered as the sole OAuth redirect_uri for every toolset's IdP client
 * (ROUTES.ToolsetEditorCallback = '/toolset-editor/callback'; also reachable
 * via ROUTES.ToolsetSignIn = '/auth/toolset-signin' — both routes render this
 * component). The flow's initiator (`initiateOAuthLogin`, from
 * `@epam/ai-dial-chat-hooks`) opens this route in a same-origin popup it
 * controls and writes the redirect state into *that popup's own*
 * `sessionStorage` before navigating it to the provider;
 * `useOAuthCallbackCompletion` then exposes success/failure through the popup
 * URL and a flow-scoped `BroadcastChannel`, closing the popup once the opener
 * acknowledges. All this page owns is the per-resource-kind dispatch of the
 * exchange call, and what the user sees meanwhile: a polite in-progress
 * status, then a success status or a failure alert, each with a Close button
 * for a popup the opener never acknowledged.
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
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  ElementSize,
  Notification,
  NotificationType,
  NotificationVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../constants/translation-keys';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  signInExternalService,
} from '../../server-api/external-services';
import { signInOfflineCredentials } from '../../server-api/offline-credentials';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import { getToolsetOAuthFailureMessageKey } from '../../utils/toolsets';

/**
 * This route only ever runs inside the popup window the login flow opened —
 * it never navigates, since the editor/Catalog tab that opened it never
 * navigated away either.
 */
const ToolsetAuthCallback: FC = () => {
  const { t } = useTranslation();
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

  const { isInProgress, failureReason } = useOAuthCallbackCompletion({
    searchParams,
    /*
     * Only reached for a redirect state written before `redirectUri` was
     * stored on it; this is the route those older flows registered as their
     * `redirect_uri`.
     */
    callbackPath: ROUTES.ToolsetEditorCallback,
    exchange,
  });

  const handleClose = useCallback(() => {
    window.close();
  }, []);

  if (isInProgress) {
    return (
      <div className="flex size-full items-center justify-center p-4">
        <Spinner ariaLabel={t(ToolsetSigninI18nKeys.CallbackInProgress)} />
      </div>
    );
  }

  /*
   * The hook closes the popup itself once the opener acknowledges the result;
   * this content only stays on screen when no opener is listening any more,
   * so it always offers a way out.
   */
  const closeButton = (
    <Button
      variant={ButtonVariant.Neutral}
      appearance={ButtonAppearance.Outlined}
      size={ElementSize.Small}
      label={t(ButtonsI18nKeys.Close)}
      onClick={handleClose}
    />
  );

  return (
    <div className="flex size-full items-center justify-center p-4">
      <div className="w-full max-w-md">
        {failureReason != null ? (
          <Notification
            variant={NotificationVariant.Error}
            type={NotificationType.SectionMessage}
            title={t(ToolsetSigninI18nKeys.CallbackFailedTitle)}
            message={t(getToolsetOAuthFailureMessageKey(failureReason))}
            action={closeButton}
          />
        ) : (
          <Notification
            variant={NotificationVariant.Success}
            type={NotificationType.SectionMessage}
            message={t(ToolsetSigninI18nKeys.CallbackSuccess)}
            action={closeButton}
          />
        )}
      </div>
    </div>
  );
};

export default memo(ToolsetAuthCallback);
