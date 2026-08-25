/** Where a lazily-issued publish-history lookup currently stands. */
export enum PublishHistoryStatus {
  /** No lookup has been requested for this resource yet. */
  Idle = 'idle',
  /** A lookup is in flight. */
  Loading = 'loading',
  /** The lookup succeeded; the folder list is known (possibly empty). */
  Resolved = 'resolved',
  /** The lookup failed, so the folder list is unknown. */
  Failed = 'failed',
}
