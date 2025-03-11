import { createSelector } from '@reduxjs/toolkit';

import { FeatureType } from '@/src/types/common';
import { RootState } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { UIState } from './ui.types';

import { Feature } from '@epam/ai-dial-shared';

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

const selectOpenedFoldersIds = (featureType: FeatureType) =>
  createSelector([selectAllOpenedFoldersIds], (openedFoldersIds) => {
    return openedFoldersIds[featureType];
  });
const selectIsFolderOpened = (featureType: FeatureType, id: string) =>
  createSelector([selectOpenedFoldersIds(featureType)], (ids): boolean => {
    return ids.includes(id);
  });
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

export const selectIsAnyMenuOpen = createSelector(
  [rootSelector, SettingsSelectors.selectEnabledFeatures],
  (state, enabledFeatures) =>
    (state.showPromptbar && enabledFeatures.has(Feature.PromptsSection)) ||
    (state.showChatbar && enabledFeatures.has(Feature.ConversationsSection)) ||
    state.isProfileOpen,
);

export const selectCollapsedSections = (featureType: FeatureType) =>
  createSelector([rootSelector], (state) => {
    return state.collapsedSections[featureType];
  });

export const selectPreviousRoute = createSelector(
  [rootSelector],
  (state) => state.previousRoute,
);

export const selectInitialized = createSelector(
  [rootSelector],
  (state) => state.initialized,
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
  selectIsFolderOpened,
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
};
