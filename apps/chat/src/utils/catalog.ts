import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { BasicI18nKeys, CatalogI18nKeys } from '../constants/translation-keys';

/** Lowercase plural noun naming each entity type inside the search placeholder. */
const SEARCH_ENTITY_KEYS: Record<CatalogEntityType, CatalogI18nKeys> = {
  [CatalogEntityType.Model]: CatalogI18nKeys.SearchEntityModels,
  [CatalogEntityType.Agent]: CatalogI18nKeys.SearchEntityApplications,
  [CatalogEntityType.Toolset]: CatalogI18nKeys.SearchEntityToolsets,
  [CatalogEntityType.Prompt]: CatalogI18nKeys.SearchEntityPrompts,
  [CatalogEntityType.Skill]: CatalogI18nKeys.SearchEntitySkills,
};

/**
 * Returns the Catalog toolbar's search placeholder naming only `entityTypes`,
 * or the generic placeholder when the list is empty.
 */
export const getCatalogSearchPlaceholder = (
  entityTypes: readonly CatalogEntityType[],
  t: TFunction,
): string => {
  if (entityTypes.length === 0) return t(BasicI18nKeys.SearchPlaceholder);
  return t(CatalogI18nKeys.SearchPlaceholder, {
    entities: entityTypes.map((type) => t(SEARCH_ENTITY_KEYS[type])).join(', '),
  });
};
