import { createSelector } from '@reduxjs/toolkit';

import { allowEnterClick } from '@/src/utils/app/keyboard';

import { FeatureType } from '@/src/types/common';
import { RootState } from '@/src/types/store';

import { WidgetsSelectors } from '@/src/store/models/widgets.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { Routes } from '@/src/constants/routes';

import { Feature } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.ui;

const selectThemeState = (state: RootState) => rootSelector(state).theme;

const selectEnterType = (state: RootState) => rootSelector(state).enterType;

const selectAvailableThemes = (state: RootState) =>
  rootSelector(state).availableThemes;

const selectThemesImages = (state: RootState) =>
  rootSelector(state).themesImages;

const selectCodeEditorTheme = createSelector(
  [selectThemeState, selectAvailableThemes],
  (theme, availableThemes) => {
    const selectedTheme = theme
      ? availableThemes.find(({ id }) => id === theme)
      : undefined;
    return (
      selectedTheme?.['code-editor-theme'] ??
      (theme === 'dark' ? 'vs-dark' : 'vs')
    );
  },
);

const selectShowChatbar = (state: RootState) => rootSelector(state).showChatbar;

const selectShowPromptbar = (state: RootState) =>
  rootSelector(state).showPromptbar;

const selectShowMarketplaceFilterbar = (state: RootState) =>
  rootSelector(state).showMarketplaceFilterbar;

const selectIsUserSettingsOpen = (state: RootState) =>
  rootSelector(state).isUserSettingsOpen;

const selectIsProfileOpen = (state: RootState) =>
  rootSelector(state).isProfileOpen;

const selectIsCompareMode = (state: RootState) =>
  rootSelector(state).isCompareMode;

const selectAllOpenedFoldersIds = (state: RootState) =>
  rootSelector(state).openedFoldersIds;

const selectOpenedFoldersIds =
  (featureType: FeatureType) => (state: RootState) =>
    selectAllOpenedFoldersIds(state)[featureType];

const selectTextOfClosedAnnouncement = (state: RootState) =>
  rootSelector(state).textOfClosedAnnouncement;

const selectChatbarWidth = (state: RootState) =>
  rootSelector(state).chatbarWidth;

const selectPromptbarWidth = (state: RootState) =>
  rootSelector(state).promptbarWidth;

const selectIsChatFullWidth = (state: RootState) =>
  rootSelector(state).isChatFullWidth;

const selectCustomLogo = (state: RootState) => rootSelector(state).customLogo;

const selectShowSelectToMigrateWindow = (state: RootState) =>
  rootSelector(state).showSelectToMigrateWindow;

const selectIsAnyMenuOpen = createSelector(
  [rootSelector, (_state, route: string) => route],
  (state, route) => {
    const isChatRoute = route === Routes.Chat;
    const isChatPanelsOpened = isChatRoute
      ? state.showPromptbar || state.showChatbar
      : false;
    const isMarketplaceRoute = route === Routes.Marketplace;
    const isMarketplacePanelOpened = isMarketplaceRoute
      ? state.showMarketplaceFilterbar
      : false;
    return (
      isChatPanelsOpened || isMarketplacePanelOpened || state.isProfileOpen
    );
  },
);

const selectCollapsedSections = //TODO: review later how it is used
  (featureType: FeatureType) => (state: RootState) =>
    rootSelector(state).collapsedSections[featureType];

const selectPreviousRoute = (state: RootState) =>
  rootSelector(state).previousRoute;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectScrollToEntityId = (state: RootState) =>
  rootSelector(state).scrollToEntityId;

const selectIsNavigationVisible = createSelector(
  [WidgetsSelectors.selectIsAnyWidget, SettingsSelectors.selectEnabledFeatures],
  (isAnyWidget, enabledFeatures) => {
    return isAnyWidget || enabledFeatures.has(Feature.Marketplace);
  },
);

const selectVisibleSidebarItems = createSelector(
  [
    rootSelector,
    (_state: RootState, featureType: FeatureType.Chat | FeatureType.Prompt) =>
      featureType,
  ],
  (state, featureType) => state.visibleSidebarItems[featureType],
);

const selectIsEditorLoader = (state: RootState) =>
  rootSelector(state).isEditorLoader;

const selectAllowEnterToSend = createSelector([selectEnterType], (enterType) =>
  allowEnterClick(enterType),
);

export const UISelectors = {
  selectThemeState,
  selectEnterType,
  selectShowChatbar,
  selectShowPromptbar,
  selectShowMarketplaceFilterbar,
  selectIsUserSettingsOpen,
  selectIsProfileOpen,
  selectIsCompareMode,
  selectAllOpenedFoldersIds,
  selectOpenedFoldersIds,
  selectTextOfClosedAnnouncement,
  selectAvailableThemes,
  selectThemesImages,
  selectChatbarWidth,
  selectPromptbarWidth,
  selectIsChatFullWidth,
  selectCustomLogo,
  selectShowSelectToMigrateWindow,
  selectIsAnyMenuOpen,
  selectCollapsedSections,
  selectPreviousRoute,
  selectInitialized,
  selectScrollToEntityId,
  selectIsNavigationVisible,
  selectCodeEditorTheme,
  selectVisibleSidebarItems,
  selectIsEditorLoader,
  selectAllowEnterToSend,
};
