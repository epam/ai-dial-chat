/* eslint-disable @typescript-eslint/no-empty-function */
import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { FeatureType } from '@/src/types/common';
import {
  CustomVisualizer,
  MappedVisualizers,
} from '@/src/types/custom-visualizers';
import { StorageType } from '@/src/types/storage';

import { RootState } from '..';

import { Feature } from '@epam/ai-dial-shared';

export interface SettingsState {
  appName: string;
  isOverlay: boolean;
  isAuthDisabled: boolean;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  codeWarning: string;
  announcement: string;
  defaultModelId: string | undefined;
  defaultRecentModelsIds: string[];
  defaultRecentAddonsIds: string[];
  storageType: StorageType;
  themesHostDefined: boolean;
  isolatedModelId?: string;
  customRenderers?: CustomVisualizer[];
}

const initialState: SettingsState = {
  appName: 'AI Dial',
  isOverlay: false,
  isAuthDisabled: false,
  footerHtmlMessage: '',
  enabledFeatures: [],
  codeWarning: '',
  announcement: '',
  defaultModelId: undefined,
  defaultRecentModelsIds: [],
  defaultRecentAddonsIds: [],
  storageType: StorageType.BrowserStorage,
  themesHostDefined: false,
  customRenderers: [],
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    initApp: (state) => state,
    setAppName: (
      state,
      { payload }: PayloadAction<SettingsState['appName']>,
    ) => {
      state.appName = payload;
    },
    setIsOverlay: (
      state,
      { payload }: PayloadAction<SettingsState['isOverlay']>,
    ) => {
      state.isOverlay = payload;
    },
    setAuthDisabled: (
      state,
      { payload }: PayloadAction<SettingsState['isAuthDisabled']>,
    ) => {
      state.isAuthDisabled = payload;
    },
    setFooterHtmlMessage: (
      state,
      { payload }: PayloadAction<SettingsState['footerHtmlMessage']>,
    ) => {
      state.footerHtmlMessage = payload;
    },
    setEnabledFeatures: (
      state,
      { payload }: PayloadAction<SettingsState['enabledFeatures']>,
    ) => {
      state.enabledFeatures = payload;
    },
    setCodeWarning: (
      state,
      { payload }: PayloadAction<SettingsState['codeWarning']>,
    ) => {
      state.codeWarning = payload;
    },
    setDefaultModelId: (
      state,
      { payload }: PayloadAction<{ defaultModelId: string }>,
    ) => {
      state.defaultModelId = payload.defaultModelId;
    },
    setDefaultRecentModelsIds: (
      state,
      { payload }: PayloadAction<{ defaultRecentModelsIds: string[] }>,
    ) => {
      state.defaultRecentModelsIds = payload.defaultRecentModelsIds;
    },
    setDefaultRecentAddonsIds: (
      state,
      { payload }: PayloadAction<{ defaultRecentAddonsIds: string[] }>,
    ) => {
      state.defaultRecentAddonsIds = payload.defaultRecentAddonsIds;
    },
    setStorageType: (
      state,
      { payload }: PayloadAction<{ storageType: StorageType }>,
    ) => {
      state.storageType = payload.storageType;
    },
    setThemeHostDefined: (
      state,
      { payload }: PayloadAction<{ themesHostDefined: boolean }>,
    ) => {
      state.themesHostDefined = payload.themesHostDefined;
    },
    setIsolatedModelId: (state, { payload }: PayloadAction<string>) => {
      state.isolatedModelId = payload;
    },
  },
});

const rootSelector = (state: RootState): SettingsState => state.settings;

const selectAppName = createSelector([rootSelector], (state) => {
  return state.appName;
});

const selectIsOverlay = createSelector([rootSelector], (state) => {
  return state.isOverlay;
});

const selectFooterHtmlMessage = createSelector([rootSelector], (state) => {
  return state.footerHtmlMessage;
});

const selectEnabledFeatures = createSelector([rootSelector], (state) => {
  return new Set(state.enabledFeatures);
});

const selectIsIsolatedView = createSelector([rootSelector], (state) => {
  return !!state.isolatedModelId;
});

