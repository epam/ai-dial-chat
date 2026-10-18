import type { ShareLinkAccess } from '../types/share';

/** Share-link data for a catalog entity, as returned by the share-link seam. */
export interface ShareLinkData {
  /** Shareable URL for the entity. */
  url: string;
  /** Number of days the link stays active before expiring; omitted when the host cannot determine the expiry. */
  expiresInDays?: number;
  /** Number of hours the link stays active before expiring, rounded up; lets the host describe a lifetime shorter than a day. Omitted when the host cannot determine the expiry. */
  expiresInHours?: number;
  /** Access levels granted to anyone with the link. */
  access: ShareLinkAccess[];
}
