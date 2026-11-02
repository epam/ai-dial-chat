import { type CatalogItem, getCatalogItemTabs } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

/**
 * Filters catalog items to those listed under at least one tab in `visibleTypes` (see `getCatalogItemTabs`) and whose `supportsChat` is not `false`.
 * Call only when selector mode is active; otherwise pass through the original array.
 */
export const filterCatalogItemsBySelector = (
  items: readonly CatalogItem[],
  visibleTypes: ReadonlySet<CatalogEntityType>,
): CatalogItem[] =>
  items.filter(
    (item) =>
      getCatalogItemTabs(item).some((tab) => visibleTypes.has(tab)) &&
      item.supportsChat !== false,
  );

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
 * Returns items marked as a user favorite that are not hidden, in original order.
 */
export const deriveFavoriteItems = (
  items: readonly CatalogItem[],
): CatalogItem[] =>
  items.filter((item) => item.isUserFavorite && !item.isHidden);

/**
 * Returns the subset of `tabOrder` entries that at least one item in `items`
 * is listed under (see `getCatalogItemTabs`), preserving tab order.
 */
export const deriveAvailableTabIds = <T extends CatalogEntityType>(
  items: readonly CatalogItem[],
  tabOrder: readonly T[],
): T[] => {
  const presentTypes = new Set(items.flatMap(getCatalogItemTabs));
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
