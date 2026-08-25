import type { CatalogEntityType } from '../types/entity-type';

/** Minimal entity identity fields rendered by `EntityHeader`. */
export interface EntityHeaderItem {
  /** Entity category. */
  type: CatalogEntityType;
  /** Display name. */
  name: string;
  /** Version string shown next to the name. */
  version: string;
  /** URL of the icon displayed inside the logo mark. */
  iconUrl?: string;
  /** Whether the entity is marked as featured. */
  isFeatured?: boolean;
}
