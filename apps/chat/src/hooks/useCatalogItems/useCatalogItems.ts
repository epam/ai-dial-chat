import type { CatalogItem } from '@epam/ai-dial-catalog';
import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
  DialToolsetDto,
  PromptResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  type CatalogDetailsApi,
  type DeploymentLimitsLabels,
  deriveAvailableTabIds,
  deriveFavoriteItems,
  filterCatalogItemsBySelector,
  filterHiddenOwnedItems,
  isQuickAppSchema,
  mapPromptToCatalogItem,
  mapSkillToCatalogItem,
  type PromptOverviewLabels,
  PromptSource,
  reconcileFilterTopics,
  SkillSource,
  useCatalogItemDetails,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { getDeploymentLimits } from '../../server-api/deployment-limits';
import { getDeploymentDetails } from '../../server-api/deployments';
import { getPrompt, getPublicPrompt } from '../../server-api/prompts.api';
import { downloadSkillFile, listSkillFiles } from '../../server-api/skills.api';
import { CATALOG_TAB_ORDER } from '../../types/catalog';
import { buildSkillOverviewLabels } from '../../utils/catalog';
import {
  buildDeploymentFolderLabels,
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../../utils/map-deployment-to-catalog-item';

interface UseCatalogItemsParams {
  schemas: ApplicationSchemaSummaryDto[];
  deployments: DeploymentItemDto[];
  favoriteIds: ReadonlySet<string>;
  t: TFunction;
  language: string;
  toolsets: DialToolsetDto[];
  isAdmin: boolean;
  dialCoreExternalUrl: string | null;
  isToolsetsEnabled: boolean;
  isCustomAppsEnabled: boolean;
  isPromptsEnabled: boolean;
  isSkillsEnabled: boolean;
  prompts: PromptResponseDto[];
  sharedPrompts: PromptResponseDto[];
  publicPrompts: PromptResponseDto[];
  skills: SkillMetadataItemDto[];
  sharedSkills: SkillMetadataItemDto[];
  publicSkills: SkillMetadataItemDto[];
  isSelectorMode: boolean;
  visibleTypes: Set<CatalogEntityType>;
  isCatalogHideMyAppsEnabled: boolean;
  persistedFilterTopics: Set<string>;
}

interface UseCatalogItemsResult {
  quickAppSchemaId: string | undefined;
  quickAppDeploymentIds: Set<string>;
  catalogItems: CatalogItem[];
  visibleCatalogItems: CatalogItem[];
  reconciledFilterTopics: Set<string>;
  availableTabIds: CatalogEntityType[];
  favorites: CatalogItem[];
  onFetchDetails: ReturnType<typeof useCatalogItemDetails>['onFetchDetails'];
  onLoadContentFile: ReturnType<
    typeof useCatalogItemDetails
  >['onLoadContentFile'];
  onLoadSkillDetailsFile: ReturnType<
    typeof useCatalogItemDetails
  >['onLoadSkillDetailsFile'];
}

/**
 * Derives the catalog's item list and its dependent views (visible items,
 * reconciled filter topics, available tabs, favorites) from the raw
 * deployment/toolset/prompt/skill sources, and wires up
 * `useCatalogItemDetails` for the details panel.
 */
export const useCatalogItems = ({
  schemas,
  deployments,
  favoriteIds,
  t,
  language,
  toolsets,
  isAdmin,
  dialCoreExternalUrl,
  isToolsetsEnabled,
  isCustomAppsEnabled,
  isPromptsEnabled,
  isSkillsEnabled,
  prompts,
  sharedPrompts,
  publicPrompts,
  skills,
  sharedSkills,
  publicSkills,
  isSelectorMode,
  visibleTypes,
  isCatalogHideMyAppsEnabled,
  persistedFilterTopics,
}: UseCatalogItemsParams): UseCatalogItemsResult => {
  const quickAppSchemaId = useMemo(
    () => schemas.find((s) => isQuickAppSchema(s))?.id,
    [schemas],
  );

  const quickAppDeploymentIds = useMemo(
    () =>
      new Set(
        quickAppSchemaId
          ? deployments
              .filter((d) => d.applicationTypeSchemaId === quickAppSchemaId)
              .map((d) => d.id)
          : [],
      ),
    [deployments, quickAppSchemaId],
  );

  const promptOverviewLabels: PromptOverviewLabels = useMemo(
    () => ({
      authorLabel: t(CatalogI18nKeys.DetailsPromptAuthor),
      updatedLabel: t(CatalogI18nKeys.DetailsPromptUpdated),
      sectionTitle: t(CatalogI18nKeys.DetailsPromptSection),
    }),
    [t],
  );

  const skillOverviewLabels = useMemo(
    () => buildSkillOverviewLabels(t),
    [t],
  );

  const deploymentLimitsLabels: DeploymentLimitsLabels = useMemo(
    () => ({
      tokenGroup: t(CatalogI18nKeys.DetailsLimitsTokenGroupLabel),
      tokensPerDay: t(CatalogI18nKeys.DetailsLimitsTokensPerDay),
      tokensPerWeek: t(CatalogI18nKeys.DetailsLimitsTokensPerWeek),
      tokensPerMonth: t(CatalogI18nKeys.DetailsLimitsTokensPerMonth),
      followsCostLimit: t(CatalogI18nKeys.DetailsLimitsFollowsCostLimitLabel),
      formatSpentCaption: (amount) =>
        t(CatalogI18nKeys.DetailsLimitsSpentLabel, { amount }),
      formatValueLabel: (used, total) =>
        t(CatalogI18nKeys.DetailsLimitsValue, { used, total }),
      formatProgressAriaLabel: ({ label, used, total }) =>
        t(CatalogI18nKeys.DetailsLimitsProgressAriaLabel, {
          label,
          used,
          total,
        }),
      formatFollowsCostLimitAriaLabel: ({ label, used }) =>
        t(CatalogI18nKeys.DetailsLimitsFollowsCostLimitAriaLabel, {
          label,
          used,
        }),
    }),
    [t],
  );

  const catalogDetailsApi: CatalogDetailsApi = useMemo(
    () => ({
      getDeploymentDetails,
      getDeploymentLimits,
      getPrompt,
      getPublicPrompt,
      downloadSkillFile,
      listSkillFiles,
    }),
    [],
  );

  const combinedSkills = useMemo(
    () => [...skills, ...sharedSkills, ...publicSkills],
    [skills, sharedSkills, publicSkills],
  );

  const { onFetchDetails, onLoadContentFile, onLoadSkillDetailsFile } =
    useCatalogItemDetails({
      api: catalogDetailsApi,
      skills: combinedSkills,
      isAdmin,
      dialCoreExternalUrl,
      skillOverviewLabels,
      promptOverviewLabels,
      deploymentLimitsLabels,
    });

  const catalogItems = useMemo(() => {
    const folderLabels = buildDeploymentFolderLabels(t);
    return [
      ...deployments.map((d) =>
        mapDeploymentToCatalogItem(d, {
          favoriteIds,
          t,
          editableSchemaIds: quickAppSchemaId ? [quickAppSchemaId] : [],
          isCustomAppsEditable: isCustomAppsEnabled,
          activeLocale: language,
        }),
      ),
      ...(isToolsetsEnabled
        ? toolsets.map((toolset) =>
            mapToolsetToCatalogItem(toolset, {
              favoriteIds,
              isAdmin,
              t,
              activeLocale: language,
            }),
          )
        : []),
      ...(isPromptsEnabled
        ? [
            ...prompts.map((prompt) =>
              mapPromptToCatalogItem(prompt, {
                folderLabels,
                overviewLabels: promptOverviewLabels,
                source: PromptSource.Personal,
                favoriteIds,
              }),
            ),
            ...sharedPrompts.map((prompt) =>
              mapPromptToCatalogItem(prompt, {
                folderLabels,
                overviewLabels: promptOverviewLabels,
                source: PromptSource.SharedWithMe,
                favoriteIds,
              }),
            ),
            ...publicPrompts.map((prompt) =>
              mapPromptToCatalogItem(prompt, {
                folderLabels,
                overviewLabels: promptOverviewLabels,
                source: PromptSource.Public,
                favoriteIds,
              }),
            ),
          ]
        : []),
      ...(isSkillsEnabled
        ? [
            ...skills.map((skill) =>
              mapSkillToCatalogItem(skill, {
                folderLabels,
                source: SkillSource.Personal,
                favoriteIds,
              }),
            ),
            ...sharedSkills.map((skill) =>
              mapSkillToCatalogItem(skill, {
                folderLabels,
                source: SkillSource.SharedWithMe,
                favoriteIds,
              }),
            ),
            ...publicSkills.map((skill) =>
              mapSkillToCatalogItem(skill, {
                folderLabels,
                source: SkillSource.Public,
                favoriteIds,
              }),
            ),
          ]
        : []),
    ];
  }, [
    deployments,
    favoriteIds,
    t,
    language,
    toolsets,
    quickAppSchemaId,
    isAdmin,
    isToolsetsEnabled,
    isCustomAppsEnabled,
    isPromptsEnabled,
    prompts,
    sharedPrompts,
    publicPrompts,
    promptOverviewLabels,
    isSkillsEnabled,
    skills,
    sharedSkills,
    publicSkills,
  ]);

  const visibleCatalogItems = useMemo(() => {
    const selectorFiltered = isSelectorMode
      ? filterCatalogItemsBySelector(catalogItems, visibleTypes)
      : catalogItems;
    return filterHiddenOwnedItems(selectorFiltered, isCatalogHideMyAppsEnabled);
  }, [catalogItems, isSelectorMode, isCatalogHideMyAppsEnabled, visibleTypes]);

  const reconciledFilterTopics = useMemo(
    () => reconcileFilterTopics(persistedFilterTopics, visibleCatalogItems),
    [visibleCatalogItems, persistedFilterTopics],
  );

  const availableTabIds = useMemo(
    () => deriveAvailableTabIds(visibleCatalogItems, CATALOG_TAB_ORDER),
    [visibleCatalogItems],
  );

  const favorites = useMemo(
    () => deriveFavoriteItems(visibleCatalogItems),
    [visibleCatalogItems],
  );

  return {
    quickAppSchemaId,
    quickAppDeploymentIds,
    catalogItems,
    visibleCatalogItems,
    reconciledFilterTopics,
    availableTabIds,
    favorites,
    onFetchDetails,
    onLoadContentFile,
    onLoadSkillDetailsFile,
  };
};
