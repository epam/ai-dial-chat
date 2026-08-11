/** Identifies which confirmation step the catalog details panel is currently showing in place of its details content. */
export enum DetailsConfirmationKind {
  /** Owner-side deletion of the item for everyone. */
  Delete = 'delete',
  /** Signing out of the item's stored credentials. */
  Logout = 'logout',
  /** Recipient-side removal of the caller's own shared access. */
  Unshare = 'unshare',
}

/** Palette a confirmation step is rendered with. */
export enum DetailsConfirmationVariant {
  /** Irreversible loss for everyone — red identity card and a danger confirm button. */
  Danger = 'danger',
  /** Affects only the current user and is recoverable — blue identity card and a neutral confirm button. */
  Info = 'info',
}
