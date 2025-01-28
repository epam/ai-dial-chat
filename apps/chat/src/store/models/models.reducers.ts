import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import { translate } from '@/src/utils/app/translation';

import { ApplicationStatus } from '@/src/types/applications';
import { ErrorMessage } from '@/src/types/error';
import {
  DialAIEntityModel,
  InstalledModel,
  PublishRequestDialAIEntityModel,
} from '@/src/types/models';

import { RECENT_MODELS_COUNT } from '@/src/constants/chat';
import { errorsMessages } from '@/src/constants/errors';
import { DeleteType } from '@/src/constants/marketplace';

import * as ModelsSelectors from './models.selectors';
import { ModelUpdatedValues, ModelsState } from './models.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import cloneDeep from 'lodash-es/cloneDeep';
import omit from 'lodash-es/omit';
import uniq from 'lodash-es/uniq';

export { ModelsSelectors };

const initialState: ModelsState = {
  initialized: false,
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  models: [],
  modelsMap: {},
  installedModels: [],
  recentModelsIds: [],
  recentModelsStatus: UploadStatus.UNINITIALIZED,
  isInstalledModelsInitialized: false,
  publishRequestModels: [],
  publishedApplicationIds: [],
};

export const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    getModels: (state) => {
      state.status = UploadStatus.LOADING;
    },
    getInstalledModelIds: (state) => state,
    getInstalledModelIdsFail: (state, _action: PayloadAction<string[]>) =>
      state,
    getInstalledModelsSuccess: (
      state,
      { payload }: PayloadAction<InstalledModel[]>,
    ) => {
      state.installedModels = payload;
      state.isInstalledModelsInitialized = true;
    },
    addInstalledModels: (
      state,
      _action: PayloadAction<{
        references: string[];
        showSuccessToast?: boolean;
        updateRecentModels?: boolean;
      }>,
    ) => state,
    removeInstalledModels: (
      state,
      _action: PayloadAction<{ references: string[]; action: DeleteType }>,
    ) => state,
    updateInstalledModelsSuccess: (
      state,
      { payload }: PayloadAction<{ installedModels: InstalledModel[] }>,
    ) => {
      state.installedModels = payload.installedModels;
    },
    updateInstalledModelFail: (state) => state,
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
        localStorageRecentModelsIds: string[] | undefined;
        defaultModelId: string | undefined;
      }>,
    ) => {
      const isDefaultModelAvailable = state.models.some(
        ({ id }) => id === payload.defaultModelId,
      );

      if (payload.localStorageRecentModelsIds) {
        state.recentModelsIds = payload.localStorageRecentModelsIds;
      } else if (payload.defaultRecentModelsIds.length) {
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
      state.recentModelsStatus = UploadStatus.LOADED;
    },
    updateRecentModels: (
      state,
      { payload }: PayloadAction<{ modelId: string }>,
    ) => {
      const newModel = state.modelsMap[payload.modelId];
      if (!newModel) return;

      const recentModels = state.recentModelsIds.map(
        (id) => state.modelsMap[id],
      );
      const oldIndex = recentModels.findIndex((m) => m?.name === newModel.name);
      if (oldIndex >= 0) {
        if (recentModels[oldIndex]?.reference !== payload.modelId) {
          //replace
          const newIds = [...state.recentModelsIds];
          newIds[oldIndex] = payload.modelId;
          state.recentModelsIds = newIds;
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
    setPublishedApplicationIds: (
      state,
      {
        payload,
      }: PayloadAction<{
        modelIds: string[];
      }>,
    ) => {
      state.publishedApplicationIds = payload.modelIds;
    },
    addModels: (
      state,
      { payload }: PayloadAction<{ models: DialAIEntityModel[] }>,
    ) => {
      state.models = [...state.models, ...payload.models];
      payload.models.forEach((model) => {
        state.modelsMap[model.id] = model;
        state.modelsMap[model.reference] = model;
      });
    },
    updateModel: (
      state,
      {
        payload,
      }: PayloadAction<{
        model: DialAIEntityModel;
        oldApplicationId: string;
      }>,
    ) => {
      const oldModel = state.modelsMap[payload.model.reference];
      //Copy permissions and sharedWithMe after update
      const newModel: DialAIEntityModel = {
        sharedWithMe: oldModel?.sharedWithMe,
        permissions: oldModel?.permissions,
        ...payload.model,
      };

      state.models = state.models.map((model) =>
        model.reference === newModel.reference ? newModel : model,
      );
      state.modelsMap = omit(state.modelsMap, [payload.oldApplicationId]);
      state.modelsMap[newModel.id] = newModel;
      state.modelsMap[newModel.reference] = newModel;
    },
    deleteModels: (
      state,
      { payload }: PayloadAction<{ references: string[] }>,
    ) => {
      const ids = payload.references
        .map((reference) => state.modelsMap[reference]?.id)
        .filter(Boolean) as string[];
      state.models = state.models.filter(
        (model) => !payload.references.includes(model.reference),
      );
      state.recentModelsIds = state.recentModelsIds.filter(
        (id) => !payload.references.includes(id),
      );
      state.modelsMap = omit(state.modelsMap, [...payload.references, ...ids]);
    },
    addPublishRequestModels: (
      state,
      {
        payload,
      }: PayloadAction<{
        models: PublishRequestDialAIEntityModel[];
      }>,
    ) => {
      state.publishRequestModels = combineEntities(
        state.publishRequestModels,
        payload.models,
      );
    },
    updateFunctionStatus: (
      state,
      {
        payload,
      }: PayloadAction<{
        id: string;
        status: ApplicationStatus;
      }>,
    ) => {
      const targetModel = state.modelsMap[payload.id];

      if (targetModel && targetModel.functionStatus) {
        const updatedModel = cloneDeep(targetModel);
        updatedModel.functionStatus = payload.status;

        state.models = state.models.map((model) =>
          model.reference === targetModel.reference ? updatedModel : model,
        );
        state.modelsMap[targetModel.id] = updatedModel;
        state.modelsMap[targetModel.reference] = updatedModel;
      }
    },
    updateLocalModels: (
      state,
      {
        payload,
      }: PayloadAction<{
        modelsToUpdate: ModelUpdatedValues[];
      }>,
    ) => {
      payload.modelsToUpdate.forEach((modelToUpdate) => {
        const model = state.modelsMap[modelToUpdate.reference];

        if (model) {
          const updatedModel = {
            ...model,
            ...modelToUpdate.updatedValues,
          };
          state.modelsMap[model.reference] = updatedModel;
          state.modelsMap[model.id] = updatedModel;

          state.models = state.models.map((modelFromState) => {
            if (modelFromState.reference === modelToUpdate.reference) {
              return {
                ...modelFromState,
                ...modelToUpdate.updatedValues,
              };
            }

            return modelFromState;
          });
        }
      });
    },
  },
});

export const ModelsActions = modelsSlice.actions;
