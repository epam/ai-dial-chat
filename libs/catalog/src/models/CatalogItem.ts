import type { CatalogEntityType } from '../types/CatalogEntityType';
import type { CatalogItemOverview } from './CatalogItemOverview';

/** A node in the hierarchical "From" source filter tree. */
export interface TreeNode {
  /** Unique identifier used in checked-state sets. */
  id: string;
  /** Human-readable label shown in the checkbox tree. */
  label: string;
  /** Child nodes; empty array for leaf nodes. */
  children: TreeNode[];
}

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
  /** Human-readable "last used" label, e.g. "10 min ago". */
  lastUsed: string;
  /** Unix timestamp (ms) of last use. Used for sorting; absent items sort last. */
  lastUsedAt?: number;
  /** Background fill color for the provider logo mark. */
  logoColor: string;
  /** Single character displayed inside the logo mark. */
  logoInitial: string;
  /** Whether this item is currently starred. Default: true in the Favorites strip. */
  isStarred?: boolean;
}

/** Full catalog item shown in the Browse section. Extends FavoriteItem. */
export interface CatalogItem extends FavoriteItem {
  /** Short description, typically 1–2 lines. */
  description: string;
  /** Full description shown in the details panel About tab. Markdown or plain text. */
  longDescription?: string;
  /** Structured data for the Overview tab. When absent the tab renders empty. */
  overview?: CatalogItemOverview;
  /** Pricing tier labels, e.g. ['Free'] or ['Pay-as-you-go', 'By request']. */
  pricing: string[];
  /** When true the card gets accent border and glow. */
  isFeatured?: boolean;
  /** Folder breadcrumb path segments, outermost first. */
  folder: string[];
  /** Source/provider identifier used for the "From" tree filter. */
  from: string;
  /** Domain category matched by the "Domain" dropdown filter. */
  domain: string;
  /** Use-case category matched by the "Use Case" dropdown filter. */
  useCase: string;
  /** Maturity stage matched by the "Maturity" dropdown filter. */
  maturity: string;
}

/** A single option in the sort dropdown. */
export interface CatalogSortOption {
  /** Unique key, should match a CatalogSortKey value. */
  value: string;
  /** Display label shown in the dropdown. */
  label: string;
}
