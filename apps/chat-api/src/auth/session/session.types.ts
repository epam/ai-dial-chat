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
  sid: string;
  sub: string;
  providerId: string;
  claims: Record<string, unknown>;
  at: string;
  bucket: string;
  csrf: string;
}
