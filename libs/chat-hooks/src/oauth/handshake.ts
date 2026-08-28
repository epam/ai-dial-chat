import type { ToolsetOAuthChannelMessage, ToolsetOAuthResult } from './models';
import {
  ToolsetCredentialsLevel,
  ToolsetOAuthCallbackQuery,
  ToolsetOAuthChannelControlType,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from './types';

const TOOLSET_OAUTH_CHANNEL_PREFIX = 'toolset-oauth-';

/** Name of the same-origin `BroadcastChannel` shared by an OAuth flow's opener and its callback popup. */
export const getToolsetOAuthChannelName = (flowId: string): string =>
  `${TOOLSET_OAUTH_CHANNEL_PREFIX}${flowId}`;

const DEFAULT_OAUTH_RESULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_OAUTH_POPUP_POLL_INTERVAL_MS = 500;

const getOAuthFailureReason = (
  value: string | null,
): ToolsetOAuthFailureReason => {
  switch (value) {
    case ToolsetOAuthFailureReason.MissingCode:
    case ToolsetOAuthFailureReason.MissingRedirectState:
    case ToolsetOAuthFailureReason.StateMismatch:
    case ToolsetOAuthFailureReason.LoginRequestFailed:
      return value;
    default:
      return ToolsetOAuthFailureReason.LoginRequestFailed;
  }
};

const isToolsetOAuthChannelMessage = (
  value: unknown,
): value is ToolsetOAuthChannelMessage =>
  typeof value === 'object' &&
  value != null &&
  'type' in value &&
  (value.type === ToolsetOAuthResultType.Success ||
    value.type === ToolsetOAuthResultType.Failure);

/** Options for {@link waitForToolsetOAuthResult}. */
export interface WaitForToolsetOAuthResultOptions {
  /** Resource id echoed back in a success result. */
  toolsetId: string;
  /** Credentials level echoed back in a success result. */
  credentialsLevel: ToolsetCredentialsLevel;
  /**
   * The host's callback route — the same path the flow's popup was opened
   * against. The popup-URL reader treats a same-origin URL as a result only
   * when its pathname equals this value, so a host serving more than one
   * callback route passes whichever one it actually opened.
   */
  callbackPath: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Waits for the OAuth callback popup to report a result over BroadcastChannel
 * or through the completion marker in its same-origin URL. A cross-origin
 * provider can make the retained WindowProxy look closed even while the popup
 * remains open, so cancellation is confirmed only when the initiating window
 * regains focus. Reported results are acknowledged so the callback can close
 * itself even when the retained WindowProxy was severed.
 */
export const waitForToolsetOAuthResult = (
  popup: Window,
  flowId: string,
  {
    toolsetId,
    credentialsLevel,
    callbackPath,
    timeoutMs = DEFAULT_OAUTH_RESULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_OAUTH_POPUP_POLL_INTERVAL_MS,
  }: WaitForToolsetOAuthResultOptions,
): Promise<ToolsetOAuthResult> =>
  new Promise((resolve) => {
    let channel: BroadcastChannel | undefined;
    let isSettled = false;

    /*
     * Deferred by a macrotask so an acknowledgement posted immediately before
     * this still reaches the callback popup — closing the channel in the same
     * tick discards it, which would strand a popup whose `WindowProxy` was
     * severed and which therefore relies on that acknowledgement to close
     * itself.
     */
    const closeChannelWhenFlushed = () => {
      const pending = channel;
      channel = undefined;
      if (pending == null) return;
      setTimeout(() => pending.close(), 0);
    };

    const finish = (outcome: ToolsetOAuthResult) => {
      if (isSettled) return;
      isSettled = true;
      clearInterval(pollId);
      clearTimeout(timeoutId);
      window.removeEventListener('focus', handleOpenerFocus);
      closeChannelWhenFlushed();
      resolve(outcome);
    };

    const finishReportedResult = (result: ToolsetOAuthChannelMessage) => {
      channel?.postMessage({
        type: ToolsetOAuthChannelControlType.ResultAcknowledged,
      });
      try {
        popup.close();
      } catch {
        // The result is already consumed; popup cleanup is best-effort.
      }
      finish(result);
    };

    const readResultFromPopupUrl = (): ToolsetOAuthChannelMessage | null => {
      try {
        const popupUrl = new URL(popup.location.href);
        if (
          popupUrl.origin !== window.location.origin ||
          popupUrl.pathname !== callbackPath
        ) {
          return null;
        }

        const result = popupUrl.searchParams.get(
          ToolsetOAuthCallbackQuery.Result,
        );
        if (result === ToolsetOAuthResultType.Success) {
          return {
            type: ToolsetOAuthResultType.Success,
            toolsetId,
            credentialsLevel,
          };
        }
        if (result === ToolsetOAuthResultType.Failure) {
          return {
            type: ToolsetOAuthResultType.Failure,
            reason: getOAuthFailureReason(
              popupUrl.searchParams.get(
                ToolsetOAuthCallbackQuery.FailureReason,
              ),
            ),
          };
        }
      } catch {
        // Cross-origin popup URLs are unreadable until the provider returns.
      }
      return null;
    };

    const handleOpenerFocus = () => {
      const reportedResult = readResultFromPopupUrl();
      if (reportedResult != null) {
        finishReportedResult(reportedResult);
        return;
      }
      if (popup.closed) {
        finish({ type: ToolsetOAuthResultType.Cancelled });
      }
    };

    try {
      channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (!isToolsetOAuthChannelMessage(event.data)) return;
        finishReportedResult(event.data);
      };
    } catch {
      // URL polling is the deterministic fallback when channels are unavailable.
    }
    window.addEventListener('focus', handleOpenerFocus);

    const pollId = setInterval(() => {
      const reportedResult = readResultFromPopupUrl();
      if (reportedResult != null) {
        finishReportedResult(reportedResult);
        return;
      }
    }, pollIntervalMs);

    const timeoutId = setTimeout(() => {
      popup.close();
      finish({ type: ToolsetOAuthResultType.Cancelled });
    }, timeoutMs);

    const reportedResult = readResultFromPopupUrl();
    if (reportedResult != null) finishReportedResult(reportedResult);
  });
