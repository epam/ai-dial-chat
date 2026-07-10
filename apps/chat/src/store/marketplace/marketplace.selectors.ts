import { createSelector } from '@reduxjs/toolkit';

import {
  getApplicationType,
  isApplicationTypeKey,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';
import { pluralizeDisplayName } from '@/src/utils/app/application-type-schema';
import { isMyApplication, isMyToolset } from '@/src/utils/app/id';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { MarketplaceFilters } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { RootState } from '@/src/types/store';
import { ToolsetModel } from '@/src/types/toolsets';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import {
  ApplicationTypeToSourceType,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  SourceType,
} from '@/src/constants/marketplace';

import { MarketplaceActions } from './marketplace.reducers';

import { Feature, UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.marketplace;

const selectSelectedViewType = (state: RootState) =>
  rootSelector(state).selectedView;

const selectTableSort = (state: RootState) => rootSelector(state).tableSort;

const selectIsBannerVisible = (state: RootState) =>
  rootSelector(state).isBannerVisible;

const selectSelectedAgentsFilters = (state: RootState) =>
  rootSelector(state).selectedAgentsFilters;

const selectSelectedToolsetsFilters = (state: RootState) =>
  rootSelector(state).selectedToolsetsFilters;

const selectSearchTerm = (state: RootState) => rootSelector(state).searchTerm;

const selectTrimmedSearchTerm = createSelector(
  [selectSearchTerm],
  (searchTerm) => searchTerm.trim(),
);

const selectSelectedTab = (state: RootState) => rootSelector(state).selectedTab;
const selectSelectedEntitiesTab = (state: RootState) =>
  rootSelector(state).selectedEntitiesTab;

const selectApplyModelStatus = (state: RootState) =>
  rootSelector(state).applyModelStatus;

const selectIsApplyingModel = (state: RootState) =>
  selectApplyModelStatus(state) !== UploadStatus.UNINITIALIZED &&
  selectApplyModelStatus(state) !== UploadStatus.FAILED;

const selectDetailsEntity = (state: RootState) =>
  rootSelector(state).detailsEntity;

const selectDetailsModel = createSelector(
  [selectDetailsEntity],
  (detailsEntity) =>
    detailsEntity?.type === MarketplaceEntitiesTabs.AGENTS
      ? detailsEntity
      : undefined,
);

const selectDetailsToolset = createSelector(
  [selectDetailsEntity],
  (detailsEntity) =>
    detailsEntity?.type === MarketplaceEntitiesTabs.TOOLSETS
      ? detailsEntity
      : undefined,
);

const selectSourceTypes = createSelector(
  [
    ModelsSelectors.selectModels,
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  ],
  (models: DialAIEntityModel[], schemas: ApplicationTypeSchema[]) => {
    const sourceTypes = new Set<SourceType>([SourceType.Public]);

    models.forEach((model) => {
      if (isMyApplication(model)) {
        const applicationType = getApplicationType(model);

        if (isApplicationTypeKey(applicationType)) {
          sourceTypes.add(ApplicationTypeToSourceType[applicationType]);
        } else {
          const schema = schemas.find(
            (schema) =>
              model.applicationTypeSchemaId &&
              schema.id === model.applicationTypeSchemaId,
          );
          if (schema) {
            const sourceType = pluralizeDisplayName(schema.displayName);
            sourceTypes.add(sourceType as SourceType);
          }
        }
      } else if (!isMarketplaceEntityPublic(model)) {
        sourceTypes.add(SourceType.SharedWithMe);
      }
    });

    return Array.from(sourceTypes).sort();
  },
);

const selectToolsetSourceTypes = createSelector(
  [ToolsetSelectors.selectToolsets],
  (toolsets: ToolsetModel[]) => {
    const sourceTypes = new Set<SourceType>([]);
    if (toolsets.length === 0) {
      return [];
    }

    for (const toolset of toolsets) {
      if (isMyToolset(toolset)) {
        sourceTypes.add(SourceType.MyToolsets);
      }

      if (isMarketplaceEntityPublic(toolset)) {
        sourceTypes.add(SourceType.Public);
      }

      if (!isMyToolset(toolset) && !isMarketplaceEntityPublic(toolset)) {
        sourceTypes.add(SourceType.SharedWithMe);
      }

      // Early exit optimization
      if (sourceTypes.size === 3) {
        break;
      }
    }

    return Array.from(sourceTypes).sort();
  },
);

const selectDeleteEntity = (state: RootState) =>
  rootSelector(state).deleteEntity;

const selectLoginEntity = (state: RootState) => rootSelector(state).loginEntity;

const selectShowLoader = (state: RootState) => rootSelector(state).showLoader;

const PERSONAL_SOURCE_TYPES = new Set([
  SourceType.SharedWithMe,
  SourceType.MyCustomApps,
  SourceType.MyCodeApps,
  SourceType.MyToolsets,
]);

const selectFiltersContent = createSelector(
  [
    selectSelectedEntitiesTab,
    ModelsSelectors.selectModelTopics,
    selectSourceTypes,
    selectSelectedAgentsFilters,
    ModelsSelectors.selectAreModelsLoaded,
    selectShowLoader,
    ToolsetSelectors.selectToolsetsTopics,
    selectToolsetSourceTypes,
    selectSelectedToolsetsFilters,
    ToolsetSelectors.selectAreToolsetsLoaded,
    selectSelectedTab,
    SettingsSelectors.selectEnabledFeatures,
  ],
  (
    selectedEntitiesTab: MarketplaceEntitiesTabs,
    topics: string[],
    sourceTypes: SourceType[],
    selectedAgentsFilters: MarketplaceFilters,
    areModelsLoaded: boolean,
    isMarketplaceLoading: boolean | undefined,
    toolsetsTopics: string[],
    toolsetSourceTypes: SourceType[],
    selectedToolsetsFilters: MarketplaceFilters,
    areToolsetsLoaded: boolean,
    selectedTab,
    enabledFeatures,
  ) => {
    const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;
    const shouldHidePersonalSources =
      selectedTab === MarketplaceTabs.HOME &&
      enabledFeatures.has(Feature.MarketplaceHideMyApps);

    const filterPersonalSources = (types: SourceType[]) =>
      shouldHidePersonalSources
        ? types.filter(
            (type) =>
              !PERSONAL_SOURCE_TYPES.has(type) && !type.startsWith('My '),
          )
        : types;

    if (isAgentsTab) {
      return {
        topicsFilters: topics,
        sourcesFilters: filterPersonalSources(sourceTypes),
        selectedFilters: selectedAgentsFilters,
        showLoader: !areModelsLoaded || !!isMarketplaceLoading,
        setFilters: MarketplaceActions.setSelectedAgentsFilters,
      };
    }
    return {
      topicsFilters: toolsetsTopics,
      sourcesFilters: filterPersonalSources(toolsetSourceTypes),
      selectedFilters: selectedToolsetsFilters,
      showLoader: !areToolsetsLoaded || !!isMarketplaceLoading,
      setFilters: MarketplaceActions.setSelectedToolsetsFilters,
    };
  },
);

const selectConnectLinkEntity = (state: RootState) =>
  rootSelector(state).connectLinkEntity;

const selectRepairEntity = (state: RootState) =>
  rootSelector(state).repairEntity;

export const MarketplaceSelectors = {
  selectSelectedViewType,
  selectTableSort,
  selectIsBannerVisible,
  selectSelectedAgentsFilters,
  selectSelectedToolsetsFilters,
  selectSearchTerm,
  selectTrimmedSearchTerm,
  selectSelectedTab,
  selectSelectedEntitiesTab,
  selectApplyModelStatus,
  selectIsApplyingModel,
  selectDetailsModel,
  selectSourceTypes,
  selectToolsetSourceTypes,
  selectDeleteEntity,
  selectDetailsEntity,
  selectDetailsToolset,
  selectLoginEntity,
  selectShowLoader,
  selectFiltersContent,
  selectConnectLinkEntity,
  selectRepairEntity,
};
