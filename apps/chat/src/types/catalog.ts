import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

/** Query-string params supported on the `/catalog` route. */
export enum CatalogQuery {
  /** ID of an item whose details panel should open automatically on load. */
  ItemId = 'itemId',
}

/**
 * Canonical display order for Catalog entity-type tabs, mirroring
 * `TAB_ORDER` in `libs/catalog/src/utils/catalog-tabs.ts`. Kept in sync here
 * because `CatalogView` needs the same ordering to resolve the persisted
 * active tab against the tabs currently available.
 */
export const CATALOG_TAB_ORDER: CatalogEntityType[] = [
  CatalogEntityType.Model,
  CatalogEntityType.Agent,
  CatalogEntityType.Toolset,
  CatalogEntityType.Prompt,
  CatalogEntityType.Skill,
];
