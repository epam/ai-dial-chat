import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { PageType } from '@/src/types/common';
import { StorageType } from '@/src/types/storage';

import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { SettingsState } from './settings.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const initialState: SettingsState = {
  appName: 'AI Dial',
  isOverlay: false,
  isAuthDisabled: false,
  footerHtmlMessage: '',
  enabledFeatures: [],
  publicationFilters: [],
  codeWarning: '',
  announcement: '',
  defaultModelId: undefined,
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
    initApp: (state, _action: PayloadAction<PageType | undefined>) => state,
    setAppName: (
      state,
      { payload }: PayloadAction<SettingsState['appName']>,
    ) => {
      state.appName = payload;
    },
    setIsOverlay: (
      state,
      { payload }: PayloadAction<SettingsState['isOverlay']>,
    ) => {
      state.isOverlay = payload;
    },
    setAuthDisabled: (
      state,
      { payload }: PayloadAction<SettingsState['isAuthDisabled']>,
    ) => {
      state.isAuthDisabled = payload;
    },
    setFooterHtmlMessage: (
      state,
      { payload }: PayloadAction<SettingsState['footerHtmlMessage']>,
    ) => {
      state.footerHtmlMessage = payload;
    },
    setEnabledFeatures: (
      state,
      { payload }: PayloadAction<SettingsState['enabledFeatures']>,
    ) => {
      state.enabledFeatures = payload;
    },
    setPublicationFilters: (
      state,
      { payload }: PayloadAction<SettingsState['publicationFilters']>,
    ) => {
      state.publicationFilters = payload;
    },
    setCodeWarning: (
      state,
      { payload }: PayloadAction<SettingsState['codeWarning']>,
    ) => {
      state.codeWarning = payload;
    },
    setDefaultModelId: (
      state,
      { payload }: PayloadAction<{ defaultModelId: string }>,
    ) => {
      state.defaultModelId = payload.defaultModelId;
    },
    setOverlayDefaultModelId: (
      state,
      { payload }: PayloadAction<{ overlayDefaultModelId: string | undefined }>,
    ) => {
      state.overlayDefaultModelId = payload.overlayDefaultModelId;
    },
    setDefaultRecentModelsIds: (
      state,
      { payload }: PayloadAction<{ defaultRecentModelsIds: string[] }>,
    ) => {
      state.defaultRecentModelsIds = payload.defaultRecentModelsIds;
    },
    setDefaultRecentAddonsIds: (
      state,
      { payload }: PayloadAction<{ defaultRecentAddonsIds: string[] }>,
    ) => {
      state.defaultRecentAddonsIds = payload.defaultRecentAddonsIds;
    },
    setStorageType: (
      state,
      { payload }: PayloadAction<{ storageType: StorageType }>,
    ) => {
      state.storageType = payload.storageType;
    },
    setThemeHostDefined: (
      state,
      { payload }: PayloadAction<{ themesHostDefined: boolean }>,
    ) => {
      state.themesHostDefined = payload.themesHostDefined;
    },
    setIsolatedModelId: (state, { payload }: PayloadAction<string>) => {
      state.isolatedModelId = payload;
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
  },
});

export const SettingsActions = settingsSlice.actions;
