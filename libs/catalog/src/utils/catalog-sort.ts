import type { CatalogItem } from '../models/catalog-item';
import { CatalogSortKey } from '../types/sort';

/**
 * Returns a sorted copy of the items array.
 * Featured items always appear first in every sort mode.
 * Within each group the chosen key is applied:
 * 'recently-updated': no further ordering (original/API order).
 * 'newest': descending by updatedAt; items without a timestamp sort last.
 * 'name-az': alphabetical by name.
 */
export const sortCatalogItems = (
  items: CatalogItem[],
  sortKey: string,
): CatalogItem[] => {
  const featured = items.filter((i) => i.isFeatured);
  const rest = items.filter((i) => !i.isFeatured);

  const sortGroup = (group: CatalogItem[]): CatalogItem[] => {
    if (sortKey === CatalogSortKey.NameAZ) {
      return [...group].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortKey === CatalogSortKey.Newest) {
      return [...group].sort((a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    }
    return group;
  };

  return [...sortGroup(featured), ...sortGroup(rest)];
};
