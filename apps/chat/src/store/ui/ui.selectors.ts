import { createSelector } from '@reduxjs/toolkit';

import { FeatureType } from '@/src/types/common';
import { RootState } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { UIState } from './ui.types';

import { Feature } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): UIState => state.ui;

const selectThemeState = (state: RootState) => rootSelector(state).theme;

const selectAvailableThemes = (state: RootState) =>
  rootSelector(state).availableThemes;

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
  [rootSelector, SettingsSelectors.selectEnabledFeatures],
  (state, enabledFeatures) =>
    (state.showPromptbar && enabledFeatures.has(Feature.PromptsSection)) ||
    (state.showChatbar && enabledFeatures.has(Feature.ConversationsSection)) ||
    state.isProfileOpen,
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
  [
    SettingsSelectors.selectWidgetsSchemaIds,
    SettingsSelectors.selectEnabledFeatures,
  ],
  (widgetsSchemaIds, enabledFeatures) => {
    return (
      widgetsSchemaIds.size > 0 || enabledFeatures.has(Feature.Marketplace)
    );
  },
);

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
  selectTextOfClosedAnnouncement,
  selectAvailableThemes,
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
};
