export const OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY =
  'chat.auth.overlayAutoSignInAttempt';

const OVERLAY_AUTO_SIGN_IN_ATTEMPT_TTL_MS = 60_000;

interface OverlayAutoSignInAttempt {
  href: string;
  createdAt: number;
}

/**
 * Returns whether an automatic overlay sign-in was already started for `href`
 * within the TTL. A provider that sends the user back still unauthenticated
 * would otherwise loop the iframe, so a fresh record suppresses the next
 * automatic attempt and the manual login gate is shown instead.
 *
 * Storage access is treated as best-effort: a throwing or unparsable read
 * counts as "no attempt recorded", because the record is a safety net rather
 * than the feature itself.
 */
export const hasRecentOverlayAutoSignInAttempt = (href: string): boolean => {
  try {
    const raw = window.sessionStorage.getItem(
      OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY,
    );
    if (!raw) return false;

    const attempt = JSON.parse(raw) as OverlayAutoSignInAttempt;
    const isFresh =
      Date.now() - attempt.createdAt < OVERLAY_AUTO_SIGN_IN_ATTEMPT_TTL_MS;
    return isFresh && attempt.href === href;
  } catch {
    return false;
  }
};

/**
 * Records an automatic overlay sign-in attempt for `href`. A failing write is
 * swallowed so a storage-blocked iframe still signs in — it only loses the
 * loop protection.
 */
export const rememberOverlayAutoSignInAttempt = (href: string): void => {
  try {
    window.sessionStorage.setItem(
      OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY,
      JSON.stringify({ href, createdAt: Date.now() }),
    );
  } catch {
    /* Storage unavailable — proceed without loop protection. */
  }
};
