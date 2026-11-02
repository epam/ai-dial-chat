export const SIGNED_OUT_MARKER_STORAGE_KEY = 'chat.auth.signedOut';

const SIGNED_OUT_MARKER_TTL_MS = 60_000;

/**
 * Records that this tab has just signed out, right before the logout flow
 * reloads the document. The next load reads it once to start Unauthenticated
 * without probing `/auth/me`, a request that can only fail with a 401 then
 * (#9560). A failing write is swallowed — the next load just probes as usual.
 */
export const rememberSignedOut = (): void => {
  try {
    window.sessionStorage.setItem(
      SIGNED_OUT_MARKER_STORAGE_KEY,
      String(Date.now()),
    );
  } catch {
    /* Storage unavailable — the next load probes the session instead. */
  }
};

/**
 * Returns whether this tab signed out within the TTL, and removes the record
 * so only the load that follows the logout skips the session probe. The TTL
 * keeps a record left by a navigation that never landed from hiding a later,
 * valid session. A throwing or unparsable read counts as "not signed out".
 */
export const consumeSignedOut = (): boolean => {
  try {
    const raw = window.sessionStorage.getItem(SIGNED_OUT_MARKER_STORAGE_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(SIGNED_OUT_MARKER_STORAGE_KEY);

    const createdAt = Number(raw);
    return (
      Number.isFinite(createdAt) &&
      Date.now() - createdAt < SIGNED_OUT_MARKER_TTL_MS
    );
  } catch {
    return false;
  }
};
