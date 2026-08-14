/** Lifecycle of the on-demand recipient-count lookup that gates "Revoke access" in the details panel's Manage menu. */
export enum RecipientsCountStatus {
  /** Nothing requested yet — the Manage menu has not been opened or focused. */
  Idle = 'idle',
  /** A lookup is in flight. */
  Loading = 'loading',
  /** A count came back and is known exactly. */
  Resolved = 'resolved',
  /** The lookup finished without a count (host returned `undefined` or rejected). */
  Unknown = 'unknown',
}
