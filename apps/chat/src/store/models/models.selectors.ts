import { createSelector } from '@reduxjs/toolkit';

import {
  getLocalizedEntityIdName,
  withEntityIdName,
} from '@/src/utils/app/application';
import { sortItemsVersions } from '@/src/utils/app/common';
import { withoutFileManagerPlaceholderByName } from '@/src/utils/app/file';
import {
  getGroupMarketplaceEntityKey,
  groupMarketplaceEntityAndSaveOrder,
} from '@/src/utils/app/marketplace';
import {
  filterHiddenEntities,
  shouldShowHiddenEntities,
} from '@/src/utils/app/models';
import { getIdWithoutVersionFromApiKey } from '@/src/utils/server/api';

import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { RootState } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { DEFAULT_AGENT, LAST_USED_AGENT } from '@/src/constants/chat';

import { UploadStatus } from '@epam/ai-dial-shared';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';

const rootSelector = (state: RootState) => state.models;

const selectModelStatus = (state: RootState) => rootSelector(state).status;

const selectAreModelsLoading = (state: RootState) =>
  selectModelStatus(state) === UploadStatus.LOADING ||
  selectModelStatus(state) === UploadStatus.UNINITIALIZED;

const selectAreModelsLoaded = (state: RootState) =>
  rootSelector(state).status === UploadStatus.LOADED;

const selectIsInstalledModelsInitialized = (state: RootState) =>
  rootSelector(state).isInstalledModelsInitialized;

const selectModelsError = (state: RootState) => rootSelector(state).error;

const selectIsRecentModelsLoaded = (state: RootState) =>
  rootSelector(state).recentModelsStatus === UploadStatus.LOADED;

const _selectModels = (state: RootState) => rootSelector(state).models;

const selectModels = createSelector(
  [
    _selectModels,
    SettingsSelectors.selectHiddenEntityTag,
    (_state, showHidden?: boolean) => showHidden,
  ],
  (models, hiddenEntityTag, showHidden) => {
    const filteredHidden = shouldShowHiddenEntities(hiddenEntityTag, showHidden)
      ? models
      : filterHiddenEntities(models, hiddenEntityTag);
    const withoutPlaceholder = withoutFileManagerPlaceholderByName(
      filteredHidden.map(withEntityIdName),
    );
    const sortedResponse = sortBy(withoutPlaceholder, (model) =>
      getLocalizedEntityIdName(model.name).toLowerCase(),
    );
    const sortedAgents = groupMarketplaceEntityAndSaveOrder(
      sortedResponse,
    ).flatMap(({ entities }) => {
      if (entities.length > 0 && entities[0].id !== entities[0].reference) {
        sortItemsVersions(entities);
      }

      return entities;
    });
    return sortedAgents;
  },
);

const selectModelsVersionGroupByGroupId = createSelector(
  [
    (state) => selectModels(state),
    (_state, versionGroupId: string) => versionGroupId,
  ],
  (models, versionGroupId) =>
    models.reduce((acc, model) => {
      if (getIdWithoutVersionFromApiKey(model.id) === versionGroupId) {
        return [...acc, model];
      }
      return acc;
    }, [] as DialAIEntityModel[]),
);

const selectModelTopics = createSelector(
  [
    _selectModels,
    SettingsSelectors.selectHiddenEntityTag,
    (_state, showHidden?: boolean) => showHidden,
  ],
  (models, hiddenEntityTag, showHidden) => {
    const filteredHidden = shouldShowHiddenEntities(hiddenEntityTag, showHidden)
      ? models
      : filterHiddenEntities(models, hiddenEntityTag);
    const withoutPlaceholder = withoutFileManagerPlaceholderByName(
      filteredHidden.map(withEntityIdName),
    );
    return sortBy(
      uniq(withoutPlaceholder?.flatMap((model) => model.topics ?? []) ?? []),
      (topic) => topic.toLowerCase(),
    );
  },
);

const selectModelsMap = (state: RootState) => rootSelector(state).modelsMap;

const selectRecentModelsIds = (state: RootState) =>
  rootSelector(state).recentModelsIds;

const selectModelTypeAgents = createSelector(
  [(state, showHidden?: boolean) => selectModels(state, showHidden)],
  (models) => {
    return models.filter((model) => model.type === EntityType.Model);
  },
);

const selectToolSupportingModels = createSelector(
  [(state) => selectModelTypeAgents(state, true)],
  (models) => {
    return models.filter((model) => model.features?.tools);
  },
);

const selectToolSupportingModelIds = createSelector(
  [selectToolSupportingModels],
  (models) => {
    return models.map((model) => model.id);
  },
);

const selectPublishRequestModels = (state: RootState) =>
  rootSelector(state).publishRequestModels;

const selectInstalledModels = (state: RootState) =>
  rootSelector(state).installedModels;

const selectInstalledModelIds = createSelector(
  [selectInstalledModels],
  (installedModels) => {
    return new Set(installedModels.map(({ id }) => id));
  },
);

const selectRecentWithInstalledModelsIds = createSelector(
  [selectRecentModelsIds, selectInstalledModelIds],
  (recentModelIds, installedModelIds) => {
    // TODO: implement Pin-behavior in future
    const installedWithoutRecents = Array.from(installedModelIds).filter(
      (id) => !recentModelIds.includes(id),
    );
    return [...recentModelIds, ...installedWithoutRecents];
  },
);

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectModelById = (state: RootState, modelId: string | undefined) =>
  modelId ? selectModelsMap(state)[modelId] : undefined;

const selectAllGroupModelKeySet = (state: RootState, references: string[]) => {
  const modelsMap = selectModelsMap(state);
  return new Set(
    references
      .map((reference) => modelsMap[reference])
      .filter((model) => !!model)
      .map((model) => getGroupMarketplaceEntityKey(model)),
  );
};

const selectDefaultModel = createSelector([selectModels], (models) =>
  models.find((model) => model.isDefault),
);

const selectDefaultModelOption = (state: RootState) =>
  rootSelector(state).defaultModelReference;

const selectDefaultModelReference = createSelector(
  [selectDefaultModelOption, selectDefaultModel],
  (defaultModelReference, defaultModel) => {
    if (defaultModelReference === LAST_USED_AGENT) {
      return undefined;
    }
    if (defaultModelReference === DEFAULT_AGENT) {
      return defaultModel?.reference;
    }
    return defaultModelReference;
  },
);

const selectUsageStats = (state: RootState) =>
  rootSelector(state).usageStatsById;

const selectUsageStatsById = createSelector(
  [selectUsageStats, (_state, id: string) => id],
  (usageStats, id) => usageStats[id],
);

const selectUsageStatsLoading = (state: RootState) =>
  rootSelector(state).usageStatsLoading;

export const ModelsSelectors = {
  selectModels,
  selectModelsVersionGroupByGroupId,
  selectModelsMap,
  selectModelById,
  selectModelsError,
  selectAreModelsLoading,
  selectAreModelsLoaded,
  selectIsInstalledModelsInitialized,
  selectRecentModelsIds,
  selectModelTypeAgents,
  selectPublishRequestModels,
  selectInstalledModels,
  selectInstalledModelIds,
  selectRecentWithInstalledModelsIds,
  selectModelTopics,
  selectInitialized,
  selectAllGroupModelKeySet,
  selectIsRecentModelsLoaded,
  selectDefaultModelOption,
  selectDefaultModelReference,
  selectToolSupportingModels,
  selectToolSupportingModelIds,
  selectUsageStats,
  selectUsageStatsById,
  selectUsageStatsLoading,
};
