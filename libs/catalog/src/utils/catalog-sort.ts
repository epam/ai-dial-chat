import type { CatalogItem } from '../models/CatalogItem';
import { CatalogSortKey } from '../types/sort';

/**
 * Returns a sorted copy of the items array.
 * 'recently-updated': featured items first, then remaining.
 * 'newest': reverses the original order.
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
    return [...items].reverse();
  }
  // Default: featured first (CatalogSortKey.RecentlyUpdated)
  return [
    ...items.filter((i) => i.isFeatured),
    ...items.filter((i) => !i.isFeatured),
  ];
};
