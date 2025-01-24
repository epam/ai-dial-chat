import { createSelector } from '@reduxjs/toolkit';

import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { EntityType } from '@/src/types/common';

import { RootState } from '../index';
import { ModelsState } from './models.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import { sortBy } from 'lodash-es';
import groupBy from 'lodash-es/groupBy';
import orderBy from 'lodash-es/orderBy';
import uniq from 'lodash-es/uniq';

const rootSelector = (state: RootState): ModelsState => state.models;

export const selectModelsIsLoading = createSelector([rootSelector], (state) => {
  return (
    state.status === UploadStatus.LOADING ||
    state.status === UploadStatus.UNINITIALIZED
  );
});

export const selectIsModelsLoaded = createSelector([rootSelector], (state) => {
  return state.status === UploadStatus.LOADED;
});

export const selectIsInstalledModelsInitialized = createSelector(
  [rootSelector],
  (state) => {
    return state.isInstalledModelsInitialized;
  },
);

export const selectModelsError = createSelector([rootSelector], (state) => {
  return state.error;
});

export const selectIsRecentModelsLoaded = createSelector(
  [rootSelector],
  (state) => {
    return state.recentModelsStatus === UploadStatus.LOADED;
  },
);

export const selectModels = createSelector([rootSelector], (state) => {
  const groups = groupBy(state.models, (model) =>
    model.reference === model.id ? 'rest' : 'custom',
  );

  return sortBy(
    [
      ...(groups.rest ?? []),
      ...orderBy(groups.custom ?? [], 'version', 'desc'),
    ],
    (model) => model.name.toLowerCase(),
  );
});

export const selectModelTopics = createSelector([rootSelector], (state) => {
  return uniq(
    state.models?.flatMap((model) => model.topics ?? []) ?? [],
  ).sort();
});

export const selectModelsMap = createSelector([rootSelector], (state) => {
  return state.modelsMap;
});

export const selectRecentModelsIds = createSelector([rootSelector], (state) => {
  return state.recentModelsIds;
});

export const selectRecentModels = createSelector(
  [selectRecentModelsIds, selectModelsMap],
  (recentModelsIds, modelsMap) => {
    return recentModelsIds.map((id) => modelsMap[id]).filter(Boolean);
  },
);

export const selectModelsOnly = createSelector([selectModels], (models) => {
  return models.filter((model) => model.type === EntityType.Model);
});

export const selectPublishRequestModels = createSelector(
  [rootSelector],
  (state) => {
    return state.publishRequestModels;
  },
);

export const selectPublishedApplicationIds = createSelector(
  [rootSelector],
  (state) => {
    return state.publishedApplicationIds;
  },
);

export const selectInstalledModels = createSelector([rootSelector], (state) => {
  return state.installedModels;
});

export const selectInstalledModelIds = createSelector(
  [rootSelector],
  (state) => {
    return new Set(state.installedModels.map(({ id }) => id));
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

export const selectInitialized = createSelector(
  [rootSelector],
  (state) => state.initialized,
);

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

export const selectModelById = createSelector(
  [selectModelsMap, (_state, modelId) => modelId],
  (modelsMap, modelId) => {
    return modelsMap[modelId];
  },
);
