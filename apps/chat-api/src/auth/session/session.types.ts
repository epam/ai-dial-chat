export interface SessionPayload {
  /** Schema version — v1 sessions require a new login. */
  v: 2;
  /** Unique session ID (UUID) */
  sid: string;
  /** Registered provider ID */
  providerId: string;
  /** OIDC subject (user identifier) */
  sub: string;
  /** Access token (or JSON-serialised transaction payload before auth completes) */
  at: string;
  /** Refresh token */
  rt: string;
  /** ID token (used for RP-initiated logout) */
  it?: string;
  /** Access-token expiry — Unix timestamp (seconds) */
  at_exp: number;
  /** Rolling session expiry, renewed after a successful refresh — Unix seconds. */
  session_exp: number;
  /** Provider-reported refresh-token expiry, when known — Unix seconds. */
  rt_exp?: number;
  /** Cookie issue time — Unix timestamp (seconds) */
  iat: number;
  /** CSRF token — random UUID created on login and kept stable across refresh */
  csrf: string;
  /** Filtered OIDC claims stored for the UI (allowlist only) */
  claims: Record<string, unknown>;
  /** DIAL Core bucket assigned to this user — empty string means not yet resolved (will be lazily fetched on first authenticated request) */
  bucket: string;
  /** Set when the IdP supplied an inline (`data:`) picture; the image is served by `GET /api/v1/auth/me/picture`, never stored here. */
  pic?: true;
}

/** Claim key the `job_title` OIDC claim (when allowlisted) is stored under. */
export const JOB_TITLE_CLAIM = 'job_title';

/**
 * Reads the `job_title` claim out of a claims record, if it is a string that
 * is non-empty after trimming. Empty, whitespace-only, and non-string values
 * yield `undefined` so they are neither stored in the session nor forwarded.
 */
export const getJobTitleClaim = (
  claims: Record<string, unknown> | undefined,
): string | undefined => {
  const value = claims?.[JOB_TITLE_CLAIM];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

/** Claim key the OIDC `picture` (profile avatar URL) claim is stored under. */
export const PICTURE_CLAIM = 'picture';

/**
 * Reads the `picture` claim out of a claims record, if it is an absolute
 * `http(s)` URL. Anything else yields `undefined` so the UI falls back to
 * initials instead of rendering an unusable image source.
 */
export const getPictureClaim = (
  claims: Record<string, unknown> | undefined,
): string | undefined => {
  const value = claims?.[PICTURE_CLAIM];
  if (typeof value !== 'string') return undefined;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'https:' || protocol === 'http:'
      ? value.trim()
      : undefined;
  } catch {
    return undefined;
  }
};

/** Raster image types an inline `picture` may carry; SVG is excluded because it can run script. */
export enum InlinePictureType {
  Jpeg = 'image/jpeg',
  Png = 'image/png',
  Gif = 'image/gif',
  Webp = 'image/webp',
}

/** Largest decoded inline picture the BFF serves (256 KiB). */
export const MAX_INLINE_PICTURE_BYTES = 256 * 1024;

const INLINE_PICTURE_PATTERN =
  /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export interface InlinePicture {
  contentType: InlinePictureType;
  data: Buffer;
}

/**
 * Decodes a `picture` claim that carries the image itself as a base64
 * `data:` URL (some Keycloak realms do this in UserInfo). Only raster types
 * up to `MAX_INLINE_PICTURE_BYTES` are accepted; anything else yields
 * `undefined`. Such a picture is never stored in the session cookie — it is
 * served by `GET /api/v1/auth/me/picture` instead.
 */
export const parseInlinePicture = (
  claims: Record<string, unknown> | undefined,
): InlinePicture | undefined => {
  const value = claims?.[PICTURE_CLAIM];
  if (typeof value !== 'string') return undefined;
  const match = INLINE_PICTURE_PATTERN.exec(value.trim());
  if (!match) return undefined;
  const data = Buffer.from(match[2], 'base64');
  if (data.length === 0 || data.length > MAX_INLINE_PICTURE_BYTES) {
    return undefined;
  }
  return { contentType: match[1] as InlinePictureType, data };
};

export interface SessionUser {
  /** Present only for cookie-authenticated callers — no session is created for header auth. */
  sid?: string;
  sub: string;
  providerId: string;
  /**
   * Allowlisted OIDC claims, keyed by claim name. A cookie session stores a
   * provider's `rolesClaim` value under that literal key even when it looks
   * like a dot-notation path (e.g. `"realm_access.roles"`); a header-token
   * session keeps the verified payload, so the same claim stays nested.
   * Read roles through `UserRolesService.getRoles`, which handles both.
   */
  claims: Record<string, unknown>;
  at: string;
  bucket: string;
  /** Present only for cookie-authenticated callers — CsrfGuard never checks it for header auth. */
  csrf?: string;
  /** Whether the session's IdP supplied an inline picture served by `GET /api/v1/auth/me/picture`. */
  hasInlinePicture?: boolean;
}
