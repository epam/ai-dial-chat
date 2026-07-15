import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../constants/toolsets';
import { loginToolset } from '../../server-api/toolsets';
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

/** Posts the OAuth result to the flow-scoped `BroadcastChannel` the opener is waiting on. */
const reportResult = (
  flowId: string | undefined,
  message: ToolsetOAuthChannelMessage,
) => {
  if (!flowId) return;
  const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
  channel.postMessage(message);
  channel.close();
};

/**
 * This route only ever runs inside the popup window opened by
 * `initiateOAuthLogin` — it always closes the window on completion rather
 * than navigating, since the editor/Catalog tab that opened it never
 * navigated away. Before closing, it reports success/failure over a
 * `BroadcastChannel` keyed by the OAuth `state` so that tab can refresh
 * immediately instead of requiring a manual reload.
 */
const ToolsetEditorCallback: FC = () => {
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
        window.close();
        return;
      }

      if (redirectState.state != null && redirectState.state !== state) {
        reportResult(flowId, {
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
            `${window.location.origin}${window.location.pathname}`,
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
      } finally {
        window.close();
      }
    };

    void complete();
  }, [searchParams]);

  return <RouteFallback />;
};

export default memo(ToolsetEditorCallback);
