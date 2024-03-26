import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { FeatureType } from '@/src/types/common';
import { Theme } from '@/src/types/themes';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { RootState } from '..';

import uniq from 'lodash-es/uniq';

export interface UIState {
  theme: string;
  availableThemes: Theme[];
  showChatbar: boolean;
  showPromptbar: boolean;
  isUserSettingsOpen: boolean;
  isProfileOpen: boolean;
  isCompareMode: boolean;
  openedFoldersIds: Record<FeatureType, string[]>;
  textOfClosedAnnouncement?: string | undefined;
  isChatFullWidth: boolean;
  showSelectToMigrateWindow: boolean;
  chatbarWidth?: number;
  promptbarWidth?: number;
  customLogo?: string;
}

export const openFoldersInitialState = {
  [FeatureType.Chat]: [],
  [FeatureType.Prompt]: [],
  [FeatureType.File]: [],
};

const initialState: UIState = {
  theme: '',
  availableThemes: [],
  showChatbar: false,
  showPromptbar: false,
  isUserSettingsOpen: false,
  isProfileOpen: false,
  isCompareMode: false,
  openedFoldersIds: openFoldersInitialState,
  textOfClosedAnnouncement: undefined,
  chatbarWidth: SIDEBAR_MIN_WIDTH,
  promptbarWidth: SIDEBAR_MIN_WIDTH,
  isChatFullWidth: false,
  showSelectToMigrateWindow: false,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    init: (state) => state,
    setTheme: (state, { payload }: PayloadAction<string>) => {
      state.theme = payload;
    },
    setAvailableThemes: (
      state,
      { payload }: PayloadAction<UIState['availableThemes']>,
    ) => {
      state.availableThemes = payload;
    },
    setChatbarWidth: (state, { payload }: PayloadAction<number>) => {
      state.chatbarWidth = payload;
    },
    setPromptbarWidth: (state, { payload }: PayloadAction<number>) => {
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
    setIsChatFullWidth: (state, { payload }: PayloadAction<boolean>) => {
      state.isChatFullWidth = payload;
    },
    setCustomLogo: (state, { payload }: PayloadAction<{ logo: string }>) => {
      state.customLogo = payload.logo;
    },
    removeCustomLogo: (state) => {
      state.customLogo = undefined;
    },
    showToast: (
      state,
      _action: PayloadAction<{
        message?: string | null;
        type?: 'error' | 'loading' | 'success';
        response?: Response;
      }>,
    ) => state,
    showErrorToast: (state, _action: PayloadAction<string>) => state,
    showLoadingToast: (state, _action: PayloadAction<string>) => state,
    showSuccessToast: (state, _action: PayloadAction<string>) => state,
    setOpenedFoldersIds: (
      state,
      {
        payload,
      }: PayloadAction<{ openedFolderIds: string[]; featureType: FeatureType }>,
    ) => {
      state.openedFoldersIds = {
        ...state.openedFoldersIds,
        [payload.featureType]: uniq(payload.openedFolderIds),
      };
    },
    toggleFolder: (
      state,
      { payload }: PayloadAction<{ id: string; featureType: FeatureType }>,
    ) => {
      const featureType = payload.featureType;
      const openedFoldersIds = state.openedFoldersIds[featureType];
      const isOpened = openedFoldersIds.includes(payload.id);
      if (isOpened) {
        state.openedFoldersIds[featureType] = openedFoldersIds.filter(
          (id) => id !== payload.id,
        );
      } else {
        state.openedFoldersIds[featureType].push(payload.id);
      }
    },
    openFolder: (
      state,
      { payload }: PayloadAction<{ id: string; featureType: FeatureType }>,
    ) => {
      const featureType = payload.featureType;
      const openedFoldersIds = state.openedFoldersIds[featureType];
      const isOpened = openedFoldersIds.includes(payload.id);
      if (!isOpened) {
        state.openedFoldersIds[featureType].push(payload.id);
      }
    },
    closeFolder: (
      state,
      { payload }: PayloadAction<{ id: string; featureType: FeatureType }>,
    ) => {
      const featureType = payload.featureType;
      const openedFoldersIds = state.openedFoldersIds[featureType];
      const isOpened = openedFoldersIds.includes(payload.id);
      if (isOpened) {
        state.openedFoldersIds[featureType] = openedFoldersIds.filter(
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
    resize: (state) => state,
    setShowSelectToMigrateWindow: (
      state,
      { payload }: PayloadAction<boolean>,
    ) => {
      state.showSelectToMigrateWindow = payload;
    },
  },
});

const rootSelector = (state: RootState): UIState => state.ui;

const selectThemeState = createSelector([rootSelector], (state) => {
  return state.theme;
});
const selectAvailableThemes = createSelector([rootSelector], (state) => {
  return state.availableThemes;
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

const selectAllOpenedFoldersIds = createSelector([rootSelector], (state) => {
  return state.openedFoldersIds;
});

const selectOpenedFoldersIds = createSelector(
  [
    selectAllOpenedFoldersIds,
    (_state, featureType: FeatureType) => featureType,
  ],
  (openedFoldersIds, featureType) => {
    return openedFoldersIds[featureType];
  },
);
const selectIsFolderOpened = createSelector(
  [
    (state, featureType: FeatureType) =>
      selectOpenedFoldersIds(state, featureType),
    (_state, _featureType: FeatureType, id: string) => id,
  ],
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

const selectIsChatFullWidth = createSelector([rootSelector], (state) => {
  return state.isChatFullWidth;
});

const selectCustomLogo = createSelector([rootSelector], (state) => {
  return state.customLogo;
});

export const selectShowSelectToMigrateWindow = createSelector(
  [rootSelector],
  (state) => state.showSelectToMigrateWindow,
);

export const UIActions = uiSlice.actions;

export const UISelectors = {
  selectThemeState,
  selectShowChatbar,
  selectShowPromptbar,
  selectIsUserSettingsOpen,
  selectIsProfileOpen,
  selectIsCompareMode,
  selectAllOpenedFoldersIds,
  selectOpenedFoldersIds,
  selectIsFolderOpened,
  selectTextOfClosedAnnouncement,
  selectAvailableThemes,
  selectChatbarWidth,
  selectPromptbarWidth,
  selectIsChatFullWidth,
  selectCustomLogo,
  selectShowSelectToMigrateWindow,
};
