import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ToolsetModel } from '@/src/types/toolsets';

import { ToolsetState } from '@/src/store/toolset/toolset.types';

import { DeleteType } from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';

type ToolsetsMap = Record<string, ToolsetModel>;

const initialState: ToolsetState = {
  initialized: false,
  toolsetsMap: {},
  toolsetsStatus: UploadStatus.UNINITIALIZED,

  toolsetDetails: undefined,
  toolsetDetailsStatus: UploadStatus.UNINITIALIZED,
  installedToolsets: [],
  isInstalledToolsetsInitialized: false,
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
        acc[toolset.reference] = toolset;

        return acc;
      }, {});
      state.toolsetsStatus = UploadStatus.LOADED;
    },
    setToolsets: (state, { payload }: PayloadAction<ToolsetModel[]>) => {
      state.toolsetsMap = {
        ...state.toolsetsMap,
        ...payload.reduce<ToolsetsMap>((acc, toolset) => {
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
        ...omit(state.toolsetsMap, [payload.oldToolset.reference]),
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
      _action: PayloadAction<{ references: string[]; action: DeleteType }>,
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
      state.toolsetsMap = omit(state.toolsetsMap, [payload.reference]);
    },
    deleteToolsetFail: (state) => state,
  },
});

export const ToolsetActions = toolsetSlice.actions;

export default toolsetSlice.reducer;
