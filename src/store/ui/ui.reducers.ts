import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Theme } from '@/src/types/settings';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { RootState } from '..';

export interface UIState {
  theme: Theme;
  showChatbar: boolean;
  showPromptbar: boolean;
  isUserSettingsOpen: boolean;
  isProfileOpen: boolean;
  isCompareMode: boolean;
  openedFoldersIds: string[];
  textOfClosedAnnouncement?: string | undefined;
  chatbarWidth?: number;
  promptbarWidth?: number;
}

const initialState: UIState = {
  theme: 'dark',
  showChatbar: false,
  showPromptbar: false,
  isUserSettingsOpen: false,
  isProfileOpen: false,
  isCompareMode: false,
  openedFoldersIds: [],
  textOfClosedAnnouncement: undefined,
  chatbarWidth: SIDEBAR_MIN_WIDTH,
  promptbarWidth: SIDEBAR_MIN_WIDTH,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    init: (state) => state,
    setTheme: (state, { payload }: PayloadAction<Theme>) => {
      state.theme = payload;
    },
    setChatbarWidth: (state, { payload }: PayloadAction<Partial<number>>) => {
      state.chatbarWidth = payload;
    },
    setPromptbarWidth: (state, { payload }: PayloadAction<Partial<number>>) => {
      state.promptbarWidth = payload;
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
    showToast: (
      state,
      _action: PayloadAction<{
        message?: string | null;
        type?: 'error' | 'loading' | 'success';
        response?: Response;
      }>,
    ) => state,
    setOpenedFoldersIds: (
      state,
      { payload }: PayloadAction<UIState['openedFoldersIds']>,
    ) => {
      const uniqueIds = Array.from(new Set(payload));
      state.openedFoldersIds = uniqueIds;
    },
    toggleFolder: (state, { payload }: PayloadAction<{ id: string }>) => {
      const isOpened = state.openedFoldersIds.includes(payload.id);
      if (isOpened) {
        state.openedFoldersIds = state.openedFoldersIds.filter(
          (id) => id !== payload.id,
        );
      } else {
        state.openedFoldersIds.push(payload.id);
      }
    },
    openFolder: (state, { payload }: PayloadAction<{ id: string }>) => {
      const isOpened = state.openedFoldersIds.includes(payload.id);
      if (!isOpened) {
        state.openedFoldersIds.push(payload.id);
      }
    },
    closeFolder: (state, { payload }: PayloadAction<{ id: string }>) => {
      const isOpened = state.openedFoldersIds.includes(payload.id);
      if (isOpened) {
        state.openedFoldersIds = state.openedFoldersIds.filter(
          (id) => id !== payload.id,
        );
      }
    },
    closeAnnouncement: (
      state,
      { payload }: PayloadAction<{ announcement: string | undefined }>,
    ) => {
      state.textOfClosedAnnouncement = payload.announcement;
    },
  },
});

const rootSelector = (state: RootState): UIState => state.ui;

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

const selectOpenedFoldersIds = createSelector([rootSelector], (state) => {
  return state.openedFoldersIds;
});
const selectIsFolderOpened = createSelector(
  [selectOpenedFoldersIds, (_state, id: string) => id],
  (ids, id): boolean => {
    return ids.includes(id);
  },
);
const selectTextOfClosedAnnouncement = createSelector(
  [rootSelector],
  (state) => {
    return state.textOfClosedAnnouncement;
  },
);

const selectChatbarWidth = createSelector([rootSelector], (state) => {
  return state.chatbarWidth;
});

const selectPromptbarWidth = createSelector([rootSelector], (state) => {
  return state.promptbarWidth;
});

export const UIActions = uiSlice.actions;

export const UISelectors = {
  selectThemeState,
  selectShowChatbar,
  selectShowPromptbar,
  selectIsUserSettingsOpen,
  selectIsProfileOpen,
  selectIsCompareMode,
  selectOpenedFoldersIds,
  selectIsFolderOpened,
  selectTextOfClosedAnnouncement,
  selectChatbarWidth,
  selectPromptbarWidth,
};
