import { ToolsetCredentialsLevel } from '../constants/toolsets';

export interface ToolsetLoginSuccessDetail {
  /** Already-encoded toolset id/url, as passed into `useToolsetLogin`'s `login`. */
  toolsetId: string;
  credentialsLevel: ToolsetCredentialsLevel;
}

const TOOLSET_LOGIN_SUCCESS_EVENT = 'toolset-login-success';

const toolsetLoginEventTarget = new EventTarget();

/**
 * Broadcasts a successful toolset login to any listener within the current
 * window — host-to-host, not `postMessage`, since this notifies other React
 * trees in the same document (e.g. a mounted `AppEditorIframe`), not an
 * embedded cross-origin iframe.
 */
export const emitToolsetLoginSuccess = (
  detail: ToolsetLoginSuccessDetail,
): void => {
  toolsetLoginEventTarget.dispatchEvent(
    new CustomEvent<ToolsetLoginSuccessDetail>(TOOLSET_LOGIN_SUCCESS_EVENT, {
      detail,
    }),
  );
};

/** Subscribes to successful toolset logins broadcast via `emitToolsetLoginSuccess`. Returns an unsubscribe function. */
export const subscribeToolsetLoginSuccess = (
  listener: (detail: ToolsetLoginSuccessDetail) => void,
): (() => void) => {
  const handleEvent = (event: Event) => {
    listener((event as CustomEvent<ToolsetLoginSuccessDetail>).detail);
  };
  toolsetLoginEventTarget.addEventListener(
    TOOLSET_LOGIN_SUCCESS_EVENT,
    handleEvent,
  );
  return () => {
    toolsetLoginEventTarget.removeEventListener(
      TOOLSET_LOGIN_SUCCESS_EVENT,
      handleEvent,
    );
  };
};
