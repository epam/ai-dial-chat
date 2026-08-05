import { CatalogItem } from '../models/catalog-item';
import { CatalogEntityType } from '../types/entity-type';

/*
 * Delete is limited to entities the current user owns (applications and
 * toolsets in their personal space) — never Models, Guardrails, MCPs, or
 * Agents.
 */
/** Whether the "Delete" action should be offered for this item. */
export const canDeleteCatalogItem = (item: CatalogItem): boolean =>
  item.isMyApp === true &&
  (item.type === CatalogEntityType.Agent ||
    item.type === CatalogEntityType.Toolset);
