import type { ShareLinkAccess } from '../types/share';

/** Share-link data for a catalog entity, as returned by the share-link seam. */
export interface ShareLinkData {
  /** Shareable URL for the entity. */
  url: string;
  /** Number of days the link stays active before expiring. */
  expiresInDays: number;
  /** Access levels granted to anyone with the link. */
  access: ShareLinkAccess[];
}
