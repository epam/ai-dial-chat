/* eslint-disable @typescript-eslint/no-empty-function */
import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Feature } from '@/src/types/features';

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
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
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
  return state.enabledFeatures;
});

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

export const SettingsActions = settingsSlice.actions;
export const SettingsSelectors = {
  selectAppName,
  selectIsIframe,
  selectFooterHtmlMessage,
  selectEnabledFeatures,
  selectCodeWarning,
  selectDefaultModelId,
  selectDefaultRecentModelsIds,
  selectDefaultRecentAddonsIds,
  selectIsAuthDisabled,
};
