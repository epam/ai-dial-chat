import type { CatalogEntityType } from '../types/entity-type';

/** Minimal data for rendering a card in the Favorites section. */
export interface FavoriteItem {
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
  /** ISO 8601 timestamp used for chronological sorting; omit when unknown. */
  updatedAt?: string;
  /** URL of the icon displayed inside the logo mark. */
  iconUrl?: string;
  /** Whether this item is currently starred. Default: true in the Favorites strip. */
  isStarred?: boolean;
}

/** Full catalog item shown in the Browse section. Extends FavoriteItem. */
export interface CatalogItem extends FavoriteItem {
  /** Short description, typically 1–2 lines. */
  description: string;
  /** When true the card gets accent border and glow. */
  isFeatured?: boolean;
  /** When true the item is hidden from the main Browse view and only shown in Search results. */
  isHidden?: boolean;
  /** Whether the item is marked as a favorite by the user. */
  isUserFavorite?: boolean;
  /** Folder breadcrumb path segments, outermost first. */
  folder: string[];
  /** Topics associated with the item. */
  topics: string[];
  overview: any; // TODO: type this properly when we implement the overview section
}
