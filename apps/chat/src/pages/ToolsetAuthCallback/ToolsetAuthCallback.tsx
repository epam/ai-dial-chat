/*
 * Registered as the sole OAuth redirect_uri for every toolset's IdP client
 * (ROUTES.ToolsetEditorCallback = '/toolset-editor/callback' — the enum
 * member name is unchanged; only this file's location moved). That URL
 * cannot change without re-registering every toolset's redirect_uri at its
 * IdP, so this file — not something under pages/AppsEditor/ — is the
 * landing point for BOTH the admin ToolsetEditor/Catalog's own-window
 * redirect flow and the popup-based flow started from the QuickApps iframe
 * embedded in /apps-editor. Both variants carry their handshake state in the
 * OAuth `state` query parameter rather than `sessionStorage`, because
 * `initiateOAuthLogin` opens its window with `noopener`, which severs
 * `sessionStorage` sharing with it regardless of caller. The two branches
 * below are kept structurally separate; see
 * openspec/changes/add-toolset-popup-signin/design.md.
 */
import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { QUICKAPPS_TOOLSET_AUTH_POPUP_NAME } from '../../constants/toolsets';
import { ToolsetEditorI18nKeys } from '../../constants/translation-keys';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import type { ToolsetPopupState } from '../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
} from '../../types/toolsets';
import {
  decodeToolsetPopupState,
  decodeToolsetRedirectState,
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

      const redirectState = state ? decodeToolsetRedirectState(state) : null;

      if (!code || !redirectState) {
        window.close();
        return;
      }

      try {
        const body: ToolsetLoginBodyDto = {
          url: redirectState.toolsetId,
          credentialsLevel:
            redirectState.credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            ToolsetAuthTypes.OAuth as ToolsetLoginBodyDto['authenticationType'],
          code,
          redirectUri: `${window.location.origin}${ROUTES.ToolsetEditorCallback}`,
        };
        await loginToolset(redirectState.toolsetId, body);
      } catch {
        // Swallow — the opener will reflect the not-logged-in state once reopened.
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
