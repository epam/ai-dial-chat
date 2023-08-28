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
  },
});

const rootSelector = (state: RootState) => state.ui;

export const selectThemeState = createSelector([rootSelector], (state) => {
  return state.theme;
});
export const selectShowChatbar = createSelector([rootSelector], (state) => {
  return state.showChatbar;
});
export const selectShowPromptbar = createSelector([rootSelector], (state) => {
  return state.showPromptbar;
});
export const { setTheme, setShowChatbar, setShowPromptbar } = uiSlice.actions;
