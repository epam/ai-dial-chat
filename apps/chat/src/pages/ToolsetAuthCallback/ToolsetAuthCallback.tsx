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
 * acknowledges, and `createOAuthCallbackExchange` dispatches the code to the
 * sign-in call for the stored resource kind. All this page owns is the
 * server-api adapters that dispatch calls, the fallback callback route, and
 * what the user sees meanwhile: a polite in-progress status, then a success
 * status or a failure alert, each with a Close button for a popup the opener
 * never acknowledged.
 */
import {
  createOAuthCallbackExchange,
  useOAuthCallbackCompletion,
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
import { signInExternalService } from '../../server-api/external-services';
import { signInOfflineCredentials } from '../../server-api/offline-credentials';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import { getToolsetOAuthFailureMessageKey } from '../../utils/toolsets';

/* Stateless, so built once rather than per render. */
const exchange = createOAuthCallbackExchange({
  loginToolset,
  signInExternalService,
  signInOfflineCredentials,
});

/**
 * Runs inside the popup window the popup login flow opened — it never
 * navigates, since the tab that opened it never navigated away either.
 */
const ToolsetAuthCallback: FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

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
