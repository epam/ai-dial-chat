import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { SkillOverviewLabels } from '@epam/ai-dial-chat-hooks';
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
 * or `basic.searchPlaceholder` ("Search...") when the list is empty.
 */
export const getCatalogSearchPlaceholder = (
  entityTypes: readonly CatalogEntityType[],
  t: TFunction,
): string => {
  /*
   * Reached whenever the catalog has nothing to show — still loading, or every
   * item filtered out by the selector's `visibleTypes` / `catalog-hide-my-apps`.
   * The entity-naming placeholder deliberately does not apply here: with no tab
   * on offer there is no entity to name, and falling back to the pre-#8620
   * "Search models, tools, agents…" would advertise types the user cannot reach
   * — the exact miss that placeholder derivation exists to fix.
   */
  if (entityTypes.length === 0) return t(BasicI18nKeys.SearchPlaceholder);
  return t(CatalogI18nKeys.SearchPlaceholder, {
    entities: entityTypes.map((type) => t(SEARCH_ENTITY_KEYS[type])).join(', '),
  });
};

/**
 * Returns the skill Overview tab's translated section labels, shared by the
 * Catalog page's details pipeline and the chat route's skill details side panel.
 */
export const buildSkillOverviewLabels = (t: TFunction): SkillOverviewLabels => ({
  whenToUseLabel: t(CatalogI18nKeys.DetailsSkillWhenToUse),
  allowedToolsLabel: t(CatalogI18nKeys.DetailsSkillAllowedTools),
  bundledResourcesLabel: t(CatalogI18nKeys.DetailsSkillBundledResources),
  specificationSectionTitle: t(CatalogI18nKeys.DetailsSkillSpecificationSection),
  authorLabel: t(CatalogI18nKeys.DetailsSkillAuthor),
  updatedLabel: t(CatalogI18nKeys.DetailsSkillUpdated),
  fileCountLabel: t(CatalogI18nKeys.DetailsSkillFileCount),
  detailsSectionTitle: t(CatalogI18nKeys.DetailsSkillSection),
});
