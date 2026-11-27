import { DEFAULT_CATALOG_FOLDER_ROOTS } from '../constants/catalog-folders';
import type { CatalogItem } from '../models/catalog-item';
import type {
  CatalogFolderRoot,
  CatalogFolderSelection,
} from '../types/catalog-folders';
import { filterByFolder } from './catalog-folders';
import { sortCatalogItems } from './catalog-sort';

/** Returns items that have at least one topic in the selected set. No-ops when `topics` is empty. */
export const filterByTopics = (
  items: CatalogItem[],
  topics: Set<string>,
): CatalogItem[] => {
  if (topics.size === 0) return items;
  return items.filter((item) => item.topics.some((t) => topics.has(t)));
};

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

/** Returns a copy of `checked` with `topic` added, or removed when it was already selected. */
export const toggleTopic = (
  topic: string,
  checked: Set<string>,
): Set<string> => {
  const next = new Set(checked);
  if (next.has(topic)) {
    next.delete(topic);
  } else {
    next.add(topic);
  }
  return next;
};

/** A catalog toolbar's search, topic filter, folder and sort, as `filterCatalogItemsByQuery` applies them. */
export interface CatalogItemsQuery {
  /** Name search, case-insensitive and trimmed. */
  search: string;
  /** Topics to keep; an empty set keeps every item. */
  topics: Set<string>;
  /** Folder to keep; omitted or `{ path: [] }` keeps every item. */
  folder?: CatalogFolderSelection;
  /** Roots the folder is resolved against. Default: `DEFAULT_CATALOG_FOLDER_ROOTS`. */
  folderRoots?: CatalogFolderRoot[];
  /** A `CatalogSortKey` value. */
  sortKey: string;
}

/**
 * Applies a catalog toolbar's search, topic filter, folder and sort, in the
 * order and with the meaning of the catalog's own toolbar.
 */
export const filterCatalogItemsByQuery = (
  items: CatalogItem[],
  {
    search,
    topics,
    folder,
    folderRoots = DEFAULT_CATALOG_FOLDER_ROOTS,
    sortKey,
  }: CatalogItemsQuery,
): CatalogItem[] => {
  const byTopics = filterByTopics(filterCatalogItems(items, search), topics);
  return sortCatalogItems(
    folder != null ? filterByFolder(byTopics, folder, folderRoots) : byTopics,
    sortKey,
  );
};
