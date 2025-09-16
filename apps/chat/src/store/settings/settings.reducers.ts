import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { PageType } from '@/src/types/common';
import { StorageType } from '@/src/types/storage';

import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { SettingsState } from './settings.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const initialState: SettingsState = {
  appName: 'AI DIAL',
  isOverlay: false,
  isAuthDisabled: false,
  footerHtmlMessage: '',
  enabledFeatures: [],
  enabledFeaturesData: {},
  publicationFilters: [],
  codeWarning: '',
  announcement: '',
  defaultModelReference: undefined,
  defaultRecentModelsIds: [],
  defaultRecentAddonsIds: [],
  storageType: StorageType.BrowserStorage,
  themesHostDefined: false,
  customRenderers: [],
  defaultAssistantSubmodelId: FALLBACK_ASSISTANT_SUBMODEL_ID,
  topics: [],
  codeEditorPythonVersions: [],
  providerId: null,
  initialDataStatus: UploadStatus.UNINITIALIZED,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    preInitApp: (state) => state,
    initApp: (state, _action: PayloadAction<PageType | undefined>) => state,
    setEnabledFeatures: (
      state,
      { payload }: PayloadAction<SettingsState['enabledFeatures']>,
    ) => {
      state.enabledFeatures = payload;
    },
    setEnabledFeaturesData: (
      state,
      { payload }: PayloadAction<SettingsState['enabledFeaturesData']>,
    ) => {
      state.enabledFeaturesData = payload;
    },
    setDefaultModeReference: (
      state,
      { payload }: PayloadAction<{ defaultModeReference: string }>,
    ) => {
      state.defaultModelReference = payload.defaultModeReference;
    },
    setOverlayDefaultModelReference: (
      state,
      {
        payload,
      }: PayloadAction<{ overlayDefaultModelReference: string | undefined }>,
    ) => {
      state.overlayDefaultModelReference = payload.overlayDefaultModelReference;
    },
    setOverlayConversationId: (state, { payload }: PayloadAction<string>) => {
      state.overlayConversationId = payload;
    },
    setIsSignInInSameWindow: (state, { payload }: PayloadAction<boolean>) => {
      state.isSignInInSameWindow = payload;
    },
    initStart: (state) => {
      state.initialDataStatus = UploadStatus.LOADING;
    },
    initComplete: (state) => {
      state.initialDataStatus = UploadStatus.LOADED;
    },
    setDefaultRecentModelsIds: (
      state,
      { payload }: PayloadAction<string[]>,
    ) => {
      state.defaultRecentModelsIds = payload;
    },
    setThemesHostDefined: (state, { payload }: PayloadAction<boolean>) => {
      state.themesHostDefined = payload;
    },
  },
});

export const SettingsActions = settingsSlice.actions;
