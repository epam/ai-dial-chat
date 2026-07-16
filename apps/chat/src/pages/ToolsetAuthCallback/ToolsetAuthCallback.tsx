/*
 * Registered as the sole OAuth redirect_uri for every toolset's IdP client
 * (ROUTES.ToolsetEditorCallback = '/toolset-editor/callback' — the enum
 * member name is unchanged; only this file's location moved). That URL
 * cannot change without re-registering every toolset's redirect_uri at its
 * IdP, so this file — not something under pages/AppsEditor/ — is the
 * landing point for BOTH the admin ToolsetEditor/Catalog's own-window
 * redirect flow and the popup-based flow started from the QuickApps iframe
 * embedded in /apps-editor.
 *
 * The two flows carry their handshake state differently and are kept
 * structurally separate; see openspec/changes/add-toolset-popup-signin/design.md:
 * - Admin flow: `initiateOAuthLogin` opens this route in a same-origin popup
 *   it controls and writes the redirect state into *that popup's own*
 *   `sessionStorage` before navigating it to the provider, then this route
 *   reports success/failure back over a flow-scoped `BroadcastChannel`.
 * - QuickApps popup flow: this app never initiates that OAuth request, so it
 *   has no popup to write into ahead of time — the iframe's own caller
 *   encodes its handshake state directly into the OAuth `state` query
 *   parameter, which this route only decodes and validates.
 */
import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  QUICKAPPS_TOOLSET_AUTH_POPUP_NAME,
  TOOLSET_REDIRECT_STATE_KEY,
} from '../../constants/toolsets';
import { ToolsetEditorI18nKeys } from '../../constants/translation-keys';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import type {
  ToolsetOAuthChannelMessage,
  ToolsetPopupState,
  ToolsetRedirectState,
} from '../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../../types/toolsets';
import {
  decodeToolsetPopupState,
  getToolsetOAuthChannelName,
} from '../../utils/toolsets';

interface ToolsetLoginCompleteMessage {
  type: 'quickapps/TOOLSET_LOGIN_COMPLETE';
  payload: {
    toolsetId: string;
    credentialsLevel: ToolsetCredentialsLevel;
    success: boolean;
  };
}

const isQuickAppsPopup = (): boolean =>
  !!window.opener &&
  window.opener !== window &&
  window.name === QUICKAPPS_TOOLSET_AUTH_POPUP_NAME;

const readRedirectState = (): ToolsetRedirectState | null => {
  const raw = sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ToolsetRedirectState;
  } catch {
    return null;
  }
};

/** Posts the OAuth result to the flow-scoped `BroadcastChannel` the opener is waiting on. */
const reportAdminResult = (
  flowId: string | undefined,
  message: ToolsetOAuthChannelMessage,
) => {
  if (!flowId) return;
  const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
  channel.postMessage(message);
  channel.close();
};

/*
 * Completes the popup-based login handshake for a QuickApps iframe caller.
 * This path must stay structurally separate from the admin `state`-decoding
 * branch below — see design.md "Risks" for why the two must never call into
 * each other.
 */
const completePopupLogin = async (
  code: string | null,
  popupState: ToolsetPopupState,
): Promise<void> => {
  let success = false;
  if (code) {
    try {
      const body: ToolsetLoginBodyDto = {
        url: popupState.toolsetId,
        credentialsLevel:
          popupState.credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
        authenticationType:
          ToolsetAuthTypes.OAuth as ToolsetLoginBodyDto['authenticationType'],
        code,
        redirectUri: `${window.location.origin}${ROUTES.ToolsetEditorCallback}`,
      };
      await loginToolset(popupState.toolsetId, body);
      success = true;
    } catch {
      success = false;
    }
  }

  const message: ToolsetLoginCompleteMessage = {
    type: 'quickapps/TOOLSET_LOGIN_COMPLETE',
    payload: {
      toolsetId: popupState.toolsetId,
      credentialsLevel: popupState.credentialsLevel,
      success,
    },
  };
  window.opener?.postMessage(message, popupState.originatingOrigin);
  window.close();
};

const ToolsetAuthCallback: FC = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  // Guard against React 18 StrictMode double-invocation of the effect.
  const hasRun = useRef(false);
  const [showPopupFallback, setShowPopupFallback] = useState(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const complete = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (isQuickAppsPopup()) {
        const popupState = state ? decodeToolsetPopupState(state) : null;
        if (!popupState) {
          setShowPopupFallback(true);
          return;
        }
        await completePopupLogin(code, popupState);
        return;
      }

      const redirectState = readRedirectState();
      sessionStorage.removeItem(TOOLSET_REDIRECT_STATE_KEY);
      const flowId = redirectState?.state ?? state ?? undefined;

      if (!code || !redirectState?.toolsetId) {
        reportAdminResult(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: !redirectState?.toolsetId
            ? ToolsetOAuthFailureReason.MissingRedirectState
            : ToolsetOAuthFailureReason.MissingCode,
        });
        window.close();
        return;
      }

      if (redirectState.state != null && redirectState.state !== state) {
        reportAdminResult(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: ToolsetOAuthFailureReason.StateMismatch,
        });
        window.close();
        return;
      }

      try {
        const body: ToolsetLoginBodyDto = {
          url: redirectState.toolsetId,
          credentialsLevel: (redirectState.credentialsLevel ??
            ToolsetCredentialsLevel.User) as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            ToolsetAuthTypes.OAuth as ToolsetLoginBodyDto['authenticationType'],
          code,
          redirectUri:
            redirectState.redirectUri ??
            `${window.location.origin}${ROUTES.ToolsetEditorCallback}`,
        };
        await loginToolset(redirectState.toolsetId, body);
        reportAdminResult(flowId, {
          type: ToolsetOAuthResultType.Success,
          toolsetId: redirectState.toolsetId,
          credentialsLevel:
            redirectState.credentialsLevel ?? ToolsetCredentialsLevel.User,
        });
      } catch {
        reportAdminResult(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: ToolsetOAuthFailureReason.LoginRequestFailed,
        });
      } finally {
        window.close();
      }
    };

    void complete();
  }, [searchParams]);

  if (showPopupFallback) {
    return <div>{t(ToolsetEditorI18nKeys.PopupCloseFallback)}</div>;
  }

  return <RouteFallback />;
};

export default memo(ToolsetAuthCallback);
