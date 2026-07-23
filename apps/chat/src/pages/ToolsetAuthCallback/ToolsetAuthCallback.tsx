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

/**
 * Reports the OAuth result to the flow-scoped `BroadcastChannel` the opener
 * is waiting on. This popup does not close itself immediately afterwards —
 * the opener closes it once the message is received, so the popup is never
 * observed closed before the message has arrived. `postMessage` determines
 * the eligible destination channels and queues their delivery tasks before
 * returning, so closing only this sender afterwards does not cancel the
 * queued messages. With no `flowId` there is nothing for an opener to
 * receive, so the popup closes itself right away.
 */
const reportResult = (
  flowId: string | undefined,
  message: ToolsetOAuthChannelMessage,
) => {
  if (!flowId) {
    window.close();
    return;
  }
  const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
  channel.postMessage(message);
  channel.close();
};

/**
 * This route only ever runs inside the popup window opened by
 * `initiateOAuthLogin` — it never navigates, since the editor/Catalog tab
 * that opened it never navigated away either. It reports success/failure
 * over a `BroadcastChannel` keyed by the OAuth `state` so that tab can
 * refresh immediately instead of requiring a manual reload, and lets the
 * opener close this window once it has received that report (see
 * `reportResult`).
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
