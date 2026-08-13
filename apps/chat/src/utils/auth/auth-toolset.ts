import { isTruthyQuery } from '@/src/utils/app/route';

import {
  ToolsetAuthErrorDetails,
  ToolsetAuthErrorReason,
  ToolsetAuthResultMessage,
} from '@/src/types/toolsets';

import { Routes } from '@/src/constants/routes';
import {
  TOOLSET_AUTH_POPUP_NAME,
  TOOLSET_AUTH_RESULT_MESSAGE_TYPE,
  ToolsetLoginQuery,
} from '@/src/constants/toolsets';

const POPUP_TIMEOUT = 60_000;
const POPUP_POLL_INTERVAL = 300;

const getPopupFeatures = () => {
  const features = {
    popup: 'yes',
    width: 600,
    height: 700,
    left: 0,
    top: 100,
  };

  if (window) {
    features.left = Math.round(
      window.screenX + Math.max(0, (window.outerWidth - features.width) / 2),
    );
    features.top = Math.round(
      window.screenY + Math.max(0, (window.outerHeight - features.height) / 2),
    );
  }

  return Object.entries(features)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
};

const getToolsetAuthErrorMessage = ({
  reason,
  code,
  message,
  traceId,
  uri,
}: ToolsetAuthErrorDetails) =>
  [
    reason ?? ToolsetAuthErrorReason.UnexpectedError,
    code,
    message,
    traceId && `traceId: ${traceId}`,
    uri && `see: ${uri}`,
  ]
    .filter(Boolean)
    .join(' | ');

export class ToolsetAuthError extends Error {
  public readonly details: ToolsetAuthErrorDetails;

  constructor(details: ToolsetAuthErrorDetails = {}) {
    super(getToolsetAuthErrorMessage(details));
    this.name = 'ToolsetAuthError';
    this.details = details;
  }
}

export const isToolsetAuthError = (error: unknown): error is ToolsetAuthError =>
  error instanceof ToolsetAuthError;

const parseAuthErrorReason = (
  value?: string | null,
): ToolsetAuthErrorReason | undefined =>
  Object.values(ToolsetAuthErrorReason).find((reason) => reason === value);

export const isToolsetAuthPopup = () =>
  typeof window !== 'undefined' &&
  !!window.opener &&
  window.opener !== window &&
  window.name === TOOLSET_AUTH_POPUP_NAME;

export const postToolsetAuthResult = (
  result: Omit<ToolsetAuthResultMessage, 'type'>,
): boolean => {
  if (!isToolsetAuthPopup()) return false;

  try {
    const message: ToolsetAuthResultMessage = {
      type: TOOLSET_AUTH_RESULT_MESSAGE_TYPE,
      ...result,
    };
    window.opener.postMessage(message, window.location.origin);
    return true;
  } catch (err) {
    console.error(
      'Could not report the toolset auth result to the opener',
      err,
    );
    return false;
  }
};

/**
 * Opens the login window and waits for its outcome.
 *
 * Resolves `true` when authentication succeeded, `false` when no login window
 * was used at all (the current tab is being redirected instead), and rejects
 * with a {@link ToolsetAuthError} describing why authentication failed.
 */
export const signInToolset = async (
  url: string,
  isSignInInSameWindow?: boolean,
): Promise<boolean> => {
  if (isSignInInSameWindow) {
    window.location.assign(url.toString());
    return Promise.resolve(false);
  }

  const popup = window.open(url, TOOLSET_AUTH_POPUP_NAME, getPopupFeatures());

  if (!popup) {
    console.error('Unable to open popup');
    window.location.assign(url.toString());
    return Promise.resolve(false);
  }

  return await new Promise<boolean>((resolve, reject) => {
    let isSettled = false;
    let timeoutId: number | undefined = undefined;
    let intervalId: number | undefined = undefined;

    const cleanup = () => {
      isSettled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener('message', handleMessage);
    };

    const closePopup = () => {
      try {
        popup.close();
      } catch {
        console.error('Could not close popup');
      }
    };

    const succeed = () => {
      if (isSettled) return;
      cleanup();
      closePopup();
      resolve(true);
    };

    const fail = (details: ToolsetAuthErrorDetails) => {
      if (isSettled) return;
      cleanup();
      const error = new ToolsetAuthError(details);
      console.error(`Toolset sign in failed: ${error.message}`, details);
      closePopup();
      reject(error);
    };

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source && event.source !== popup) return;

      const data = event.data as ToolsetAuthResultMessage | undefined;
      if (data?.type !== TOOLSET_AUTH_RESULT_MESSAGE_TYPE) return;

      if (data.ok) {
        succeed();
      } else {
        fail({
          reason: ToolsetAuthErrorReason.UnexpectedError,
          ...data.error,
        });
      }
    }

    window.addEventListener('message', handleMessage);

    timeoutId = window.setTimeout(() => {
      fail({ reason: ToolsetAuthErrorReason.Timeout });
    }, POPUP_TIMEOUT);

    intervalId = window.setInterval(() => {
      if (popup.closed) {
        fail({ reason: ToolsetAuthErrorReason.WindowClosed });
        return;
      }

      let popupUrl: URL | undefined = undefined;

      try {
        popupUrl = new URL(popup.location.href);
      } catch {
        // cross-origin while the provider's own pages are open - nothing to read
      }

      if (
        popupUrl?.origin !== window.location.origin ||
        popupUrl.pathname !== Routes.ToolsetSignIn
      ) {
        return;
      }

      const params = popupUrl.searchParams;

      const providerError = params.get(ToolsetLoginQuery.Error);

      if (providerError) {
        fail({
          reason: ToolsetAuthErrorReason.ProviderError,
          code: providerError,
          message: params.get(ToolsetLoginQuery.ErrorDescription) ?? undefined,
          uri: params.get(ToolsetLoginQuery.ErrorUri) ?? undefined,
        });
        return;
      }

      const loginCompleteQuery = params.get(ToolsetLoginQuery.LoginComplete);

      if (!loginCompleteQuery) return;

      if (isTruthyQuery(loginCompleteQuery)) {
        succeed();
      } else {
        fail({
          reason:
            parseAuthErrorReason(params.get(ToolsetLoginQuery.Reason)) ??
            ToolsetAuthErrorReason.SignInRequestFailed,
          traceId: params.get(ToolsetLoginQuery.TraceId) ?? undefined,
        });
      }
    }, POPUP_POLL_INTERVAL);
  });
};
