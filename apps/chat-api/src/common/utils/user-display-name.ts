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
