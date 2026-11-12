import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

/** Whether a catalog entity type has saved versions, and so a Versions history section. */
export const isVersionedCatalogEntityType = (
  type: CatalogEntityType,
): boolean =>
  type === CatalogEntityType.Agent || type === CatalogEntityType.Toolset;
