import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { FeatureType } from '@/src/types/common';
import { Theme } from '@/src/types/themes';
import { ToastType } from '@/src/types/toasts';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { RootState } from '..';
import { SettingsSelectors } from '../settings/settings.reducers';

import { Feature } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

export interface UIState {
  theme: string;
  availableThemes: Theme[];
  showChatbar: boolean;
  showPromptbar: boolean;
  showMarketplaceFilterbar: boolean;
  isUserSettingsOpen: boolean;
  isProfileOpen: boolean;
  isCompareMode: boolean;
  openedFoldersIds: Record<FeatureType, string[]>;
  textOfClosedAnnouncement?: string | undefined;
  isChatFullWidth: boolean;
  showSelectToMigrateWindow: boolean;
  chatbarWidth?: number;
  promptbarWidth?: number;
  marketplaceFilterbarWidth?: number;
  chatSettingsWidth?: number;
  customLogo?: string;
  collapsedSections: Record<FeatureType, string[]>;
}

export const openFoldersInitialState = {
  [FeatureType.Chat]: [],
  [FeatureType.Prompt]: [],
  [FeatureType.File]: [],
  [FeatureType.Application]: [],
};

const initialState: UIState = {
  theme: '',
  availableThemes: [],
  showChatbar: false,
  showPromptbar: false,
  showMarketplaceFilterbar: false,
  isUserSettingsOpen: false,
  isProfileOpen: false,
  isCompareMode: false,
  openedFoldersIds: openFoldersInitialState,
  textOfClosedAnnouncement: undefined,
  chatbarWidth: SIDEBAR_MIN_WIDTH,
  promptbarWidth: SIDEBAR_MIN_WIDTH,
  marketplaceFilterbarWidth: SIDEBAR_MIN_WIDTH,
  isChatFullWidth: false,
  showSelectToMigrateWindow: false,
  customLogo: '',
  collapsedSections: openFoldersInitialState,
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

    setChatSettingsWidth: (state, { payload }: PayloadAction<number>) => {
      state.chatSettingsWidth = payload;
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
    setShowMarketplaceFilterbar: (
      state,
      { payload }: PayloadAction<UIState['showMarketplaceFilterbar']>,
    ) => {
      state.showMarketplaceFilterbar = payload;
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
    deleteCustomLogo: (state) => {
      state.customLogo = '';
    },
    showToast: (
      state,
      _action: PayloadAction<{
        message?: string | null;
        type?: ToastType;
        response?: Response;
        icon?: JSX.Element;
      }>,
    ) => state,
    showErrorToast: (state, _action: PayloadAction<string>) => state,
    showWarningToast: (state, _action: PayloadAction<string>) => state,
    showInfoToast: (state, _action: PayloadAction<string>) => state,
    showSuccessToast: (state, _action: PayloadAction<string>) => state,
    showLoadingToast: (state, _action: PayloadAction<string>) => state,
    setOpenedFoldersIds: (
      state,
      {
        payload,
      }: PayloadAction<{ openedFolderIds: string[]; featureType: FeatureType }>,
    ) => {
      state.openedFoldersIds = {
        ...state.openedFoldersIds,
        [payload.featureType]: uniq([
          ...payload.openedFolderIds,
          ...state.openedFoldersIds[payload.featureType],
        ]),
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
      {
        payload,
      }: PayloadAction<{
        id: string;
        featureType: FeatureType;
      }>,
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
    setCollapsedSections: (
      state,
      {
        payload,
      }: PayloadAction<{
        featureType: FeatureType;
        collapsedSections: string[];
      }>,
    ) => {
      state.collapsedSections[payload.featureType] = payload.collapsedSections;
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

const selectShowMarketplaceFilterbar = createSelector(
  [rootSelector],
  (state) => {
    return state.showMarketplaceFilterbar;
  },
);

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

const selectChatSettingsWidth = createSelector([rootSelector], (state) => {
  return state.chatSettingsWidth;
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

export const selectIsAnyMenuOpen = createSelector(
  [rootSelector, SettingsSelectors.selectEnabledFeatures],
  (state, enabledFeatures) =>
    (state.showPromptbar && enabledFeatures.has(Feature.PromptsSection)) ||
    (state.showChatbar && enabledFeatures.has(Feature.ConversationsSection)) ||
    state.isProfileOpen,
);

export const selectCollapsedSections = createSelector(
  [rootSelector, (_state, featureType: FeatureType) => featureType],
  (state, featureType) => {
    return state.collapsedSections[featureType];
  },
);

export const UIActions = uiSlice.actions;

export const UISelectors = {
  selectThemeState,
  selectShowChatbar,
  selectShowPromptbar,
  selectShowMarketplaceFilterbar,
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
  selectChatSettingsWidth,
  selectCustomLogo,
  selectShowSelectToMigrateWindow,
  selectIsAnyMenuOpen,
  selectCollapsedSections,
};
