/** A pinned project's sidebar action that opens an overlay. */
export enum PinnedProjectActionKind {
  /** The publish panel. */
  Publish = 'publish',
  /** The share popover. */
  Share = 'share',
  /** Opens the owner's revoke-access confirmation. */
  RevokeAccess = 'revokeAccess',
  /** The delete confirmation. */
  Delete = 'delete',
  /** The confirmation before a project shared with the user leaves their list. */
  RemoveFromMyList = 'removeFromMyList',
}
