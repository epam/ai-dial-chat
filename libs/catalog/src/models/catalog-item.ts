import type { CatalogEntityType } from '../types/entity-type';
import type { CatalogItemCredentials } from './catalog-item-credentials';
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
  /** Timestamp used for chronological sorting; omit when unknown. */
  createdAt?: number;
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
  /** Whether this item is shared with the current user (not owned by them) via a share invitation. */
  sharedWithMe?: boolean;
  /**
   * How many other users currently hold shared access to this item, for items
   * the current user owns. `0` means nobody holds access; `undefined` means
   * the host could not determine it. Counts accepted invitations only, so an
   * issued-but-unopened share link reads as `0`.
   */
  recipientsCount?: number;
  /** Whether the item can be edited by the current user. When true and `onEdit` is supplied, an "Edit" action is shown in the details panel. */
  isEditable?: boolean;
  /** Provider name shown below the entity name in the details header, e.g. `'OpenAI'` or `'Anthropic'`. */
  provider?: string;
  /** Folder breadcrumb path segments, outermost first. */
  folder: string[];
  /** Topics associated with the item. */
  topics: string[];
  /** Tab-specific detail data. A tab is shown only when its field is non-null. */
  details?: CatalogItemTabData;
  /** Credential status for the item's own authentication. Absent when the item requires no authentication. */
  credentials?: CatalogItemCredentials;
  /** Whether this application supports the MCP protocol; only meaningful for `Application` items. */
  supportsMcp?: boolean;
  /** Whether this item can be used in chat. Default: true. Set to false to hide the "Use in chat" primary action for a Model or Application that does not expose a chat interface. */
  supportsChat?: boolean;
}
