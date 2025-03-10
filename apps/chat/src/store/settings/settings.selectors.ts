import { createSelector } from '@reduxjs/toolkit';

import { parseCommaSeparatedList } from '@/src/utils/app/common';
import { Defaults } from '@/src/utils/app/data/defaults-service';
import { canUserUseFeature } from '@/src/utils/session';

import { FeatureType } from '@/src/types/common';
import { MappedVisualizers } from '@/src/types/custom-visualizers';
import { RootState } from '@/src/types/store';

import {
  DEFAULT_QUICK_APPS_HOST,
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
} from '@/src/constants/quick-apps';

import { AuthSelectors } from '../auth/auth.selectors';
import { SettingsState } from './settings.types';

import { Feature } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

const rootSelector = (state: RootState): SettingsState => state.settings;

const selectAppName = (state: RootState) => rootSelector(state).appName;

const selectIsOverlay = (state: RootState) => rootSelector(state).isOverlay;

const selectFooterHtmlMessage = (state: RootState) =>
  rootSelector(state).footerHtmlMessage;

const selectEnabledFeatures = createSelector(
  [rootSelector, AuthSelectors.selectSessionData],
  (state, session) => {
    return new Set(
      state.enabledFeatures.filter((feature) =>
        canUserUseFeature(session, feature),
      ),
    );
  },
);

const selectIsIsolatedView = (state: RootState) =>
  !!rootSelector(state).isolatedModelId;

const selectIsolatedModelId = (state: RootState) =>
  rootSelector(state).isolatedModelId;

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

const selectCodeWarning = (state: RootState) => rootSelector(state).codeWarning;

const selectDefaultModelId = (state: RootState) =>
  rootSelector(state).defaultModelId;

const selectDefaultAssistantSubmodelId = (state: RootState) =>
  rootSelector(state).defaultAssistantSubmodelId;

const selectDefaultRecentModelsIds = (state: RootState) =>
  rootSelector(state).defaultRecentModelsIds;

const selectDefaultRecentAddonsIds = (state: RootState) =>
  rootSelector(state).defaultRecentAddonsIds;

const selectStorageType = (state: RootState) => rootSelector(state).storageType;

const selectAnnouncement = (state: RootState) =>
  rootSelector(state).announcement;

const selectThemeHostDefined = (state: RootState) =>
  rootSelector(state).themesHostDefined;

const selectCustomVisualizers = (state: RootState) =>
  rootSelector(state).customRenderers;

const selectMappedVisualizers = createSelector(
  [selectCustomVisualizers],
  (customVisualizers) => {
    return customVisualizers?.reduce(
      (visualizers: MappedVisualizers, currentVisualizerConfig) => {
        const contentTypes = parseCommaSeparatedList(
          currentVisualizerConfig.contentType,
        );

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

const selectPublicationFilters = (state: RootState) =>
  rootSelector(state).publicationFilters;

const selectOverlayConversationId = (state: RootState) =>
  rootSelector(state).overlayConversationId;

const selectIsSignInInSameWindow = (state: RootState) =>
  rootSelector(state).isSignInInSameWindow;

const selectAllowVisualizerSendMessages = (state: RootState) =>
  rootSelector(state).allowVisualizerSendMessages;

const _selectTopics = (state: RootState) => rootSelector(state).topics;

const selectTopics = createSelector([_selectTopics], (topics) => {
  return uniq(topics ?? []).sort();
});

const selectCodeEditorPythonVersions = (state: RootState) =>
  rootSelector(state).codeEditorPythonVersions;

const selectOverlayDefaultModelId = (state: RootState) =>
  rootSelector(state).overlayDefaultModelId;

const selectQuickAppsHost = (state: RootState) =>
  rootSelector(state).quickAppsHost ?? DEFAULT_QUICK_APPS_HOST;

const selectQuickAppsModel = (state: RootState) =>
  rootSelector(state).quickAppsModel ?? DEFAULT_QUICK_APPS_MODEL;

const selectQuickAppsSchemaId = (state: RootState) =>
  rootSelector(state).quickAppsSchemaId ?? DEFAULT_QUICK_APPS_SCHEMA_ID;

const FALLBACK_STRING_VALUE = '';

const selectDialApiHost = (state: RootState) =>
  rootSelector(state).dialApiHost ?? FALLBACK_STRING_VALUE;

const selectDefaultSystemPrompt = (state: RootState) =>
  rootSelector(state).defaultSystemPrompt ?? FALLBACK_STRING_VALUE;

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
const selectInitialDataStatus = (state: RootState) =>
  rootSelector(state).initialDataStatus;

const selectProviderId = (state: RootState) => rootSelector(state).providerId;

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
