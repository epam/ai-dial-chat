import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import {
  addToMarketplaceEntitiesMap,
  deleteFromMarketplaceEntitiesMap,
  getGroupMarketplaceEntityKey,
} from '@/src/utils/app/marketplace';
import { translateErrorMessage } from '@/src/utils/app/translateErrorMessage';
import { translate } from '@/src/utils/app/translation';

import { ApplicationStatus } from '@/src/types/applications';
import { ErrorMessage } from '@/src/types/error';
import {
  AgentUsageStats,
  DialAIEntityModel,
  InstalledModel,
  PublishRequestDialAIEntityModel,
} from '@/src/types/models';

import { DEFAULT_AGENT, RECENT_MODELS_COUNT } from '@/src/constants/chat';
import { errorsMessages } from '@/src/constants/errors';
import { DeleteType } from '@/src/constants/marketplace';

import { ModelUpdatedValues, ModelsState } from './models.types';

import { EntityPublicationInfo, UploadStatus } from '@epam/ai-dial-shared';
import cloneDeep from 'lodash-es/cloneDeep';
import uniq from 'lodash-es/uniq';

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
  defaultModelReference: DEFAULT_AGENT,

  usageStatsById: {},
  usageStatsLoading: false,
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
    addInstalledModelsFail: (
      state,
      _action: PayloadAction<{ references: string[] }>,
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
    setModels: (
      state,
      { payload }: PayloadAction<{ models: DialAIEntityModel[] }>,
    ) => {
      state.models = payload.models;
      state.modelsMap = addToMarketplaceEntitiesMap(
        state.modelsMap ?? {},
        ...payload.models,
      );
    },
    getModelsSuccess: (
      state,
      { payload }: PayloadAction<{ models: DialAIEntityModel[] }>,
    ) => {
      state.status = UploadStatus.LOADED;
      state.error = undefined;
      state.models = payload.models;
      state.modelsMap = addToMarketplaceEntitiesMap(
        state.modelsMap ?? {},
        ...payload.models,
      );
    },
    getDefaultModelSuccess: (
      state,
      { payload }: PayloadAction<{ model: DialAIEntityModel }>,
    ) => {
      if (state.status === UploadStatus.LOADED) return;
      state.modelsMap = addToMarketplaceEntitiesMap(
        state.modelsMap,
        payload.model,
      );
      if (!state.models.some((m) => m.reference === payload.model.reference)) {
        state.models = [...state.models, payload.model];
      }
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
          : [translateErrorMessage(errorsMessages.generalServer)],
      } as ErrorMessage;
    },

    initRecentModels: (
      state,
      {
        payload,
      }: PayloadAction<{
        defaultRecentModelsIds: string[];
        localStorageRecentModelsIds: string[] | undefined;
        defaultModelReference: string | undefined;
      }>,
    ) => {
      const isDefaultModelAvailable = state.models.some(
        ({ id, reference }) =>
          reference === payload.defaultModelReference ||
          id === payload.defaultModelReference,
      );

      if (payload.localStorageRecentModelsIds) {
        state.recentModelsIds = payload.localStorageRecentModelsIds;
      } else if (payload.defaultRecentModelsIds.length) {
        state.recentModelsIds = payload.defaultRecentModelsIds;
      } else if (payload.defaultModelReference && isDefaultModelAvailable) {
        state.recentModelsIds = [payload.defaultModelReference];
      } else if (state.models.length > 0) {
        state.recentModelsIds = [state.models[0].reference];
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

      const recentModels = state.recentModelsIds
        .map((id) => state.modelsMap[id])
        .filter(Boolean);
      const oldIndex = recentModels.findIndex(
        (m) =>
          getGroupMarketplaceEntityKey(m!) ===
          getGroupMarketplaceEntityKey(newModel),
      );
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
    addModels: (
      state,
      { payload }: PayloadAction<{ models: DialAIEntityModel[] }>,
    ) => {
      state.models = [...state.models, ...payload.models];

      state.modelsMap = addToMarketplaceEntitiesMap(
        state.modelsMap,
        ...payload.models,
      );
    },
    addModelToMap: (
      state,
      { payload: model }: PayloadAction<DialAIEntityModel>,
    ) => {
      state.modelsMap = addToMarketplaceEntitiesMap(state.modelsMap, model);
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
        ...oldModel,
        sharedWithMe: oldModel?.sharedWithMe,
        permissions: oldModel?.permissions,
        ...payload.model,
      };

      state.models = state.models.map((model) =>
        model.reference === newModel.reference ? newModel : model,
      );
      deleteFromMarketplaceEntitiesMap(
        state.modelsMap,
        payload.oldApplicationId,
      );
      state.modelsMap = addToMarketplaceEntitiesMap(state.modelsMap, newModel);
    },
    deleteModels: (
      state,
      { payload }: PayloadAction<{ references: string[] }>,
    ) => {
      state.models = state.models.filter(
        (model) => !payload.references.includes(model.reference),
      );
      state.recentModelsIds = state.recentModelsIds.filter(
        (id) => !payload.references.includes(id),
      );
      state.modelsMap = deleteFromMarketplaceEntitiesMap(
        state.modelsMap,
        ...payload.references,
      );
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
    updateModelPublicationInfo: (
      state,
      {
        payload,
      }: PayloadAction<{
        reference: string;
        updatedValues: EntityPublicationInfo;
      }>,
    ) => {
      const targetModel = state.publishRequestModels.find(
        (m) => m.reference === payload.reference,
      );

      if (!targetModel) return state;

      const updatedModel = {
        ...targetModel,
        publicationInfo: {
          ...targetModel.publicationInfo,
          ...payload.updatedValues,
        },
      };

      state.publishRequestModels = combineEntities(
        [updatedModel],
        state.publishRequestModels,
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
        state.modelsMap = addToMarketplaceEntitiesMap(
          state.modelsMap,
          updatedModel,
        );
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
          state.modelsMap = addToMarketplaceEntitiesMap(
            state.modelsMap,
            updatedModel,
          );

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
    setDefaultModelReference: (state, { payload }: PayloadAction<string>) => {
      state.defaultModelReference = payload;
    },
    getUsageStats: (state, _action: PayloadAction<{ id: string }>) => {
      state.usageStatsLoading = true;
    },
    getUsageStatsSuccess: (
      state,
      { payload }: PayloadAction<{ id: string; stats: AgentUsageStats }>,
    ) => {
      state.usageStatsLoading = false;
      state.usageStatsById = {
        ...state.usageStatsById,
        [payload.id]: payload.stats,
      };
    },
    getUsageStatsFailure: (state, _action: PayloadAction<{ id: string }>) => {
      state.usageStatsLoading = false;
    },
  },
});

export const ModelsActions = modelsSlice.actions;
