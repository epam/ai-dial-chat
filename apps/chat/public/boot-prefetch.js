/*
 * Starts the GET requests the app awaits before its first screen while the
 * bundle is still downloading, instead of after it has run: the session probe
 * (`/auth/me`) and the two configs the app requests right after it. Without
 * this, every cold load pays the bundle download and these round trips one
 * after the other.
 *
 * Each response is parked on `window.__dialBootPrefetch` by URL, and the
 * generated API client takes it once instead of sending the same request
 * (`createBootPrefetchFetch` in `src/server-api/boot-prefetch.ts`). A response
 * nobody takes within `BOOT_PREFETCH_MAX_AGE_MS` is ignored, and every later
 * request goes to the network as usual.
 *
 * A classic script kept in `public/` like `theme-init.js`, inlined into the
 * head by the production build and allowed by chat-api by its hash. It cannot
 * import anything, so the names it shares with the app are spelled out here
 * and checked by `src/server-api/tests/boot-prefetch.spec.ts`: the URLs
 * (`BOOT_PREFETCH_URLS`), `window.__dialBootPrefetch`
 * (`BOOT_PREFETCH_GLOBAL`) and `chat.auth.signedOut`
 * (`SIGNED_OUT_MARKER_STORAGE_KEY`), whose 60 s window matches
 * `SIGNED_OUT_MARKER_TTL_MS`.
 */
(() => {
  try {
    /* The load right after a logout skips the session probe (#9560); its
     * requests could only answer 401. */
    const signedOutAt = Number(
      window.sessionStorage.getItem('chat.auth.signedOut'),
    );
    if (signedOutAt && Date.now() - signedOutAt < 60000) return;

    const responses = {};
    [
      '/api/v1/auth/me',
      '/api/v1/client-config?appId=ai-dial-chat',
      '/api/v1/user-config',
    ].forEach((url) => {
      responses[url] = fetch(url, {
        credentials: 'include',
        cache: 'no-store',
      });
      /* Keeps a failed request that nobody takes from logging an unhandled
       * rejection; the taker still sees the rejection. */
      responses[url].catch(() => undefined);
    });
    window.__dialBootPrefetch = {
      startedAt: performance.now(),
      responses: responses,
    };
  } catch {
    /* No fetch or storage: the app sends these requests itself. */
  }
})();
