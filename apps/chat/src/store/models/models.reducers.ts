import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { translate } from '@/src/utils/app/translation';

import { EntityType, UploadStatus } from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { DialAIEntityModel, ModelsMap } from '@/src/types/models';

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
}

const initialState: ModelsState = {
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  models: [],
  modelsMap: {},
  recentModelsIds: [],
};

export const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    init: (state) => state,
    getModels: (state) => {
      state.status = UploadStatus.LOADING;
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
          if (model.id !== model.reference) {
            acc[model.reference] = model;
          }

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
        title: translate('Error fetching models.'),
        code: payload.error.status?.toString() ?? 'unknown',
        messageLines: payload.error.statusText
          ? [payload.error.statusText]
          : [translate(errorsMessages.generalServer, { ns: 'common' })],
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
    addModel: (
      state,
      { payload }: PayloadAction<{ model: DialAIEntityModel }>,
    ) => {
      state.models.push(payload.model);
      state.modelsMap[payload.model.id] = payload.model;
    },
    // updateModel: (
    //   state,
    //   { payload }: PayloadAction<{ model: DialAIEntityModel }>,
    // ) => {
    //   const index = state.models.findIndex(
    //     (model) => model?.reference === payload.model.reference,
    //   );
    //   if (index > -1) {
    //     state.models[index] = payload.model;
    //   }

    //   if (state.modelsMap[payload.model?.reference]) {
    //     state.modelsMap[payload.model?.reference] = payload.model;
    //   }
      
    // },
    // deleteModel: (state, { payload }: PayloadAction<{ modelId: string }>) => {
    //   state.models = state.models.filter(
    //     (model) => model.name !== payload.modelId,
    //   );
    //   state.recentModelsIds = state.recentModelsIds.filter(
    //     (id) => id !== payload.modelId,
    //   );
    // },
    updateModel: (
      state,
      { payload }: PayloadAction<{ model: DialAIEntityModel, oldApplicationName: string }>,
    ) => {
      const index = state.models.findIndex(
        (model) => model?.reference === payload.model.reference,
      );
    
      if (index > -1) {
        state.models[index] = payload.model;
        const recentModelIndex = state.recentModelsIds.findIndex((id) => id === payload.oldApplicationName);
        
        if (recentModelIndex > -1) {
          state.recentModelsIds[recentModelIndex] = payload.model.id;
        }
      }
    
      if (state.modelsMap[payload.model?.reference]) {
        state.modelsMap[payload.model?.reference] = payload.model;
      }
    },
    deleteModel: (state, { payload }: PayloadAction<{ modelId: string }>) => {
      state.models = state.models.filter(
        (model) => model.name !== payload.modelId,
      );
      state.recentModelsIds = state.recentModelsIds.filter(
        (id) => id !== payload.modelId,
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
};

export const ModelsActions = modelsSlice.actions;
