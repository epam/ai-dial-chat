import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { translate } from '@/src/utils/app/translation';

import { EntityType, UploadStatus } from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { DialAIEntityModel, ModelsMap } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { RECENT_MODELS_COUNT } from '@/src/constants/chat';
import { errorsMessages } from '@/src/constants/errors';

import { RootState } from '../index';

import uniq from 'lodash-es/uniq';

export interface ModelsState {
  status: UploadStatus;
  error: ErrorMessage | undefined;
  models: DialAIEntityModel[];
  modelsMap: ModelsMap;
  recentModelsIds: string[];
  favoriteApplicationsIds: string[];
}

const initialState: ModelsState = {
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  models: [],
  modelsMap: {},
  recentModelsIds: [],
  favoriteApplicationsIds: [],
};

export const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    init: (state) => state,
    getModels: (state) => {
      state.status = UploadStatus.LOADING;
    },
    initFavoriteApplicationsIds: (
      state,
      { payload }: PayloadAction<{ appsIds: string[] }>,
    ) => {
      state.favoriteApplicationsIds = payload.appsIds;
    },
    updateFavoriteApplicationsIds: (
      state,
      { payload }: PayloadAction<{ appsIds: string[]; isFavorite: boolean }>,
    ) => {
      state.favoriteApplicationsIds = payload.isFavorite
        ? [...state.favoriteApplicationsIds, ...payload.appsIds]
        : state.favoriteApplicationsIds.filter((id) =>
            payload.appsIds.some((appsId) => id !== appsId),
          );
    },
    getModelsSuccess: (
      state,
      { payload }: PayloadAction<{ models: DialAIEntityModel[] }>,
    ) => {
      state.status = UploadStatus.LOADED;
      state.error = undefined;
      state.models = payload.models;
      state.modelsMap = (payload.models as DialAIEntityModel[]).reduce(
        (acc, model) => {
          acc[model.id] = model;

          return acc;
        },
        {} as Record<string, DialAIEntityModel>,
      );
    },
    getModelsFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        error: { status?: string | number; statusText?: string };
      }>,
    ) => {
      state.status = UploadStatus.LOADED;
      state.error = {
        title: translate(errorsMessages.fetchingModelsFailed, {
          ns: Translation.Error,
        }),
        code:
          payload.error.status?.toString() ??
          translate('common.label.unknown', { ns: Translation.Common }),
        messageLines: payload.error.statusText
          ? [payload.error.statusText]
          : [
              translate(errorsMessages.generalServer, {
                ns: Translation.Error,
              }),
            ],
      } as ErrorMessage;
    },
    initRecentModels: (
      state,
      {
        payload,
      }: PayloadAction<{
        defaultRecentModelsIds: string[];
        localStorageRecentModelsIds: string[];
        defaultModelId: string | undefined;
      }>,
    ) => {
      const isDefaultModelAvailable = state.models.some(
        ({ id }) => id === payload.defaultModelId,
      );
      if (payload.localStorageRecentModelsIds.length !== 0) {
        state.recentModelsIds = payload.localStorageRecentModelsIds;
      } else if (payload.defaultRecentModelsIds.length !== 0) {
        state.recentModelsIds = payload.defaultRecentModelsIds;
      } else if (payload.defaultModelId && isDefaultModelAvailable) {
        state.recentModelsIds = [payload.defaultModelId];
      } else {
        state.recentModelsIds = [state.models[0].id];
      }
      state.recentModelsIds = uniq(state.recentModelsIds).slice(
        0,
        RECENT_MODELS_COUNT,
      );
    },
    updateRecentModels: (
      state,
      { payload }: PayloadAction<{ modelId: string; rearrange?: boolean }>,
    ) => {
      const newModel = state.modelsMap[payload.modelId];
      if (!newModel) return;

      const recentModels = state.recentModelsIds.map(
        (id) => state.modelsMap[id],
      );
      const oldIndex = recentModels.findIndex((m) => m?.name === newModel.name);
      if (oldIndex >= 0) {
        if (recentModels[oldIndex]?.id !== payload.modelId) {
          //replace
          const newIds = [...state.recentModelsIds];
          newIds[oldIndex] = payload.modelId;
          state.recentModelsIds = newIds;
        }
        if (!payload.rearrange) {
          return;
        }
      }

      const recentFilteredModels = state.recentModelsIds.filter(
        (recentModelId) => recentModelId !== payload.modelId,
      );
      recentFilteredModels.unshift(payload.modelId);

      state.recentModelsIds = uniq(recentFilteredModels).slice(
        0,
        RECENT_MODELS_COUNT,
      );
    },
  },
});

const rootSelector = (state: RootState): ModelsState => state.models;

const selectModelsIsLoading = createSelector([rootSelector], (state) => {
  return state.status === UploadStatus.LOADING;
});

const selectIsModelsLoaded = createSelector([rootSelector], (state) => {
  return state.status === UploadStatus.LOADED;
});

const selectModelsError = createSelector([rootSelector], (state) => {
  return state.error;
});

const selectModels = createSelector([rootSelector], (state) => {
  return state.models;
});

const selectModelsMap = createSelector([rootSelector], (state) => {
  return state.modelsMap;
});
const selectRecentModelsIds = createSelector([rootSelector], (state) => {
  return state.recentModelsIds;
});
const selectModel = createSelector(
  [selectModelsMap, (_state, modelId: string) => modelId],
  (modelsMap, modelId) => {
    return modelsMap[modelId];
  },
);

const selectRecentModels = createSelector(
  [selectRecentModelsIds, selectModelsMap],
  (recentModelsIds, modelsMap) => {
    return recentModelsIds.map((id) => modelsMap[id]).filter(Boolean);
  },
);

const selectModelsOnly = createSelector([selectModels], (models) => {
  return models.filter((model) => model.type === EntityType.Model);
});

const selectFavoriteApplicationsIds = createSelector(
  [rootSelector],
  (state) => {
    return state.favoriteApplicationsIds;
  },
);

const selectAppsOnly = createSelector([selectModels], (models) => {
  return models.filter((model) => model.type === EntityType.Application);
});

export const ModelsSelectors = {
  selectIsModelsLoaded,
  selectModelsIsLoading,
  selectModelsError,
  selectModels,
  selectModelsMap,
  selectRecentModelsIds,
  selectRecentModels,
  selectModel,
  selectModelsOnly,
  selectAppsOnly,
  selectFavoriteApplicationsIds,
};

export const ModelsActions = modelsSlice.actions;
