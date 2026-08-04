/*
 * Registered as the sole OAuth redirect_uri for every toolset's IdP client
 * (ROUTES.ToolsetEditorCallback = '/toolset-editor/callback'; also reachable
 * via ROUTES.ToolsetSignIn = '/auth/toolset-signin' — both routes render this
 * component). `initiateOAuthLogin` (apps/chat/src/utils/toolsets.ts) opens
 * this route in a same-origin popup it controls and writes the redirect
 * state into *that popup's own* `sessionStorage` before navigating it to the
 * provider, then this route exposes success/failure through the popup URL and
 * a flow-scoped `BroadcastChannel`.
 */
import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetOAuthCallbackQuery,
} from '../../constants/toolsets';
import type {
  ToolsetOAuthChannelMessage,
  ToolsetOAuthResultAcknowledgement,
  ToolsetRedirectState,
} from '../../models/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetOAuthChannelControlType,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../../models/toolsets';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import { getToolsetOAuthChannelName } from '../../utils/toolsets';

const TOOLSET_OAUTH_RESULT_RETRY_INTERVAL_MS = 500;

const isToolsetOAuthResultAcknowledgement = (
  value: unknown,
): value is ToolsetOAuthResultAcknowledgement =>
  typeof value === 'object' &&
  value != null &&
  'type' in value &&
  value.type === ToolsetOAuthChannelControlType.ResultAcknowledged;

const readRedirectState = (): ToolsetRedirectState | null => {
  const raw = sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ToolsetRedirectState;
  } catch {
    return null;
  }
};

const replacePopupUrl = (url: URL): void => {
  try {
    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}`,
    );
  } catch {
    // BroadcastChannel can still deliver the result if History API is unavailable.
  }
};

/**
 * Writes the result into this same-origin popup's URL and repeats it over the
 * flow channel until the opener confirms consumption. The callback closes
 * itself after that acknowledgement, so a COOP-severed WindowProxy does not
 * leave a successfully completed popup open.
 */
const reportResult = (
  flowId: string | undefined,
  message: ToolsetOAuthChannelMessage,
) => {
  const resultUrl = new URL(window.location.pathname, window.location.origin);
  resultUrl.searchParams.set(ToolsetOAuthCallbackQuery.Result, message.type);
  if (message.type === ToolsetOAuthResultType.Failure) {
    resultUrl.searchParams.set(
      ToolsetOAuthCallbackQuery.FailureReason,
      message.reason,
    );
  }
  replacePopupUrl(resultUrl);

  if (!flowId) {
    window.close();
    return;
  }

  try {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.postMessage(message);
    const retryId = setInterval(() => {
      channel.postMessage(message);
    }, TOOLSET_OAUTH_RESULT_RETRY_INTERVAL_MS);

    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isToolsetOAuthResultAcknowledgement(event.data)) return;
      clearInterval(retryId);
      channel.close();
      window.close();
    };
  } catch {
    // The result remains available in the popup URL.
  }
};

/**
 * This route only ever runs inside the popup window opened by
 * `initiateOAuthLogin` — it never navigates, since the editor/Catalog tab
 * that opened it never navigated away either. It reports success/failure
 * over an acknowledged `BroadcastChannel` plus its own same-origin URL so
 * the initiating tab can refresh even if the first channel event is missed.
 */
const ToolsetAuthCallback: FC = () => {
  const [searchParams] = useSearchParams();
  // Guard against React 18 StrictMode double-invocation of the effect.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const complete = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const redirectState = readRedirectState();
      sessionStorage.removeItem(TOOLSET_REDIRECT_STATE_KEY);
      const flowId = redirectState?.state ?? state ?? undefined;

      /*
       * Remove the one-time authorization code from the address bar/history
       * before making the login request. `reportResult` later replaces this
       * clean URL with the non-secret completion marker.
       */
      replacePopupUrl(
        new URL(window.location.pathname, window.location.origin),
      );

      if (!code || !redirectState?.toolsetId) {
        reportResult(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: !redirectState?.toolsetId
            ? ToolsetOAuthFailureReason.MissingRedirectState
            : ToolsetOAuthFailureReason.MissingCode,
        });
        return;
      }

      if (redirectState.state != null && redirectState.state !== state) {
        reportResult(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: ToolsetOAuthFailureReason.StateMismatch,
        });
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
        reportResult(flowId, {
          type: ToolsetOAuthResultType.Success,
          toolsetId: redirectState.toolsetId,
          credentialsLevel:
            redirectState.credentialsLevel ?? ToolsetCredentialsLevel.User,
        });
      } catch {
        reportResult(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: ToolsetOAuthFailureReason.LoginRequestFailed,
        });
      }
    };

    void complete();
  }, [searchParams]);

  return <RouteFallback />;
};

export default memo(ToolsetAuthCallback);
