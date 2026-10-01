/** Identifies which confirmation step the catalog details panel is currently showing in place of its details content. */
export enum DetailsConfirmationKind {
  /** Owner-side deletion of the item for everyone. */
  Delete = 'delete',
  /** Signing out of the item's stored credentials. */
  Logout = 'logout',
  /** Recipient-side removal of the caller's own shared access. */
  Unshare = 'unshare',
  /** Owner-side revocation of everyone else's shared access. */
  RevokeAccess = 'revokeAccess',
  /** Removing a configured API key from a credentials slot. */
  DeleteApiKey = 'deleteApiKey',
  /**
   * Owner-side request to remove an already-published copy from one folder.
   * The source item survives untouched, and the removal itself takes effect
   * only after an administrator approves the request — copy for this kind
   * describes a request, never a completed removal.
   */
  Unpublish = 'unpublish',
}
