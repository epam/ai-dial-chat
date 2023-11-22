/* eslint-disable @typescript-eslint/no-empty-function */
import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Feature } from '@/src/types/features';
import { StorageType } from '@/src/types/storage';

import { RootState } from '..';

export interface SettingsState {
  appName: string;
  isIframe: boolean;
  isAuthDisabled: boolean;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  codeWarning: string;
  defaultModelId: string | undefined;
  defaultRecentModelsIds: string[];
  defaultRecentAddonsIds: string[];
  storageType: StorageType | string;
}

const initialState: SettingsState = {
  appName: 'AI Dial',
  isIframe: false,
  isAuthDisabled: false,
  footerHtmlMessage: '',
  enabledFeatures: [],
  codeWarning: '',
  defaultModelId: undefined,
  defaultRecentModelsIds: [],
  defaultRecentAddonsIds: [],
  storageType: 'browserStorage',
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    initApp: (state) => state,
    setAppName: (
      state,
      { payload }: PayloadAction<SettingsState['appName']>,
    ) => {
      state.appName = payload;
    },
    setIsIframe: (
      state,
      { payload }: PayloadAction<SettingsState['isIframe']>,
    ) => {
      state.isIframe = payload;
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
  },
});

const rootSelector = (state: RootState): SettingsState => state.settings;

const selectAppName = createSelector([rootSelector], (state) => {
  return state.appName;
});

const selectIsIframe = createSelector([rootSelector], (state) => {
  return state.isIframe;
});

const selectFooterHtmlMessage = createSelector([rootSelector], (state) => {
  return state.footerHtmlMessage;
});

const selectEnabledFeatures = createSelector([rootSelector], (state) => {
  return new Set(state.enabledFeatures);
});

const isFeatureEnabled = createSelector(
  [selectEnabledFeatures, (_, featureName: Feature) => featureName],
  (enabledFeatures, featureName) => {
    return enabledFeatures.has(featureName);
  },
);

const selectCodeWarning = createSelector([rootSelector], (state) => {
  return state.codeWarning;
});

const selectDefaultModelId = createSelector([rootSelector], (state) => {
  return state.defaultModelId;
});
const selectDefaultRecentModelsIds = createSelector([rootSelector], (state) => {
  return state.defaultRecentModelsIds;
});
const selectDefaultRecentAddonsIds = createSelector([rootSelector], (state) => {
  return state.defaultRecentAddonsIds;
});
const selectIsAuthDisabled = createSelector([rootSelector], (state) => {
  return state.isAuthDisabled;
});
const selectStorageType = createSelector([rootSelector], (state) => {
  return state.storageType;
});

export const SettingsActions = settingsSlice.actions;
export const SettingsSelectors = {
  selectAppName,
  selectIsIframe,
  selectFooterHtmlMessage,
  selectEnabledFeatures,
  isFeatureEnabled,
  selectCodeWarning,
  selectDefaultModelId,
  selectDefaultRecentModelsIds,
  selectDefaultRecentAddonsIds,
  selectIsAuthDisabled,
  selectStorageType,
};
