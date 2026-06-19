import type { CatalogItem } from '../models/catalog-item';

export const getFromLabel = (
  checked: Set<string>,
  allIds: Set<string> | undefined,
  defaultLabel = 'From',
): string => {
  const total = allIds?.size ?? 0;
  const n = checked.size;
  if (n === 0 || n === total) return defaultLabel;
  if (total - n === 1) {
    const excludedId = [...(allIds ?? [])].find((id) => !checked.has(id));
    return `${defaultLabel}: All except ${excludedId}`;
  }
  return `${defaultLabel}: ${n} of ${total}`;
};

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
