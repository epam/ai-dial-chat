import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';

import { ToolsetState } from '@/src/store/toolset/toolset.types';

import { ToolsetAuthTypes, UploadStatus } from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';

type ToolsetsMap = Record<string, ToolsetModel>;

const initialState: ToolsetState = {
  initialized: false,
  toolsetsMap: {},
  toolsetsStatus: UploadStatus.UNINITIALIZED,

  toolsetDetails: undefined,
  toolsetDetailsStatus: UploadStatus.UNINITIALIZED,
  installedToolsets: [],
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
      state.toolsetsMap = payload.reduce<ToolsetsMap>((acc, toolset) => {
        acc[toolset.id] = toolset;
        acc[toolset.reference] = toolset;

        return acc;
      }, {});
      state.toolsetsStatus = UploadStatus.LOADED;
    },
    setToolsets: (state, { payload }: PayloadAction<ToolsetModel[]>) => {
      state.toolsetsMap = {
        ...state.toolsetsMap,
        ...payload.reduce<ToolsetsMap>((acc, toolset) => {
          acc[toolset.id] = toolset;
          acc[toolset.reference] = toolset;

          return acc;
        }, {}),
      };
    },

    createToolset: (
      state,
      _action: PayloadAction<{
        data: Omit<ToolsetModel, 'id'>;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
    },
    createToolsetFailed: (state) => {
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
      state.toolsetsMap[payload.reference] = payload;
      state.toolsetsMap[payload.id] = payload;
    },
    getToolsetDetailsFailed: (state) => {
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
        auth?: {
          apiKey?: string;
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
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADED;
      state.toolsetDetails = payload.newToolset;
      state.toolsetsMap = {
        ...omit(state.toolsetsMap, [payload.oldToolset.id]),
        [payload.newToolset.id]: payload.newToolset,
        [payload.newToolset.reference]: payload.newToolset,
      };
    },
    setToolsetDetails: (
      state,
      { payload }: PayloadAction<{ reference: string } | undefined>,
    ) => {
      state.toolsetDetails = payload
        ? state.toolsetsMap[payload.reference]
        : payload;
    },
    startSignInProcess: (
      state,
      _action: PayloadAction<{
        authLevel: ToolsetCredentialsLevel;
        apiKey?: string;
        toolset: ToolsetModel;
      }>,
    ) => state,
    logInToolset: (
      state,
      _action: PayloadAction<{
        toolsetId: string;
        authLevel: ToolsetCredentialsLevel;
        authType: ToolsetAuthTypes;
        code?: string;
        apiKey?: string;
      }>,
    ) => {
      state.toolsetDetailsStatus = UploadStatus.LOADING;
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
  },
});

export const ToolsetActions = toolsetSlice.actions;

export default toolsetSlice.reducer;
