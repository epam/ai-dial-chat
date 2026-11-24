/*
 * Upper bound on how long an idle callback may wait, so a busy page still
 * reaches the idle point within a couple of seconds.
 */
const IDLE_TIMEOUT_MS = 2000;
/*
 * Delay used where `requestIdleCallback` is unavailable (Safari): the same
 * bound, since a short delay could land in the middle of the route's render.
 */
const IDLE_FALLBACK_DELAY_MS = IDLE_TIMEOUT_MS;
/*
 * How long after `load` to stop waiting for `markFirstScreenRendered`, so a
 * route that never renders a conversation still reaches the idle point.
 */
const FIRST_SCREEN_FALLBACK_MS = 3000;

let hasReachedLoadIdle = false;
let isFirstScreenRendered = false;
/* Callbacks waiting for the idle point; one scheduler serves all of them. */
const pendingCallbacks = new Set<() => void>();
/* Cancels the running scheduler; `undefined` while none is running. */
let cancelScheduler: (() => void) | undefined;
/* Resumes a scheduler that is waiting for the first screen. */
let resumeOnFirstScreen: (() => void) | undefined;

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
    cancelScheduler = () => window.cancelIdleCallback?.(handle);
  } else {
    const handle = window.setTimeout(reachLoadIdle, IDLE_FALLBACK_DELAY_MS);
    cancelScheduler = () => window.clearTimeout(handle);
  }
};

const waitForFirstScreen = () => {
  if (isFirstScreenRendered) {
    requestIdle();
    return;
  }
  const proceed = () => {
    window.clearTimeout(fallback);
    resumeOnFirstScreen = undefined;
    requestIdle();
  };
  const fallback = window.setTimeout(proceed, FIRST_SCREEN_FALLBACK_MS);
  resumeOnFirstScreen = proceed;
  cancelScheduler = () => {
    window.clearTimeout(fallback);
    resumeOnFirstScreen = undefined;
  };
};

const startScheduler = () => {
  if (document.readyState === 'complete') {
    waitForFirstScreen();
    return;
  }
  window.addEventListener('load', waitForFirstScreen, { once: true });
  cancelScheduler = () =>
    window.removeEventListener('load', waitForFirstScreen);
};

/**
 * Records that the route's first screen has committed — the conversation view
 * with its composer or messages. In a single-page app the document `load`
 * event fires while the route is still rendering, so `load` alone let
 * deferred work run inside the render that paints the LCP element.
 */
export const markFirstScreenRendered = (): void => {
  if (isFirstScreenRendered) return;
  isFirstScreenRendered = true;
  resumeOnFirstScreen?.();
};

/**
 * Runs `callback` at the first idle period after both the document `load`
 * event and `markFirstScreenRendered` (or `FIRST_SCREEN_FALLBACK_MS` after
 * `load` when nothing marks a first screen), or at once if that point has
 * already passed. Returns a cancel function.
 *
 * An idle callback alone would fire during the network waits before the
 * route has rendered, when the main thread is idle but the page is still
 * loading.
 *
 * Every caller shares one `load` listener, one first-screen wait and one idle
 * callback; the scheduler starts with the first pending callback and stops
 * when the last one is cancelled.
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

/** Test-only: forgets that the post-load idle point and first screen were reached. */
export const resetAfterLoadIdleForTests = (): void => {
  cancelScheduler?.();
  cancelScheduler = undefined;
  resumeOnFirstScreen = undefined;
  pendingCallbacks.clear();
  hasReachedLoadIdle = false;
  isFirstScreenRendered = false;
};
