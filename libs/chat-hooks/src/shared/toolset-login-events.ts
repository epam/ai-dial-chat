/** Detail payload for a successful toolset login, generic over the app's own credentials-level type. */
export interface ToolsetLoginSuccessDetail<T> {
  /** Already-encoded toolset id/url, as passed into `useToolsetLogin`'s `login`. */
  toolsetId: string;
  credentialsLevel: T;
}

const TOOLSET_LOGIN_SUCCESS_EVENT = 'toolset-login-success';

const toolsetLoginEventTarget = new EventTarget();

/**
 * Broadcasts a successful toolset login to any listener within the current
 * window — host-to-host, not `postMessage`, since this notifies other React
 * trees in the same document (e.g. a mounted `AppEditorIframe`), not an
 * embedded cross-origin iframe.
 */
export const emitToolsetLoginSuccess = <T>(
  detail: ToolsetLoginSuccessDetail<T>,
): void => {
  toolsetLoginEventTarget.dispatchEvent(
    new CustomEvent<ToolsetLoginSuccessDetail<T>>(TOOLSET_LOGIN_SUCCESS_EVENT, {
      detail,
    }),
  );
};

/*
 * Subscribes to successful toolset logins broadcast via
 * `emitToolsetLoginSuccess`. Returns an unsubscribe function.
 */
export const subscribeToolsetLoginSuccess = <T>(
  listener: (detail: ToolsetLoginSuccessDetail<T>) => void,
): (() => void) => {
  const handleEvent = (event: Event) => {
    listener((event as CustomEvent<ToolsetLoginSuccessDetail<T>>).detail);
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
