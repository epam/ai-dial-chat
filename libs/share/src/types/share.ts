/** Access level granted to holders of a share link. */
export enum ShareLinkAccess {
  View = 'view',
  Edit = 'edit',
}

/** Share-link data for a catalog entity, as returned by the share-link seam. */
export interface ShareLinkData {
  /** Shareable URL for the entity. */
  url: string;
  /** Number of days the link stays active before expiring. */
  expiresInDays: number;
  /** Access level currently granted to anyone with the link. */
  access: ShareLinkAccess;
}

/** Which body the Share popover currently renders. */
export enum SharePopoverView {
  Link = 'link',
  Qr = 'qr',
}
