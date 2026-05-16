import { JSX } from 'react';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { FeatureType } from '@/src/types/common';
import { MarketplacePanelState } from '@/src/types/marketplace-panel-state';
import { EnterType } from '@/src/types/settings';
import { ThemesConfig } from '@/src/types/themes';
import { ToastType } from '@/src/types/toasts';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';
import { FilterTypes } from '@/src/constants/marketplace';
import { DEFAULT_SIDEBAR_DISPLAY_ITEM_COUNT } from '@/src/constants/sidebars';

import { UIState } from './ui.types';

import uniq from 'lodash-es/uniq';

const openFoldersInitialState = {
  [FeatureType.Chat]: [],
  [FeatureType.Prompt]: [],
  [FeatureType.File]: [],
  [FeatureType.Application]: [],
  [FeatureType.Toolset]: [],
};

const initialState: UIState = {
  initialized: false,
  locale: 'en',
  theme: '',
  availableThemes: [],
  themesImages: {},
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
  visibleSidebarItems: {
    [FeatureType.Chat]: DEFAULT_SIDEBAR_DISPLAY_ITEM_COUNT,
    [FeatureType.Prompt]: DEFAULT_SIDEBAR_DISPLAY_ITEM_COUNT,
  },
  enterType: EnterType.Enter,
  agentsFilterPanelCollapseState: {
    [FilterTypes.ENTITY_TYPE]: true,
    [FilterTypes.TOPICS]: true,
    [FilterTypes.SOURCES]: true,
  },
  toolsetFilterPanelCollapseState: {
    [FilterTypes.ENTITY_TYPE]: false,
    [FilterTypes.TOPICS]: true,
    [FilterTypes.SOURCES]: true,
  },
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
    setLocale: (state, { payload }: PayloadAction<string>) => {
      state.locale = payload;
    },
    setEnterType: (state, { payload }: PayloadAction<EnterType>) => {
      state.enterType = payload;
    },
    setAvailableThemes: (state, { payload }: PayloadAction<ThemesConfig>) => {
      state.availableThemes = payload.themes;
      state.themesImages = payload.images;
    },
    setChatbarWidth: (state, { payload }: PayloadAction<number>) => {
      state.chatbarWidth = payload;
    },
    setPromptbarWidth: (state, { payload }: PayloadAction<number>) => {
      state.promptbarWidth = payload;
    },
    setMarketplaceFilterbarWidth: (
      state,
      { payload }: PayloadAction<number>,
    ) => {
      state.marketplaceFilterbarWidth = payload;
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
        title?: string;
        type?: ToastType;
        response?: Response;
        icon?: JSX.Element;
        traceId?: string;
      }>,
    ) => state,
    showErrorToast: (
      state,
      _action: PayloadAction<{ message: string; traceId?: string }>,
    ) => state,
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
    setVisibleSidebarItems: (
      state,
      {
        payload,
      }: PayloadAction<{
        featureType: FeatureType.Chat | FeatureType.Prompt;
        visibleItems: number;
      }>,
    ) => {
      state.visibleSidebarItems[payload.featureType] = payload.visibleItems;
    },
    setEditorLoader: (state, { payload }: PayloadAction<boolean>) => {
      state.isEditorLoader = payload;
    },
    setAgentsFilterPanelCollapseState: (
      state,
      { payload }: PayloadAction<MarketplacePanelState>,
    ) => {
      state.agentsFilterPanelCollapseState = payload;
    },
    setToolsetFilterPanelCollapseState: (
      state,
      { payload }: PayloadAction<MarketplacePanelState>,
    ) => {
      state.toolsetFilterPanelCollapseState = payload;
    },
  },
});

export const UIActions = uiSlice.actions;
