import { CatalogSortKey } from '@epam/ai-dial-catalog';

/** Returns the stored catalog sort key when it is a known `CatalogSortKey`, otherwise `CatalogSortKey.RecentlyUpdated`. */
export const resolveCatalogSortKey = (stored: unknown): CatalogSortKey =>
  Object.values(CatalogSortKey).includes(stored as CatalogSortKey)
    ? (stored as CatalogSortKey)
    : CatalogSortKey.RecentlyUpdated;

/** Returns the string topics of a stored catalog topic filter as a set; anything that is not an array yields an empty set. */
export const parseCatalogFilterTopics = (stored: unknown): Set<string> =>
  new Set(
    Array.isArray(stored)
      ? stored.filter((topic): topic is string => typeof topic === 'string')
      : [],
  );

/** Returns the stored catalog tab when it is still available, otherwise the first available tab id. */
export const resolveCatalogActiveTab = (
  stored: unknown,
  availableTabIds: readonly string[],
): string | undefined =>
  typeof stored === 'string' && availableTabIds.includes(stored)
    ? stored
    : availableTabIds[0];