const selectIsolatedModelId = createSelector([rootSelector], (state) => {
  return state.isolatedModelId;
});

const isFeatureEnabled = createSelector(
  [selectEnabledFeatures, (_, featureName: Feature) => featureName],
  (enabledFeatures, featureName) => {
    return enabledFeatures.has(featureName);
  },
);

const isPublishingEnabled = createSelector(
  [selectEnabledFeatures, (_, featureType: FeatureType) => featureType],
  (enabledFeatures, featureType) => {
    switch (featureType) {
      case FeatureType.Chat:
        return enabledFeatures.has(Feature.ConversationsPublishing);
      case FeatureType.Prompt:
        return enabledFeatures.has(Feature.PromptsPublishing);
      default:
        return false;
    }
  },
);

const isSharingEnabled = createSelector(
  [selectEnabledFeatures, (_, featureType: FeatureType) => featureType],
  (enabledFeatures, featureType) => {
    switch (featureType) {
      case FeatureType.Chat:
        return enabledFeatures.has(Feature.ConversationsSharing);
      case FeatureType.Prompt:
        return enabledFeatures.has(Feature.PromptsSharing);

      default:
        return false;
    }
  },
);

const selectCodeWarning = createSelector([rootSelector], (state) => {
  return state.codeWarning;
});

const selectDefaultModelId = createSelector([rootSelector], (state) => {
  return state.defaultModelId;
});
const selectDefaultRecentModelsIds = createSelector([rootSelector], (state) => {
  return state.defaultRecentModelsIds;
});
const selectDefaultRecentAddonsIds = createSelector([rootSelector], (state) => {
  return state.defaultRecentAddonsIds;
});
const selectIsAuthDisabled = createSelector([rootSelector], (state) => {
  return state.isAuthDisabled;
});
const selectStorageType = createSelector([rootSelector], (state) => {
  return state.storageType;
});
const selectAnnouncement = createSelector([rootSelector], (state) => {
  return state.announcement;
});
const selectThemeHostDefined = createSelector([rootSelector], (state) => {
  return state.themesHostDefined;
});

const selectCustomVisualizers = createSelector([rootSelector], (state) => {
  return state.customRenderers;
});

const selectMappedVisualizers = createSelector(
  [selectCustomVisualizers],
  (customVisualizers) => {
    return customVisualizers?.reduce(
      (visualizers: MappedVisualizers, currentVisualizerConfig) => {
        const contentTypes = currentVisualizerConfig.contentType.split(',');

        visualizers = contentTypes.reduce(
          (visualizers: MappedVisualizers, contentType) => {
            visualizers[contentType] = !visualizers[contentType]
              ? [currentVisualizerConfig]
              : visualizers[currentVisualizerConfig.contentType].concat(
                  currentVisualizerConfig,
                );

            return visualizers;
          },
          {} as MappedVisualizers,
        );

        return visualizers;
      },
      {} as MappedVisualizers,
    );
  },
);

const selectIsCustomAttachmentType = createSelector(
  [selectMappedVisualizers, (_state, attachmentType: string) => attachmentType],
  (mappedVisualizers, attachmentType) => {
    return (
      mappedVisualizers &&
      Object.prototype.hasOwnProperty.call(mappedVisualizers, attachmentType)
    );
  },
);

export const SettingsActions = settingsSlice.actions;
export const SettingsSelectors = {
  selectAppName,
  selectIsOverlay,
  selectFooterHtmlMessage,
  selectEnabledFeatures,
  isFeatureEnabled,
  isPublishingEnabled,
  isSharingEnabled,
  selectCodeWarning,
  selectDefaultModelId,
  selectDefaultRecentModelsIds,
  selectDefaultRecentAddonsIds,
  selectIsAuthDisabled,
  selectStorageType,
  selectAnnouncement,
  selectThemeHostDefined,
  selectIsIsolatedView,
  selectIsolatedModelId,
  selectCustomVisualizers,
  selectMappedVisualizers,
  selectIsCustomAttachmentType,
};
