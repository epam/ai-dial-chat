/** Outcome of the creation check for a create-mode editor. */
export enum CatalogCreationDecision {
  /** Permissions or the requested schema are still loading. */
  Pending = 'pending',
  /** Permissions failed to load, or the requested schema cannot be resolved. */
  Unavailable = 'unavailable',
  /** The creation policy denies this type or schema. */
  Denied = 'denied',
  /** Creation may proceed. */
  Allowed = 'allowed',
}
