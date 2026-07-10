import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import {
  addToMarketplaceEntitiesMap,
  deleteFromMarketplaceEntitiesMap,
} from '@/src/utils/app/marketplace';

import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import {
  ToolsetCredentialsLevel,
  ToolsetEditorSteps,
  ToolsetModel,
} from '@/src/types/toolsets';

import { ToolsetState } from '@/src/store/toolset/toolset.types';

import { ToolsetAuthTypes, UploadStatus } from '@epam/ai-dial-shared';

const initialState: ToolsetState = {
  initialized: false,
  toolsetsMap: {},
  toolsetsStatus: UploadStatus.UNINITIALIZED,

  toolsetDetails: undefined,
  toolsetDetailsStatus: UploadStatus.UNINITIALIZED,
  installedToolsets: [],
  isInstalledToolsetsInitialized: false,

  editorStep: ToolsetEditorSteps.General,

  publishRequestToolsets: [],
};

export const toolsetSlice = createSlice({
  name: 'toolset',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    getToolsets: (state) => {
      state.toolsetsStatus = UploadStatus.LOADING;
    },
    getToolsetsSuccess: (state, { payload }: PayloadAction<ToolsetModel[]>) => {
      state.toolsetsMap = addToMarketplaceEntitiesMap(
        state.toolsetsMap ?? {},
        ...payload,
      );
      state.toolsetsStatus = UploadStatus.LOADED;
    },
    setToolsets: (state, { payload }: PayloadAction<ToolsetModel[]>) => {
      state.toolsetsMap = addToMarketplaceEntitiesMap(
        state.toolsetsMap,
        ...payload,
      );
    },

    createToolset: (
      state,
      _action: PayloadAction<{
        data: Omit<ToolsetModel, 'id'>;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
    },
    createToolsetFailed: (
      state,
      _action: PayloadAction<{ message: string } | undefined>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.FAILED;
    },

    getToolsetDetails: (state, _action: PayloadAction<{ id: string }>) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
    },
    getToolsetDetailsSuccess: (
      state,
      { payload }: PayloadAction<ToolsetModel>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
      state.toolsetDetails = payload;
      state.toolsetsMap = addToMarketplaceEntitiesMap(
        state.toolsetsMap,
        payload,
      );
    },
    getToolsetDetailsFailed: (
      state,
      _action: PayloadAction<{ id?: string } | undefined>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.FAILED;
      state.toolsetDetails = undefined;
    },
    clearToolsetDetails: (state) => {
      state.toolsetDetails = undefined;
      state.toolsetDetailsStatus = UploadStatus.UNINITIALIZED;
    },

    updateToolset: (
      state,
      {
        payload,
      }: PayloadAction<{
        oldToolset: ToolsetModel;
        newToolset: ToolsetModel;
        tabToOpen?: ToolsetEditorSteps;
        redirectUrl?: URL | string;
        exitAfterSave?: boolean;
        shouldSelectToolset?: boolean;
        auth?: {
          apiKey?: string;
          authLevel?: ToolsetCredentialsLevel;
        };
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
      state.toolsetDetails = payload.newToolset;
    },
    updateToolsetFailed: (
      state,
      {
        payload,
      }: PayloadAction<{
        oldToolset: ToolsetModel;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.FAILED;
      state.toolsetDetails = payload.oldToolset;
    },
    updateToolsetSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        oldToolset: ToolsetModel;
        newToolset: ToolsetModel;
        isExitingAfterSave?: boolean;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
      state.toolsetDetails = payload.newToolset;
      const tempMap = deleteFromMarketplaceEntitiesMap(
        state.toolsetsMap,
        payload.oldToolset.reference,
      );
      state.toolsetsMap = addToMarketplaceEntitiesMap(
        tempMap,
        payload.newToolset,
      );
    },
    setToolsetDetails: (
      state,
      { payload }: PayloadAction<{ reference: string } | undefined>,
    ) => {
      state.toolsetDetails = payload
        ? state.toolsetsMap[payload.reference]
        : payload;
    },
    getInstalledToolsets: (state) => state,
    getInstalledToolsetsFail: (state, _action: PayloadAction<string[]>) =>
      state,
    getInstalledToolsetsSuccess: (
      state,
      { payload }: PayloadAction<string[]>,
    ) => {
      state.installedToolsets = payload;
      state.isInstalledToolsetsInitialized = true;
    },
    addInstalledToolsets: (
      state,
      _action: PayloadAction<{
        references: string[];
        showSuccessToast?: boolean;
      }>,
    ) => state,
    removeInstalledToolsets: (
      state,
      _action: PayloadAction<{ references: string[] }>,
    ) => state,
    updateInstalledToolsetsSuccess: (
      state,
      { payload }: PayloadAction<{ installedToolsets: string[] }>,
    ) => {
      state.installedToolsets = payload.installedToolsets;
    },
    updateInstalledToolsetsFail: (state) => state,
    deleteToolset: (state, _action: PayloadAction<{ reference: string }>) =>
      state,
    deleteToolsetSuccess: (
      state,
      { payload }: PayloadAction<{ reference: string }>,
    ) => {
      state.toolsetsMap = deleteFromMarketplaceEntitiesMap(
        state.toolsetsMap,
        payload.reference,
      );
    },
    deleteToolsetFail: (state) => state,

    startSignInProcess: (
      state,
      _action: PayloadAction<{
        authLevel: ToolsetCredentialsLevel;
        apiKey?: string;
        toolset: ToolsetModel;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
    },
    logInToolset: (
      state,
      _action: PayloadAction<{
        toolsetId: string;
        authLevel: ToolsetCredentialsLevel;
        authType: ToolsetAuthTypes;
        code?: string;
        apiKey?: string;
        callbackUrl?: string;
        isAdmin?: boolean;
        isPopup?: boolean;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
    },
    logInToolsetSuccess: (
      state,
      _action: PayloadAction<{
        authLevel: ToolsetCredentialsLevel;
        toolsetId: string;
        isAdmin?: boolean;
        skipToastMessage?: boolean;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
    },
    logInToolsetFail: (
      state,
      _action: PayloadAction<{ skipToastMessage?: boolean } | undefined>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
    },
    logOutToolset: (
      state,
      _action: PayloadAction<{
        toolsetId: string;
        authType: ToolsetAuthTypes;
        authLevel: ToolsetCredentialsLevel;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
    },
    logOutToolsetSuccess: (state) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
    },
    logOutToolsetFail: (state) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
    },
    setEditorStep: (state, { payload }: PayloadAction<ToolsetEditorSteps>) => {
      state.editorStep = payload;
    },
    initQueryParams: (state) => state,
    addPublishRequestToolsets: (
      state,
      {
        payload,
      }: PayloadAction<{
        toolsets: PublishRequestDialAIEntityModel[];
      }>,
    ) => {
      state.publishRequestToolsets = combineEntities(
        state.publishRequestToolsets,
        payload.toolsets,
      );
    },
    exitEditor: (
      state,
      _action: PayloadAction<{
        redirectUrl?: URL | string;
        shouldSelectToolset?: boolean;
      }>,
    ) => state,
    repairToolset: (state, _action: PayloadAction<{ id: string }>) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
    },
    repairToolsetFailed: (
      state,
      _action: PayloadAction<{ id: string; status?: number; traceId?: string }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
    },
  },
});

export const ToolsetActions = toolsetSlice.actions;

export default toolsetSlice.reducer;
