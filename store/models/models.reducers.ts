import { i18n } from 'next-i18next';

import { ErrorMessage } from '@/types/error';
import { OpenAIEntityModel } from '@/types/openai';

import { RootState } from '../index';

import { errorsMessages } from '@/constants/errors';
import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

export interface ModelsState {
  isLoading: boolean;
  error: ErrorMessage | undefined;
  models: OpenAIEntityModel[];
  modelsMap: Partial<Record<string, OpenAIEntityModel>>;
  defaultModelId: string | undefined;
  recentModelsIds: string[];
}

const initialState: ModelsState = {
  isLoading: false,
  error: undefined,
  models: [],
  modelsMap: {},
  defaultModelId: undefined,
  recentModelsIds: [],
};

export const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    setDefaultModelId: (
      state,
      { payload }: PayloadAction<{ defaultModelId: string }>,
    ) => {
      state.defaultModelId = payload.defaultModelId;
    },
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
          : [i18n?.t(errorsMessages.generalServer)],
      } as ErrorMessage;
    },
    initRecentModels: (
      state,
      {
        payload,
      }: PayloadAction<{
        defaultRecentModelsIds: string[];
        localStorageRecentModelsIds: string[];
      }>,
    ) => {
      if (payload.localStorageRecentModelsIds.length !== 0) {
        state.recentModelsIds = payload.localStorageRecentModelsIds;
      } else {
        state.recentModelsIds = payload.defaultRecentModelsIds;
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

const rootSelector = (state: RootState) => state.models;

export const selectModelsIsLoading = createSelector([rootSelector], (state) => {
  return state.isLoading;
});
export const selectModelsError = createSelector([rootSelector], (state) => {
  return state.error;
});
export const selectModels = createSelector([rootSelector], (state) => {
  return state.models;
});
export const selectModelsMap = createSelector([rootSelector], (state) => {
  return state.modelsMap;
});
export const selectDefaultModelId = createSelector([rootSelector], (state) => {
  return state.defaultModelId;
});
export const selectRecentModelsIds = createSelector([rootSelector], (state) => {
  return state.recentModelsIds;
});

export const {
  getModels,
  getModelsFail,
  getModelsSuccess,
  setDefaultModelId,
  initRecentModels,
  updateRecentModels,
} = modelsSlice.actions;
