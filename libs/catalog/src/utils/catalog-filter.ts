import type { CatalogItem } from '../models/catalog-item';

/** Returns the filter label for the From dropdown: the default label when nothing (or everything) is selected, or a compact summary otherwise. */
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
    if (excludedId == null) return defaultLabel;
    return `${defaultLabel}: All except ${excludedId}`;
  }
  return `${defaultLabel}: ${n} of ${total}`;
};

/** Returns items that have at least one topic in the selected set. No-ops when `topics` is empty. */
export const filterByTopics = (
  items: CatalogItem[],
  topics: Set<string>,
): CatalogItem[] => {
  if (topics.size === 0) return items;
  return items.filter((item) => item.topics.some((t) => topics.has(t)));
};

/** Returns items where `isMyApp` is `true`. */
export const filterByMyApp = (items: CatalogItem[]): CatalogItem[] =>
  items.filter((item) => item.isMyApp === true);

/** Derives the set of distinct topic values present across `items`. */
export const getTopicOptions = (items: CatalogItem[]): Set<string> =>
  new Set(items.flatMap((item) => item.topics));

/**
 * Returns a filtered array of items whose name includes the query.
 * Case-insensitive and ignores leading/trailing whitespace.
 *
 * Only `name` is matched, because the name is the only text the card and the
 * list row highlight. Matching `description` or `type` as well kept rows whose
 * visible name had nothing in common with the query — a word that is common in
 * tool descriptions, or any substring of an entity type such as `TOOLSET`,
 * returned the whole category.
 */
export const filterCatalogItems = (
  items: CatalogItem[],
  query: string,
): CatalogItem[] => {
  const queryLower = query.trim().toLowerCase();

  if (!queryLower) return items;

  return items.filter((item) => item.name.toLowerCase().includes(queryLower));
};
