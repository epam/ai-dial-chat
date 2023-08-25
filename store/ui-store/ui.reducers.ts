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

export const uiStoreSlice = createSlice({
  name: 'uiState',
  initialState,
  reducers: {
    setTheme: (state, { payload }: PayloadAction<ThemeType>) => {
      state.theme = payload;
    },
  },
});

const rootSelector = (state: RootState) => state.ui;

export const selectThemeState = createSelector([rootSelector], (state) => {
  return state.theme;
});
const { actions, reducer } = uiStoreSlice;
export const { setTheme } = actions;
export default reducer;
