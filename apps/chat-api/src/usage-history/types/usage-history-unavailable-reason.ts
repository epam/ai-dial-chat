/** Why `GET /api/v1/user/usage/history` returned `available: false`. */
export enum UsageHistoryUnavailableReason {
  /** `ANALYTICS_URL` is unset; no outbound call was made. */
  NotConfigured = 'not_configured',
  /** ADAS timed out, was unreachable, or answered 5xx or another unexpected response. */
  Unavailable = 'unavailable',
  /** ADAS refused the token (401/403), or the caller's view is not row-restricted. */
  Forbidden = 'forbidden',
}
