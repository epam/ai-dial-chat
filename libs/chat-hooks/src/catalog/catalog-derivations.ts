import type { CatalogItem } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

/**
 * Filters catalog items to those whose type is in `visibleTypes`.
 * Call only when selector mode is active; otherwise pass through the original array.
 */
export const filterCatalogItemsBySelector = (
  items: readonly CatalogItem[],
  visibleTypes: ReadonlySet<CatalogEntityType>,
): CatalogItem[] => items.filter((item) => visibleTypes.has(item.type));

/**
 * Filters out items owned by the current user when `hideOwned` is true.
 * Always returns a new array so callers may safely assign to mutable collections.
 */
export const filterHiddenOwnedItems = (
  items: readonly CatalogItem[],
  hideOwned: boolean,
): CatalogItem[] =>
  hideOwned ? items.filter((item) => !item.isMyApp) : [...items];

/**
 * Returns items marked as a user favorite, in original order.
 */
export const deriveFavoriteItems = (
  items: readonly CatalogItem[],
): CatalogItem[] => items.filter((item) => item.isUserFavorite);

/**
 * Returns the subset of `tabOrder` entries whose entity type is present in
 * `items`, preserving tab order.
 */
export const deriveAvailableTabIds = <T extends CatalogEntityType>(
  items: readonly CatalogItem[],
  tabOrder: readonly T[],
): T[] => {
  const presentTypes = new Set(items.map((item) => item.type));
  return tabOrder.filter((type) => presentTypes.has(type));
};

/**
 * Returns the intersection of `persistedTopics` with topics that appear in
 * `items`. Returns a new Set and never mutates either input.
 */
export const reconcileFilterTopics = (
  persistedTopics: ReadonlySet<string>,
  items: readonly CatalogItem[],
): Set<string> => {
  const availableTopics = new Set(items.flatMap((item) => item.topics));
  return new Set(
    Array.from(persistedTopics).filter((topic) => availableTopics.has(topic)),
  );
};
