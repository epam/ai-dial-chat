import type { CatalogItem } from '../models/catalog-item';
import { CatalogSortKey } from '../types/sort';

/**
 * Returns a sorted copy of the items array.
 * 'recently-updated': featured items first, then remaining.
 * 'newest': descending by updatedAt; items without a timestamp sort last.
 * 'name-az': alphabetical by name.
 */
export const sortCatalogItems = (
  items: CatalogItem[],
  sortKey: string,
): CatalogItem[] => {
  if (sortKey === CatalogSortKey.NameAZ) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sortKey === CatalogSortKey.Newest) {
    return [...items].sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return 0;
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }
  // Default: featured first (CatalogSortKey.RecentlyUpdated)
  return [
    ...items.filter((i) => i.isFeatured),
    ...items.filter((i) => !i.isFeatured),
  ];
};
