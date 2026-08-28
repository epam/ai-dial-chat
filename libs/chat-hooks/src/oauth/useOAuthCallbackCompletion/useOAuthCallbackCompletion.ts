import { useEffect, useRef, useState } from 'react';
import { getToolsetOAuthChannelName } from '../handshake';
import type {
  ToolsetOAuthChannelMessage,
  ToolsetOAuthResultAcknowledgement,
  ToolsetRedirectState,
} from '../models';
import {
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetCredentialsLevel,
  ToolsetOAuthCallbackQuery,
  ToolsetOAuthChannelControlType,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../types';

const OAUTH_RESULT_RETRY_INTERVAL_MS = 500;

/** Arguments handed to the host's exchange callback. */
export interface OAuthExchangeParams {
  /** One-time authorization code the provider returned. */
  code: string;
  /** Redirect URI the code was issued against, to be echoed back to the backend. */
  redirectUri: string;
  /** Credentials level resolved from the stored redirect state. */
  credentialsLevel: ToolsetCredentialsLevel;
  /** The full redirect state the flow stored before navigating to the provider. */
  redirectState: ToolsetRedirectState;
}

/** Parameters for {@link useOAuthCallbackCompletion}. */
export interface UseOAuthCallbackCompletionParams {
  /**
   * Query parameters of the callback URL. Read once per mount; the hook takes
   * `code` and `state` from it.
   */
  searchParams: URLSearchParams;
  /**
   * Path used to build the `redirect_uri` echoed back to the backend when the
   * stored redirect state carries none — every state written by the current
   * flow does, so this only covers states written before that field existed.
   */
  callbackPath: string;
  /**
   * Performs the code-for-credentials exchange. Resolving `null` reports
   * success; resolving a failure reason reports that reason (for a host-side
   * validation the hook cannot perform, such as an unparseable resource id);
   * rejecting reports `LoginRequestFailed`.
   */
  exchange: (
    params: OAuthExchangeParams,
  ) => Promise<ToolsetOAuthFailureReason | null>;
}

/** State {@link useOAuthCallbackCompletion} exposes for the host page to render. */
export interface UseOAuthCallbackCompletionResult {
  /** True until the flow has reported an outcome. */
  isInProgress: boolean;
  /** Reason the flow failed, or `null` while in progress or on success. */
  failureReason: ToolsetOAuthFailureReason | null;
}

const isResultAcknowledgement = (
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
    // BroadcastChannel can still deliver the result if the History API is unavailable.
  }
};

/**
 * Writes the result into this same-origin popup's URL and repeats it over the
 * flow channel until the opener confirms consumption. The callback closes
 * itself after that acknowledgement, so a COOP-severed `WindowProxy` does not
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
    }, OAUTH_RESULT_RETRY_INTERVAL_MS);

    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isResultAcknowledgement(event.data)) return;
      clearInterval(retryId);
      channel.close();
      window.close();
    };
  } catch {
    // The result remains available in the popup URL.
  }
};

/**
 * Completes an OAuth authorization-code flow from inside the callback popup:
 * reads and clears the redirect state written into this popup's own
 * `sessionStorage`, scrubs the authorization code from the visible URL before
 * any request, validates the returned `state`, performs the exchange through
 * the injected callback, then reports the outcome into the popup URL and over
 * the flow channel until acknowledged, closing the popup afterwards. Runs its
 * effect once per mount even under StrictMode double-invocation. Renders
 * nothing and produces no user-visible text — the host page presents and
 * announces the returned state in its own language.
 */
export const useOAuthCallbackCompletion = ({
  searchParams,
  callbackPath,
  exchange,
}: UseOAuthCallbackCompletionParams): UseOAuthCallbackCompletionResult => {
  const [isInProgress, setIsInProgress] = useState(true);
  const [failureReason, setFailureReason] =
    useState<ToolsetOAuthFailureReason | null>(null);

  /* Guard against StrictMode double-invocation of the effect. */
  const hasRun = useRef(false);
  const exchangeRef = useRef(exchange);
  exchangeRef.current = exchange;
  const callbackPathRef = useRef(callbackPath);
  callbackPathRef.current = callbackPath;

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const settle = (
      flowId: string | undefined,
      message: ToolsetOAuthChannelMessage,
    ) => {
      reportResult(flowId, message);
      setIsInProgress(false);
      setFailureReason(
        message.type === ToolsetOAuthResultType.Failure ? message.reason : null,
      );
    };

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
        settle(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: !redirectState?.toolsetId
            ? ToolsetOAuthFailureReason.MissingRedirectState
            : ToolsetOAuthFailureReason.MissingCode,
        });
        return;
      }

      if (redirectState.state != null && redirectState.state !== state) {
        settle(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: ToolsetOAuthFailureReason.StateMismatch,
        });
        return;
      }

      const credentialsLevel =
        redirectState.credentialsLevel ?? ToolsetCredentialsLevel.User;
      const redirectUri =
        redirectState.redirectUri ??
        `${window.location.origin}${callbackPathRef.current}`;

      try {
        const reason = await exchangeRef.current({
          code,
          redirectUri,
          credentialsLevel,
          redirectState,
        });
        if (reason != null) {
          settle(flowId, {
            type: ToolsetOAuthResultType.Failure,
            reason,
          });
          return;
        }

        settle(flowId, {
          type: ToolsetOAuthResultType.Success,
          toolsetId: redirectState.toolsetId,
          credentialsLevel,
        });
      } catch {
        settle(flowId, {
          type: ToolsetOAuthResultType.Failure,
          reason: ToolsetOAuthFailureReason.LoginRequestFailed,
        });
      }
    };

    void complete();
  }, [searchParams]);

  return { isInProgress, failureReason };
};
