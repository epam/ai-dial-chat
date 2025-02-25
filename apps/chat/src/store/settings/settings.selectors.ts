import { createSelector } from '@reduxjs/toolkit';

import { Defaults } from '@/src/utils/app/data/defaults-service';

import { FeatureType } from '@/src/types/common';
import { MappedVisualizers } from '@/src/types/custom-visualizers';
import { RootState } from '@/src/types/store';

import {
  DEFAULT_QUICK_APPS_HOST,
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
} from '@/src/constants/quick-apps';

import { SettingsState } from './settings.types';

import { Feature } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

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

const isFeatureEnabled = (state: RootState, featureName: Feature) =>
  selectEnabledFeatures(state).has(featureName);

const selectIsPublishingEnabled = (
  state: RootState,
  featureType: FeatureType,
) => {
  const enabledFeatures = SettingsSelectors.selectEnabledFeatures(state);
  switch (featureType) {
    case FeatureType.Chat:
    case FeatureType.File:
      return enabledFeatures.has(Feature.ConversationsPublishing);
    case FeatureType.Prompt:
      return enabledFeatures.has(Feature.PromptsPublishing);
    case FeatureType.Application:
      return enabledFeatures.has(Feature.ApplicationsSharing);

    default:
      return false;
  }
};

const isSharingEnabled = (state: RootState, featureType: FeatureType) => {
  const enabledFeatures = SettingsSelectors.selectEnabledFeatures(state);
  switch (featureType) {
    case FeatureType.Chat:
      return enabledFeatures.has(Feature.ConversationsSharing);
    case FeatureType.Prompt:
      return enabledFeatures.has(Feature.PromptsSharing);
    case FeatureType.Application:
      return enabledFeatures.has(Feature.ApplicationsSharing);

    default:
      return false;
  }
};

const selectCodeWarning = createSelector([rootSelector], (state) => {
  return state.codeWarning;
});

const selectDefaultModelId = createSelector([rootSelector], (state) => {
  return state.defaultModelId;
});
const selectDefaultAssistantSubmodelId = createSelector(
  [rootSelector],
  (state) => {
    return state.defaultAssistantSubmodelId;
  },
);
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

const selectIsCustomAttachmentType = (attachmentType: string) =>
  createSelector([selectMappedVisualizers], (mappedVisualizers) => {
    return (
      mappedVisualizers &&
      Object.prototype.hasOwnProperty.call(mappedVisualizers, attachmentType)
    );
  });

const selectPublicationFilters = createSelector([rootSelector], (state) => {
  return state.publicationFilters;
});

const selectOverlayConversationId = createSelector([rootSelector], (state) => {
  return state.overlayConversationId;
});

const selectIsSignInInSameWindow = createSelector([rootSelector], (state) => {
  return state.isSignInInSameWindow;
});

const selectAllowVisualizerSendMessages = createSelector(
  [rootSelector],
  (state) => {
    return state.allowVisualizerSendMessages;
  },
);

const selectTopics = createSelector([rootSelector], (state) => {
  return uniq(state.topics ?? []).sort();
});

const selectCodeEditorPythonVersions = createSelector(
  [rootSelector],
  (state) => {
    return state.codeEditorPythonVersions;
  },
);

const selectOverlayDefaultModelId = createSelector([rootSelector], (state) => {
  return state.overlayDefaultModelId;
});

const selectQuickAppsHost = createSelector(
  [rootSelector],
  (state) => state.quickAppsHost ?? DEFAULT_QUICK_APPS_HOST,
);

const selectQuickAppsModel = createSelector(
  [rootSelector],
  (state) => state.quickAppsModel ?? DEFAULT_QUICK_APPS_MODEL,
);

const selectQuickAppsSchemaId = createSelector(
  [rootSelector],
  (state) => state.quickAppsSchemaId ?? DEFAULT_QUICK_APPS_SCHEMA_ID,
);

const selectDialApiHost = createSelector(
  [rootSelector],
  (state) => state.dialApiHost ?? '',
);

const selectDefaultSystemPrompt = createSelector(
  [rootSelector],
  (state) => state.defaultSystemPrompt ?? '',
);

const selectDefaults = createSelector(
  [
    selectDefaultAssistantSubmodelId,
    selectQuickAppsHost,
    selectQuickAppsModel,
    selectQuickAppsSchemaId,
    selectDialApiHost,
    selectDefaultSystemPrompt,
  ],
  (
    assistantSubmodelId,
    quickAppsHost,
    quickAppsModel,
    quickAppsSchemaId,
    dialApiHost,
    defaultSystemPrompt,
  ) =>
    ({
      assistantSubmodelId,
      quickAppsHost,
      quickAppsModel,
      quickAppsSchemaId,
      dialApiHost,
      defaultSystemPrompt,
    }) as Defaults,
);
const selectInitialDataStatus = createSelector([rootSelector], (state) => {
  return state.initialDataStatus;
});

const selectProviderId = createSelector([rootSelector], (state) => {
  return state.providerId;
});

export const SettingsSelectors = {
  selectAppName,
  selectIsOverlay,
  selectFooterHtmlMessage,
  selectEnabledFeatures,
  isFeatureEnabled,
  selectIsPublishingEnabled,
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
  selectPublicationFilters,
  selectOverlayConversationId,
  selectIsSignInInSameWindow,
  selectAllowVisualizerSendMessages,
  selectTopics,
  selectCodeEditorPythonVersions,
  selectOverlayDefaultModelId,
  selectDefaults,
  selectInitialDataStatus,
  selectProviderId,
};
