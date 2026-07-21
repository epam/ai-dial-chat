/*
 * Registered as the sole OAuth redirect_uri for every toolset's IdP client
 * (ROUTES.ToolsetEditorCallback = '/toolset-editor/callback'; also reachable
 * via ROUTES.ToolsetSignIn = '/auth/toolset-signin' — both routes render this
 * component). `initiateOAuthLogin` (apps/chat/src/utils/toolsets.ts) opens
 * this route in a same-origin popup it controls and writes the redirect
 * state into *that popup's own* `sessionStorage` before navigating it to the
 * provider, then this route reports success/failure back over a flow-scoped
 * `BroadcastChannel`.
 */
import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../constants/toolsets';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import type {
  ToolsetOAuthChannelMessage,
  ToolsetRedirectState,
} from '../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../../types/toolsets';
import { getToolsetOAuthChannelName } from '../../utils/toolsets';

const readRedirectState = (): ToolsetRedirectState | null => {
  const raw = sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ToolsetRedirectState;
  } catch {
    return null;
  }
};

/** Gives the browser a tick to flush a just-posted `BroadcastChannel` message to the opener before this popup tears down. */
const CLOSE_DELAY_MS = 50;

/**
 * Posts the OAuth result to the flow-scoped `BroadcastChannel` the opener is
 * waiting on, then closes this popup. The delay before `window.close()`
 * matters: closing immediately after `postMessage` can tear the popup down
 * before the browser hands the message off to the opener's tab, which the
 * opener would otherwise misread as a cancelled flow.
 */
const reportResultAndClose = async (
  flowId: string | undefined,
  message: ToolsetOAuthChannelMessage,
) => {
  if (flowId) {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.postMessage(message);
    channel.close();
  }
  await new Promise((resolve) => setTimeout(resolve, CLOSE_DELAY_MS));
  window.close();
};

/**
 * This route only ever runs inside the popup window opened by
 * `initiateOAuthLogin` — it always closes the window on completion rather
 * than navigating, since the editor/Catalog tab that opened it never
 * navigated away. Before closing, it reports success/failure over a
 * `BroadcastChannel` keyed by the OAuth `state` so that tab can refresh
 * immediately instead of requiring a manual reload.
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

      if (!code || !redirectState?.toolsetId) {
        await reportResultAndClose(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: !redirectState?.toolsetId
            ? ToolsetOAuthFailureReason.MissingRedirectState
            : ToolsetOAuthFailureReason.MissingCode,
        });
        return;
      }

      if (redirectState.state != null && redirectState.state !== state) {
        await reportResultAndClose(flowId, {
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
        await reportResultAndClose(flowId, {
          type: ToolsetOAuthResultType.Success,
          toolsetId: redirectState.toolsetId,
          credentialsLevel:
            redirectState.credentialsLevel ?? ToolsetCredentialsLevel.User,
        });
      } catch {
        await reportResultAndClose(flowId, {
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
