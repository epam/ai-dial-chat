import { createSelector } from '@reduxjs/toolkit';

import { parseCommaSeparatedList } from '@/src/utils/app/common';
import { Defaults } from '@/src/utils/app/data/defaults-service';
import { canUserUseFeature } from '@/src/utils/session';

import { FeatureType } from '@/src/types/common';
import { MappedVisualizers } from '@/src/types/custom-visualizers';
import { RootState } from '@/src/types/store';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';

import { DEFAULT_EXTERNAL_APPS_SCHEMA_ID } from '@/src/constants/external-apps';
import {
  DEFAULT_QUICK_APPS_HOST,
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
} from '@/src/constants/quick-apps';

import { Feature, FeatureData } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

const rootSelector = (state: RootState) => state.settings;

const selectAppName = (state: RootState) => rootSelector(state).appName;

const selectIsOverlay = (state: RootState) => rootSelector(state).isOverlay;

const selectFooterHtmlMessage = (state: RootState) =>
  rootSelector(state).footerHtmlMessage;

const _selectEnabledFeaturesData = (state: RootState) =>
  rootSelector(state).enabledFeaturesData;

const _selectFeatures = createSelector(
  [rootSelector, AuthSelectors.selectSessionData, _selectEnabledFeaturesData],
  (state, session, featuresData) =>
    state.enabledFeatures
      .filter((featureName) => canUserUseFeature(session, featureName))
      .reduce(
        (acc, curr) => {
          const featureData = featuresData[curr];
          acc[curr] = { ...featureData };

          return acc;
        },
        {} as Record<Feature, FeatureData | undefined>,
      ),
);

const selectEnabledFeatures = createSelector(
  [_selectFeatures],
  (enabledFeaturesData) => {
    const enabledFeatures = new Map<Feature, FeatureData | undefined>();

    Object.entries(enabledFeaturesData).forEach(([featureName, featureData]) =>
      enabledFeatures.set(featureName as Feature, featureData),
    );

    return enabledFeatures;
  },
);

const selectIsIsolatedView = (state: RootState) =>
  !!rootSelector(state).isolatedModelId;

const selectIsolatedModelId = (state: RootState) =>
  rootSelector(state).isolatedModelId;

const selectPreselectedConversationId = (state: RootState) =>
  rootSelector(state).preselectedConversationId;

const selectPreselectedAction = (state: RootState) =>
  rootSelector(state).preselectedAction;

const isFeatureEnabled = (state: RootState, featureName: Feature) =>
  selectEnabledFeatures(state).has(featureName);
const selectFeatureData = (state: RootState, featureName: Feature) =>
  selectEnabledFeatures(state).get(featureName);

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

const selectDefaultModelReference = (state: RootState) =>
  rootSelector(state).defaultModelReference;

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

        return contentTypes.reduce((vis: MappedVisualizers, contentType) => {
          vis[contentType] = !vis[contentType]
            ? [currentVisualizerConfig]
            : vis[contentType].concat(currentVisualizerConfig);

          return vis;
        }, visualizers);
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

const selectOverlayDefaultModelReference = (state: RootState) =>
  rootSelector(state).overlayDefaultModelReference;

const selectQuickAppsHost = (state: RootState) =>
  rootSelector(state).quickAppsHost ?? DEFAULT_QUICK_APPS_HOST;

const selectQuickAppsModel = (state: RootState) =>
  rootSelector(state).quickAppsModel ?? DEFAULT_QUICK_APPS_MODEL;

const selectQuickAppsSchemaId = (state: RootState) =>
  rootSelector(state).quickAppsSchemaId ?? DEFAULT_QUICK_APPS_SCHEMA_ID;

const selectExternalAppsSchemaId = (state: RootState) =>
  rootSelector(state).externalAppsSchemaId ?? DEFAULT_EXTERNAL_APPS_SCHEMA_ID;

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
    selectExternalAppsSchemaId,
    selectDialApiHost,
    selectDefaultSystemPrompt,
  ],
  (
    assistantSubmodelId,
    quickAppsHost,
    quickAppsModel,
    quickAppsSchemaId,
    externalAppsSchemaId,
    dialApiHost,
    defaultSystemPrompt,
  ) =>
    ({
      assistantSubmodelId,
      quickAppsHost,
      quickAppsModel,
      quickAppsSchemaId,
      externalAppsSchemaId,
      dialApiHost,
      defaultSystemPrompt,
    }) as Defaults,
);
const selectInitialDataStatus = (state: RootState) =>
  rootSelector(state).initialDataStatus;

const selectProviderId = (state: RootState) => rootSelector(state).providerId;

const selectWidgetsSchemaIds = (state: RootState) =>
  rootSelector(state).widgetsSchemaIds;

const selectIsAuthDisabled = (state: RootState) =>
  rootSelector(state).isAuthDisabled;

export const SettingsSelectors = {
  selectAppName,
  selectIsOverlay,
  selectFooterHtmlMessage,
  selectEnabledFeatures,
  isFeatureEnabled,
  selectFeatureData,
  selectIsPublishingEnabled,
  isSharingEnabled,
  selectCodeWarning,
  selectDefaultModelReference,
  selectDefaultRecentModelsIds,
  selectDefaultRecentAddonsIds,
  selectStorageType,
  selectAnnouncement,
  selectThemeHostDefined,
  selectIsIsolatedView,
  selectIsolatedModelId,
  selectPreselectedConversationId,
  selectPreselectedAction,
  selectMappedVisualizers,
  selectIsCustomAttachmentType,
  selectPublicationFilters,
  selectOverlayConversationId,
  selectIsSignInInSameWindow,
  selectAllowVisualizerSendMessages,
  selectTopics,
  selectCodeEditorPythonVersions,
  selectOverlayDefaultModelReference,
  selectDefaults,
  selectInitialDataStatus,
  selectProviderId,
  selectWidgetsSchemaIds,
  selectIsAuthDisabled,
};
