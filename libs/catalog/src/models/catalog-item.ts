import type { CatalogEntityType } from '../types/entity-type';
import type { CatalogItemSummary } from './entity-summary';
import type { CatalogItemTabData } from './item-details-data';

/** Full catalog item shown in the Browse section. */
export interface CatalogItem {
  /** Unique identifier. */
  id: string;
  /** Entity category. */
  type: CatalogEntityType;
  /** Display name. */
  name: string;
  /** Version string shown next to the name. */
  version: string;
  /** Human-readable "last used" timestamp, e.g. "10 min ago". */
  lastUsed: string;
  /** Timestamp used for chronological sorting; omit when unknown. */
  updatedAt?: number;
  /** URL of the icon displayed inside the logo mark. */
  iconUrl?: string;
  /** Whether this item is currently starred. Default: true in the Favorites Strip. */
  isStarred?: boolean;
  /** When true the card gets accent border, glow, and a Featured tag. */
  isFeatured?: boolean;
  /** Short description, typically 1–2 lines. */
  description: string;
  /** When true the item is hidden from the main Browse view and only shown in Search results. */
  isHidden?: boolean;
  /** Whether the item is marked as a favorite by the user. */
  isUserFavorite?: boolean;
  /** Whether the item belongs to the current user (e.g. created by them or in their personal space). */
  isMyApp?: boolean;
  /** Folder breadcrumb path segments, outermost first. */
  folder: string[];
  /** Topics associated with the item. */
  topics: string[];
  /** Header-level summary metadata (tag, badge image, daily limit). When absent the summary block is hidden. */
  summary?: CatalogItemSummary;
  /** Tab-specific detail data. A tab is shown only when its field is non-null. */
  details?: CatalogItemTabData;
}
