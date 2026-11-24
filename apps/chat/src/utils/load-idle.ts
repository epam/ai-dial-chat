/*
 * Upper bound on how long an idle callback may wait once the page has loaded,
 * so a busy page still reaches the idle point within a couple of seconds.
 */
const IDLE_TIMEOUT_MS = 2000;
/*
 * Delay used where `requestIdleCallback` is unavailable (Safari): the same
 * bound, since `load` fires while a single-page app is still rendering its
 * route, and a short delay would land in the middle of that.
 */
const IDLE_FALLBACK_DELAY_MS = IDLE_TIMEOUT_MS;

let hasReachedLoadIdle = false;
/* Callbacks waiting for the idle point; one scheduler serves all of them. */
const pendingCallbacks = new Set<() => void>();
/* Cancels the running scheduler; `undefined` while none is running. */
let cancelScheduler: (() => void) | undefined;

/** Returns whether the post-load idle point has already been reached. */
export const isAfterLoadIdle = (): boolean => hasReachedLoadIdle;

const reachLoadIdle = () => {
  hasReachedLoadIdle = true;
  cancelScheduler = undefined;
  const callbacks = [...pendingCallbacks];
  pendingCallbacks.clear();
  callbacks.forEach((callback) => callback());
};

const requestIdle = () => {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(reachLoadIdle, {
      timeout: IDLE_TIMEOUT_MS,
    });
    cancelScheduler = () => window.cancelIdleCallback(handle);
  } else {
    const handle = window.setTimeout(reachLoadIdle, IDLE_FALLBACK_DELAY_MS);
    cancelScheduler = () => window.clearTimeout(handle);
  }
};

const startScheduler = () => {
  if (document.readyState === 'complete') {
    requestIdle();
    return;
  }
  window.addEventListener('load', requestIdle, { once: true });
  cancelScheduler = () => window.removeEventListener('load', requestIdle);
};

/**
 * Runs `callback` at the first idle period after the document `load` event,
 * or at once if that point has already passed. Returns a cancel function.
 *
 * Waiting for `load` is what keeps the work out of the first-paint window: an
 * idle callback alone fires during the network waits before the route has
 * rendered, when the main thread is idle but the page is still loading.
 *
 * Every caller shares one `load` listener and one idle callback; the
 * scheduler starts with the first pending callback and stops when the last
 * one is cancelled.
 */
export const scheduleAfterLoadIdle = (callback: () => void): (() => void) => {
  if (hasReachedLoadIdle) {
    callback();
    return () => undefined;
  }

  /* A wrapper keeps two subscriptions of the same function independent. */
  const entry = () => callback();
  pendingCallbacks.add(entry);
  if (cancelScheduler == null) startScheduler();

  return () => {
    pendingCallbacks.delete(entry);
    if (pendingCallbacks.size === 0 && cancelScheduler != null) {
      cancelScheduler();
      cancelScheduler = undefined;
    }
  };
};

/** Test-only: forgets that the post-load idle point was reached. */
export const resetAfterLoadIdleForTests = (): void => {
  cancelScheduler?.();
  cancelScheduler = undefined;
  pendingCallbacks.clear();
  hasReachedLoadIdle = false;
};
