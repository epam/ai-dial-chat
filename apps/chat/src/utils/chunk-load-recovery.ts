export const CHUNK_RELOAD_STORAGE_KEY = 'chat.chunkReload.lastAttempt';

/*
 * A reload that still cannot load the chunk (server down, asset genuinely
 * missing) must surface the error rather than reload forever.
 */
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

const readLastAttempt = (): number => {
  try {
    return Number(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const rememberAttempt = (now: number): boolean => {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    return true;
  } catch {
    // Without storage there is no loop guard — let the error surface instead.
    return false;
  }
};

/*
 * A tab opened before a redeploy still references the old content-hashed
 * chunk names; the server no longer has them, so the next lazy route import
 * fails (Firefox: "error loading dynamically imported module", [#9254](https://github.com/epam/ai-dial-chat/issues/9254)).
 * Browsers cache a failed module import for the document's lifetime, so only
 * a reload — which fetches a fresh no-store index.html with the current
 * chunk names — recovers. Vite dispatches `vite:preloadError` for every
 * failed dynamic import it wraps.
 */
export const handleChunkLoadError = (): void => {
  const now = Date.now();
  if (now - readLastAttempt() < CHUNK_RELOAD_COOLDOWN_MS) return;
  if (!rememberAttempt(now)) return;
  window.location.reload();
};

export const registerChunkLoadRecovery = (): (() => void) => {
  window.addEventListener('vite:preloadError', handleChunkLoadError);
  return () =>
    window.removeEventListener('vite:preloadError', handleChunkLoadError);
};
