import type { CatalogItem } from '../models/catalog-item';

/**
 * Returns a filtered array of items whose name, description, or type includes the query.
 * Case-insensitive and ignores leading/trailing whitespace.
 */
export const filterCatalogItems = (
  items: CatalogItem[],
  query: string,
): CatalogItem[] => {
  const queryLower = query.trim().toLowerCase();

  let result = items;

  if (queryLower) {
    result = result.filter(
      (item) =>
        item.name.toLowerCase().includes(queryLower) ||
        item.description.toLowerCase().includes(queryLower) ||
        item.type.toLowerCase().includes(queryLower),
    );
  }

  return result;
};
