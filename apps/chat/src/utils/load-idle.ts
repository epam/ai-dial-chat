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

/** Returns whether the post-load idle point has already been reached. */
export const isAfterLoadIdle = (): boolean => hasReachedLoadIdle;

/**
 * Runs `callback` at the first idle period after the document `load` event,
 * or at once if that point has already passed. Returns a cancel function.
 *
 * Waiting for `load` is what keeps the work out of the first-paint window: an
 * idle callback alone fires during the network waits before the route has
 * rendered, when the main thread is idle but the page is still loading.
 */
export const scheduleAfterLoadIdle = (callback: () => void): (() => void) => {
  if (hasReachedLoadIdle) {
    callback();
    return () => undefined;
  }

  let isCancelled = false;
  let cancelScheduled: () => void = () => undefined;

  const runWhenIdle = () => {
    if (isCancelled) return;
    const run = () => {
      hasReachedLoadIdle = true;
      if (!isCancelled) callback();
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(run, {
        timeout: IDLE_TIMEOUT_MS,
      });
      cancelScheduled = () => window.cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(run, IDLE_FALLBACK_DELAY_MS);
      cancelScheduled = () => window.clearTimeout(handle);
    }
  };

  if (document.readyState === 'complete') {
    runWhenIdle();
  } else {
    window.addEventListener('load', runWhenIdle, { once: true });
    cancelScheduled = () => window.removeEventListener('load', runWhenIdle);
  }

  return () => {
    isCancelled = true;
    cancelScheduled();
  };
};

/** Test-only: forgets that the post-load idle point was reached. */
export const resetAfterLoadIdleForTests = (): void => {
  hasReachedLoadIdle = false;
};
