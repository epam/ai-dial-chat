import { i18n } from 'next-i18next';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { ErrorMessage } from '@/src/types/error';
import { ModelsMap } from '@/src/types/models';
import { OpenAIEntityModel } from '@/src/types/openai';

import { errorsMessages } from '@/src/constants/errors';

import { RootState } from '../index';

export interface ModelsState {
  isLoading: boolean;
  error: ErrorMessage | undefined;
  models: OpenAIEntityModel[];
  modelsMap: ModelsMap;
  recentModelsIds: string[];
}

const initialState: ModelsState = {
  isLoading: false,
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
      state.isLoading = true;
    },
    getModelsSuccess: (
      state,
      { payload }: PayloadAction<{ models: OpenAIEntityModel[] }>,
    ) => {
      state.isLoading = false;
      state.error = undefined;
      state.models = payload.models;
      state.modelsMap = (payload.models as OpenAIEntityModel[]).reduce(
        (acc, model) => {
          acc[model.id] = model;

          return acc;
        },
        {} as Record<string, OpenAIEntityModel>,
      );
    },
    getModelsFail: (state, { payload }: PayloadAction<{ error: any }>) => {
      state.isLoading = false;
      state.error = {
        title: i18n?.t('Error fetching models.'),
        code: payload.error.status || 'unknown',
        messageLines: payload.error.statusText
          ? [payload.error.statusText]
          : [i18n?.t(errorsMessages.generalServer, { ns: 'common' })],
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
      if (payload.localStorageRecentModelsIds.length !== 0) {
        state.recentModelsIds = payload.localStorageRecentModelsIds;
      } else if (payload.defaultRecentModelsIds.length !== 0) {
        state.recentModelsIds = payload.defaultRecentModelsIds;
      } else if (payload.defaultModelId) {
        state.recentModelsIds = [payload.defaultModelId];
      }
    },
    updateRecentModels: (
      state,
      { payload }: PayloadAction<{ modelId: string }>,
    ) => {
      const recentFilteredModels = state.recentModelsIds.filter(
        (recentModelId) => recentModelId !== payload.modelId,
      );
      recentFilteredModels.unshift(payload.modelId);

      state.recentModelsIds = recentFilteredModels;
    },
  },
});

const rootSelector = (state: RootState): ModelsState => state.models;

const selectModelsIsLoading = createSelector([rootSelector], (state) => {
  return state.isLoading;
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
