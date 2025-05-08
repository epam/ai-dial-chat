import { createSelector } from '@reduxjs/toolkit';

import { sortItemsVersions } from '@/src/utils/app/common';
import {
  getGroupModelKey,
  groupModelsAndSaveOrder,
} from '@/src/utils/app/models';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { EntityType } from '@/src/types/common';
import { RootState } from '@/src/types/store';

import { ModelsState } from './models.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';

const rootSelector = (state: RootState): ModelsState => state.models;

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

const selectModels = createSelector([rootSelector], (state) => {
  const sortedResponse = sortBy(state.models, (model) =>
    model.name.toLowerCase(),
  );
  const sortedAgents = groupModelsAndSaveOrder(sortedResponse).flatMap(
    ({ entities }) => {
      if (entities.length > 0 && entities[0].id !== entities[0].reference) {
        sortItemsVersions(entities);
      }

      return entities;
    },
  );
  return sortedAgents;
});

const selectModelTopics = createSelector([rootSelector], (state) => {
  return sortBy(
    uniq(state.models?.flatMap((model) => model.topics ?? []) ?? []),
    (topic) => topic.toLowerCase(),
  );
});

const selectModelsMap = (state: RootState) => rootSelector(state).modelsMap;

const selectRecentModelsIds = (state: RootState) =>
  rootSelector(state).recentModelsIds;

const selectRecentModels = createSelector(
  [selectRecentModelsIds, selectModelsMap],
  (recentModelsIds, modelsMap) => {
    return recentModelsIds.map((id) => modelsMap[id]).filter(Boolean);
  },
);

const selectModelsOnly = createSelector([selectModels], (models) => {
  return models.filter((model) => model.type === EntityType.Model);
});

const selectPublishRequestModels = (state: RootState) =>
  rootSelector(state).publishRequestModels;

const selectPublishedApplicationIds = (state: RootState) =>
  rootSelector(state).publishedApplicationIds;

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

const selectCustomModels = createSelector([rootSelector], (state) => {
  return state.models.filter((model) => model.reference !== model.id);
});

const selectSharedWithMeModels = createSelector(
  [selectCustomModels],
  (customModels) => {
    return customModels.filter((model) => model.sharedWithMe);
  },
);

const selectSharedWriteModels = createSelector(
  [selectCustomModels],
  (customModels) => {
    return customModels.filter((model) => canWriteSharedWithMe(model));
  },
);

const selectModelById = (state: RootState, modelId: string | undefined) =>
  modelId ? selectModelsMap(state)[modelId] : undefined;

const selectAllGroupModelKeySet = (state: RootState, references: string[]) => {
  const modelsMap = selectModelsMap(state);
  return new Set(
    references
      .map((reference) => modelsMap[reference])
      .filter(Boolean)
      .map((model) => getGroupModelKey(model!)),
  );
};

export const ModelsSelectors = {
  selectModels,
  selectModelsMap,
  selectModelById,
  selectModelsError,
  selectAreModelsLoading,
  selectAreModelsLoaded,
  selectIsInstalledModelsInitialized,
  selectRecentModels,
  selectRecentModelsIds,
  selectModelsOnly,
  selectPublishRequestModels,
  selectPublishedApplicationIds,
  selectInstalledModels,
  selectInstalledModelIds,
  selectRecentWithInstalledModelsIds,
  selectModelTopics,
  selectInitialized,
  selectCustomModels,
  selectSharedWithMeModels,
  selectSharedWriteModels,
  selectAllGroupModelKeySet,
  selectIsRecentModelsLoaded,
};
