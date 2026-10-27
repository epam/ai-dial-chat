import type { SkillOverviewLabels } from '@epam/ai-dial-chat-hooks';
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

/** Capitalised plural noun naming each entity type at the start of a sentence. */
const TAB_ENTITY_KEYS: Record<CatalogEntityType, CatalogI18nKeys> = {
  [CatalogEntityType.Model]: CatalogI18nKeys.TabModels,
  [CatalogEntityType.Agent]: CatalogI18nKeys.TabApplications,
  [CatalogEntityType.Toolset]: CatalogI18nKeys.TabToolsets,
  [CatalogEntityType.Prompt]: CatalogI18nKeys.TabPrompts,
  [CatalogEntityType.Skill]: CatalogI18nKeys.TabSkills,
};

/**
 * Returns `entityTextKey` interpolated with the active tab's entity noun from
 * `nounKeys`, or `genericKey` for an unknown tab.
 */
const getCatalogEntityText = (
  activeTab: string,
  t: TFunction,
  nounKeys: Record<CatalogEntityType, CatalogI18nKeys>,
  entityTextKey: CatalogI18nKeys,
  genericKey: CatalogI18nKeys,
): string => {
  const nounKey = nounKeys[activeTab as CatalogEntityType];
  if (nounKey == null) return t(genericKey);
  return t(entityTextKey, { entities: t(nounKey) });
};

/** Returns the Catalog's "no results" heading naming the active tab's entity ("No models found"). */
export const getCatalogNoResultsTitle = (
  activeTab: string,
  t: TFunction,
): string =>
  getCatalogEntityText(
    activeTab,
    t,
    SEARCH_ENTITY_KEYS,
    CatalogI18nKeys.NoResultsEntityTitle,
    CatalogI18nKeys.NoResultsTitle,
  );

/** Returns the Catalog's empty-tab heading naming the active tab's entity ("No models yet"). */
export const getCatalogEmptyTitle = (activeTab: string, t: TFunction): string =>
  getCatalogEntityText(
    activeTab,
    t,
    SEARCH_ENTITY_KEYS,
    CatalogI18nKeys.EmptyEntityTitle,
    CatalogI18nKeys.EmptyTitle,
  );

/** Returns the Catalog's empty-tab description naming the active tab's entity ("Models will appear here…"). */
export const getCatalogEmptyDescription = (
  activeTab: string,
  t: TFunction,
): string =>
  getCatalogEntityText(
    activeTab,
    t,
    TAB_ENTITY_KEYS,
    CatalogI18nKeys.EmptyEntityDescription,
    CatalogI18nKeys.EmptyDescription,
  );

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
 * Returns the Catalog's "My" empty-state heading naming the active tab's
 * entity ("No personal agents yet"), or a generic one for an unknown tab.
 */
export const getCatalogMyAppsEmptyTitle = (
  activeTab: string,
  t: TFunction,
): string => {
  const entityKey = SEARCH_ENTITY_KEYS[activeTab as CatalogEntityType];
  if (entityKey == null) return t(CatalogI18nKeys.MyAppsEmptyTitleGeneric);
  return t(CatalogI18nKeys.MyAppsEmptyTitle, { entities: t(entityKey) });
};

/**
 * Returns the skill Overview tab's translated section labels, shared by the
 * Catalog page's details pipeline and the chat route's skill details side panel.
 */
export const buildSkillOverviewLabels = (
  t: TFunction,
): SkillOverviewLabels => ({
  whenToUseLabel: t(CatalogI18nKeys.DetailsSkillWhenToUse),
  allowedToolsLabel: t(CatalogI18nKeys.DetailsSkillAllowedTools),
  bundledResourcesLabel: t(CatalogI18nKeys.DetailsSkillBundledResources),
  specificationSectionTitle: t(CatalogI18nKeys.DetailsSpecificationSection),
  authorLabel: t(CatalogI18nKeys.DetailsSkillAuthor),
  updatedLabel: t(CatalogI18nKeys.DetailsSkillUpdated),
  fileCountLabel: t(CatalogI18nKeys.DetailsSkillFileCount),
});
