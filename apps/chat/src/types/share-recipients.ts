/** Lifecycle of an on-demand recipient-count lookup that gates a "Revoke access" action. */
export enum RecipientsCountStatus {
  /** Nothing requested yet for this resource. */
  Idle = 'idle',
  /** A lookup is in flight. */
  Loading = 'loading',
  /** A count came back and is known exactly. */
  Resolved = 'resolved',
  /** The lookup failed, so the count is unknown. */
  Unknown = 'unknown',
}
