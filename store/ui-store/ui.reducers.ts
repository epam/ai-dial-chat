import { RootState } from '..';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

export type ThemeType = 'light' | 'dark';
export interface UIState {
  theme: ThemeType;
  showChatbar: boolean;
  showPromptbar: boolean;
  isUserSettingsOpen: boolean;
  isProfileOpen: boolean;
  isCompareMode: boolean;
}

const initialState: UIState = {
  theme: 'dark',
  showChatbar: true,
  showPromptbar: true,
  isUserSettingsOpen: false,
  isProfileOpen: false,
  isCompareMode: false,
};

export const uiSlice = createSlice({
  name: 'uiState',
  initialState,
  reducers: {
    setTheme: (state, { payload }: PayloadAction<ThemeType>) => {
      state.theme = payload;
    },
    setShowChatbar: (
      state,
      { payload }: PayloadAction<UIState['showChatbar']>,
    ) => {
      state.showChatbar = payload;
    },
    setShowPromptbar: (
      state,
      { payload }: PayloadAction<UIState['showPromptbar']>,
    ) => {
      state.showPromptbar = payload;
    },
    setIsUserSettingsOpen: (
      state,
      { payload }: PayloadAction<UIState['isUserSettingsOpen']>,
    ) => {
      state.isUserSettingsOpen = payload;
    },
    setIsProfileOpen: (
      state,
      { payload }: PayloadAction<UIState['isProfileOpen']>,
    ) => {
      state.isProfileOpen = payload;
    },
    setIsCompareMode: (
      state,
      { payload }: PayloadAction<UIState['isCompareMode']>,
    ) => {
      state.isCompareMode = payload;
    },
  },
});

const rootSelector = (state: RootState) => state.ui;

const selectThemeState = createSelector([rootSelector], (state) => {
  return state.theme;
});
const selectShowChatbar = createSelector([rootSelector], (state) => {
  return state.showChatbar;
});
const selectShowPromptbar = createSelector([rootSelector], (state) => {
  return state.showPromptbar;
});
const selectIsUserSettingsOpen = createSelector([rootSelector], (state) => {
  return state.isUserSettingsOpen;
});
const selectIsProfileOpen = createSelector([rootSelector], (state) => {
  return state.isProfileOpen;
});
const selectIsCompareMode = createSelector([rootSelector], (state) => {
  return state.isCompareMode;
});
export const uiActions = uiSlice.actions;

export const uiSelectors = {
  selectThemeState,
  selectShowChatbar,
  selectShowPromptbar,
  selectIsUserSettingsOpen,
  selectIsProfileOpen,
  selectIsCompareMode,
};
