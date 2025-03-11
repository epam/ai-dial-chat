import { createSelector } from '@reduxjs/toolkit';

import { getGroupModelKey } from '@/src/utils/app/models';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { EntityType } from '@/src/types/common';
import { RootState } from '@/src/types/store';

import { ModelsState } from './models.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import groupBy from 'lodash-es/groupBy';
import orderBy from 'lodash-es/orderBy';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';

const rootSelector = (state: RootState): ModelsState => state.models;

const selectModelStatus = (state: RootState) => rootSelector(state).status;

export const selectModelsIsLoading = (state: RootState) =>
  selectModelStatus(state) === UploadStatus.LOADING ||
  selectModelStatus(state) === UploadStatus.UNINITIALIZED;

export const selectIsModelsLoaded = (state: RootState) =>
  rootSelector(state).status === UploadStatus.LOADED;

export const selectIsInstalledModelsInitialized = (state: RootState) =>
  rootSelector(state).isInstalledModelsInitialized;

export const selectModelsError = (state: RootState) =>
  rootSelector(state).error;

export const selectIsRecentModelsLoaded = (state: RootState) =>
  rootSelector(state).recentModelsStatus === UploadStatus.LOADED;

export const selectModels = createSelector([rootSelector], (state) => {
  const groups = groupBy(state.models, (model) =>
    model.reference === model.id ? 'rest' : 'custom',
  );

  return sortBy(
    [
      ...(groups.rest ?? []),
      ...orderBy(groups.custom ?? [], 'version', 'desc'), //TODO: fix semVer sorting
    ],
    (model) => model.name.toLowerCase(),
  );
});

export const selectModelTopics = createSelector([rootSelector], (state) => {
  return sortBy(
    uniq(state.models?.flatMap((model) => model.topics ?? []) ?? []),
    (topic) => topic.toLowerCase(),
  );
});

export const selectModelsMap = (state: RootState) =>
  rootSelector(state).modelsMap;

export const selectRecentModelsIds = (state: RootState) =>
  rootSelector(state).recentModelsIds;

export const selectRecentModels = createSelector(
  [selectRecentModelsIds, selectModelsMap],
  (recentModelsIds, modelsMap) => {
    return recentModelsIds.map((id) => modelsMap[id]).filter(Boolean);
  },
);

export const selectModelsOnly = createSelector([selectModels], (models) => {
  return models.filter((model) => model.type === EntityType.Model);
});

export const selectPublishRequestModels = (state: RootState) =>
  rootSelector(state).publishRequestModels;

export const selectPublishedApplicationIds = (state: RootState) =>
  rootSelector(state).publishedApplicationIds;

export const selectInstalledModels = (state: RootState) =>
  rootSelector(state).installedModels;

export const selectInstalledModelIds = createSelector(
  [selectInstalledModels],
  (installedModels) => {
    return new Set(installedModels.map(({ id }) => id));
  },
);

export const selectRecentWithInstalledModelsIds = createSelector(
  [selectRecentModelsIds, selectInstalledModelIds],
  (recentModelIds, installedModelIds) => {
    // TODO: implement Pin-behavior in future
    const installedWithoutRecents = Array.from(installedModelIds).filter(
      (id) => !recentModelIds.includes(id),
    );
    return [...recentModelIds, ...installedWithoutRecents];
  },
);

export const selectInitialized = (state: RootState) =>
  rootSelector(state).initialized;

export const selectCustomModels = createSelector([rootSelector], (state) => {
  return state.models.filter((model) => model.reference !== model.id);
});

export const selectSharedWithMeModels = createSelector(
  [selectCustomModels],
  (customModels) => {
    return customModels.filter((model) => model.sharedWithMe);
  },
);

export const selectSharedWriteModels = createSelector(
  [selectCustomModels],
  (customModels) => {
    return customModels.filter((model) => canWriteSharedWithMe(model));
  },
);

export const selectModelById = (
  state: RootState,
  modelId: string | undefined,
) => (modelId ? selectModelsMap(state)[modelId] : undefined);

export const selectAllGroupModelKeySet = (
  state: RootState,
  references: string[],
) => {
  const modelsMap = selectModelsMap(state);
  return new Set(
    references
      .map((reference) => modelsMap[reference])
      .filter(Boolean)
      .map((model) => getGroupModelKey(model!)),
  );
};
