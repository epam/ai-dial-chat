import { Feature } from '@/src/types/features';

import { RootState } from '..';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

export interface SettingsState {
  isIframe: boolean;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
}

const initialState: SettingsState = {
  isIframe: false,
  footerHtmlMessage: '',
  enabledFeatures: [],
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

export const SettingsActions = settingsSlice.actions;
export const SettingsSelectors = {
  selectIsIframe,
  selectFooterHtmlMessage,
  selectEnabledFeatures,
};
