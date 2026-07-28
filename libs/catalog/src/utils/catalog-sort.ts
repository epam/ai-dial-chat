import type { CatalogItem } from '../models/catalog-item';
import { CatalogSortKey } from '../types/sort';

/** Returns a sorted copy of items; featured items always sort first, then by the given `sortKey`. */
export const sortCatalogItems = (
  items: CatalogItem[],
  sortKey: string,
): CatalogItem[] => {
  const featured = items.filter((i) => i.isFeatured);
  const rest = items.filter((i) => !i.isFeatured);

  const sortGroup = (group: CatalogItem[]): CatalogItem[] => {
    if (sortKey === CatalogSortKey.NameAZ) {
      return [...group].sort((a, b) =>
        a.name.trim().toLowerCase().localeCompare(b.name.trim().toLowerCase()),
      );
    }
    if (sortKey === CatalogSortKey.RecentlyUpdated) {
      return [...group].sort((a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return b.updatedAt - a.updatedAt;
      });
    }
    if (sortKey === CatalogSortKey.Newest) {
      return [...group].sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt - a.createdAt;
      });
    }
    return group;
  };

  return [...sortGroup(featured), ...sortGroup(rest)];
};
