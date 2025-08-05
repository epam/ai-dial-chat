import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { FeatureType } from '@/src/types/common';
import { ToastType } from '@/src/types/toasts';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { UIState } from './ui.types';

import uniq from 'lodash-es/uniq';

export const openFoldersInitialState = {
  [FeatureType.Chat]: [],
  [FeatureType.Prompt]: [],
  [FeatureType.File]: [],
  [FeatureType.Application]: [],
};

const initialState: UIState = {
  initialized: false,
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
    initFinish: (state) => {
      state.initialized = true;
    },
    initTheme: (state) => state,
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
    closeAllPanels: (state) => {
      state.showChatbar = false;
      state.showPromptbar = false;
      state.showMarketplaceFilterbar = false;
      state.isUserSettingsOpen = false;
      state.isProfileOpen = false;
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
    setPreviousRoute: (state, { payload }: PayloadAction<string>) => {
      state.previousRoute = payload;
    },
    setScrollToEntityId: (
      state,
      { payload }: PayloadAction<string | undefined>,
    ) => {
      state.scrollToEntityId = payload;
    },
  },
});

export const UIActions = uiSlice.actions;
