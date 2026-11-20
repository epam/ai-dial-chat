/** Why `GET /api/v1/user/usage/history` returned `available: false`. */
export enum UsageHistoryUnavailableReason {
  /** `ANALYTICS_URL` is unset; no outbound call was made. */
  NotConfigured = 'not_configured',
  /** ADAS timed out, was unreachable, or answered 5xx or another unexpected response. */
  Unavailable = 'unavailable',
  /**
   * ADAS refused the token or the table (401/403/404), or rejected the own-rows
   * filter (400: older than ai-dial-analytics#86, or `user_hash` hidden by a column policy).
   */
  Forbidden = 'forbidden',
  /** A budget was requested, but the caller's ADAS schema has no budget columns. */
  BudgetUnsupported = 'budget_unsupported',
}
