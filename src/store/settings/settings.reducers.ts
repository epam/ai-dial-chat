import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Feature } from '@/src/types/features';

import { RootState } from '..';

export interface SettingsState {
  isIframe: boolean;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  codeWarning: string;
  announcement: string;
}

const initialState: SettingsState = {
  isIframe: false,
  footerHtmlMessage: '',
  enabledFeatures: [],
  codeWarning: '',
  announcement: '',
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setIsIframe: (
      state,
      { payload }: PayloadAction<SettingsState['isIframe']>,
    ) => {
      state.isIframe = payload;
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
    setAnnouncement: (
      state,
      { payload }: PayloadAction<SettingsState['announcement']>,
    ) => {
      state.announcement = payload;
    },
  },
});

const rootSelector = (state: RootState) => state.settings;

const selectIsIframe = createSelector([rootSelector], (state) => {
  return state.isIframe;
});

const selectFooterHtmlMessage = createSelector([rootSelector], (state) => {
  return state.footerHtmlMessage;
});

const selectEnabledFeatures = createSelector([rootSelector], (state) => {
  return new Set(state.enabledFeatures);
});

const selectCodeWarning = createSelector([rootSelector], (state) => {
  return state.codeWarning;
});
const selectAnnouncement = createSelector([rootSelector], (state) => {
  return state.announcement;
});

export const SettingsActions = settingsSlice.actions;
export const SettingsSelectors = {
  selectIsIframe,
  selectFooterHtmlMessage,
  selectEnabledFeatures,
  selectCodeWarning,
  selectAnnouncement,
};
