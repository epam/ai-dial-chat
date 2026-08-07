export interface SessionPayload {
  /** Schema version — always 1 */
  v: 1;
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
  /** Refresh-token expiry — Unix timestamp (seconds) */
  rt_exp: number;
  /** Cookie issue time — Unix timestamp (seconds) */
  iat: number;
  /** CSRF token — random UUID created on login and kept stable across refresh */
  csrf: string;
  /** Filtered OIDC claims stored for the UI (allowlist only) */
  claims: Record<string, unknown>;
  /** DIAL Core bucket assigned to this user — empty string means not yet resolved (will be lazily fetched on first authenticated request) */
  bucket: string;
}

export interface SessionUser {
  /** Present only for cookie-authenticated callers — no session is created for header auth. */
  sid?: string;
  sub: string;
  providerId: string;
  /**
   * Allowlisted OIDC claims, keyed by claim name. A provider's `rolesClaim`
   * config value is used verbatim as the key here even when it looks like a
   * dot-notation path (e.g. `"realm_access.roles"` from an access token) —
   * it is stored as one flat key equal to that literal string, never as a
   * nested object. Always read it back with `claims[rolesClaim]`, not a
   * nested path lookup.
   */
  claims: Record<string, unknown>;
  at: string;
  bucket: string;
  /** Present only for cookie-authenticated callers — CsrfGuard never checks it for header auth. */
  csrf?: string;
}
