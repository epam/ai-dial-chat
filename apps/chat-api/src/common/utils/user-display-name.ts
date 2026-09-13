const UNKNOWN_AUTHOR = 'Unknown Author';

/** Local part of an email address (before `@`), or the original string if it doesn't look like an email. */
const extractNameFromEmail = (value: string): string => {
  const atIndex = value.indexOf('@');
  return atIndex > 0 ? value.slice(0, atIndex) : value;
};

/**
 * Best-effort human-readable name from a session's allowlisted OIDC claims,
 * for display purposes only (e.g. publication request titles) — never for
 * authorization decisions. Prefers `name`, then `preferred_username`, then
 * the local part of `email`, falling back to `'Unknown Author'` to match the
 * legacy frontend's convention (`LEGACY_NEW_REQUEST_BY_UNKNOWN` in
 * `apps/chat/src/components/Chat/Publish/translatePublicationName.ts` on
 * `origin/development`).
 */
export const getUserDisplayName = (claims: Record<string, unknown>): string => {
  const name = claims['name'];
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  const preferredUsername = claims['preferred_username'];
  if (typeof preferredUsername === 'string' && preferredUsername.trim()) {
    return preferredUsername.trim();
  }

  const email = claims['email'];
  if (typeof email === 'string' && email.trim()) {
    return extractNameFromEmail(email.trim());
  }

  return UNKNOWN_AUTHOR;
};

/**
 * The display author to record on a publication: the caller's own submitted
 * value when they supplied one, otherwise their session-derived name.
 *
 * Publish requests may carry an optional `author` so a toolset maintained by a
 * team can be attributed to the team rather than to whoever clicked Publish
 * (GH #8727). A missing, blank, or whitespace-only value is not a choice, so it
 * degrades to exactly the behaviour every caller had before the field existed.
 *
 * This is display text only — DIAL Core still derives the publication's real
 * `author` from the bearer token, so a submitted author changes what is
 * displayed, never who is recorded as having published or what they may do.
 */
export const resolveDisplayAuthor = (
  author: string | undefined,
  claims: Record<string, unknown>,
): string => author?.trim() || getUserDisplayName(claims);
