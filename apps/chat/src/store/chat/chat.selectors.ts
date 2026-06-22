import { createSelector } from '@reduxjs/toolkit';

import { ModalState } from '@/src/types/modal';
import { ModelsMap } from '@/src/types/models';
import { RootState } from '@/src/types/store';

import { DialSchemaProperties } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.chat;

const selectInputContent = (state: RootState) =>
  rootSelector(state).inputContent;

const selectChatFormValue = (state: RootState) => rootSelector(state).formValue;

const selectUploadedConfigurationSchemas = (state: RootState) =>
  rootSelector(state).configurationSchemas;

const selectConfigurationSchemaByModelId = createSelector(
  [
    selectUploadedConfigurationSchemas,
    (_state, modelId: string) => modelId,
    (_state, _modelId: string, modelsMap: ModelsMap) => modelsMap,
  ],
  (configurationSchemas, modelId, modelsMap) =>
    // modelId could be reference
    configurationSchemas.find(
      (schema) => schema.modelId === (modelsMap[modelId]?.id ?? modelId),
    )?.schema,
);

const selectConfigurationSchemaByModelIds = createSelector(
  [
    selectUploadedConfigurationSchemas,
    (_state, modelIds: string[]) => modelIds,
    (_state, _modelIds: string[], modelsMap: ModelsMap) => modelsMap,
  ],
  (configurationSchemas, modelIds, modelsMap) =>
    configurationSchemas
      .filter((schema) =>
        modelIds.includes(modelsMap[schema.modelId]?.id ?? schema.modelId),
      )
      .map((schema) => schema.schema),
);

const selectLoadingConfigurationSchemas = (state: RootState) =>
  rootSelector(state).configurationSchemasLoadingIds;

const selectIsConfigurationSchemaLoading = createSelector(
  [
    selectLoadingConfigurationSchemas,
    (_state, modelId: string) => modelId,
    (_state, _modelId: string, modelsMap: ModelsMap) => modelsMap,
  ],
  (configurationSchemasLoadingIds, modelId, modelsMap) =>
    configurationSchemasLoadingIds.includes(modelsMap[modelId]?.id ?? modelId),
);

const selectIsConfigurationBlocksInput = createSelector(
  [
    (_state, modelIds: string[], modelsMap: ModelsMap) =>
      selectConfigurationSchemaByModelIds(_state, modelIds, modelsMap),
  ],
  (configurationSchemas) =>
    configurationSchemas.some(
      (schema) =>
        schema?.[DialSchemaProperties.DialChatMessageInputDisabled] ?? false,
    ),
);

const selectShouldFocusAndScroll = (state: RootState) =>
  rootSelector(state).shouldFocusAndScroll;

const selectNotAvailableEntityType = (state: RootState) =>
  rootSelector(state).notAvailableEntityType;

const selectInfoModalState = (state: RootState) =>
  rootSelector(state).infoModalState;

const selectInfoModalOpened = (state: RootState) =>
  selectInfoModalState(state) !== ModalState.CLOSED;

const selectSelectedEntityInfo = (state: RootState) =>
  rootSelector(state).selectedEntityInfo;

const selectInputContentTemplateMapping = (state: RootState) =>
  rootSelector(state).inputContentTemplateMapping;

const selectUserMessageTranscript = (state: RootState) =>
  rootSelector(state).userMessageTranscript;

const selectUserMessageVoiceAttachmentId = (state: RootState) =>
  rootSelector(state).userMessageVoiceAttachmentId;

const selectIsTranscribing = (state: RootState) =>
  rootSelector(state).isTranscribing;

const selectIsUserMessageTranscribing = (state: RootState) =>
  rootSelector(state).isUserMessageTranscribing;

const selectIsAsrFlowActive = (state: RootState) =>
  rootSelector(state).isAsrFlowActive;

const selectAsrInsertionContext = (state: RootState) =>
  rootSelector(state).asrInsertionContext;

export const ChatSelectors = {
  selectInputContent,
  selectInputContentTemplateMapping,
  selectUserMessageTranscript,
  selectUserMessageVoiceAttachmentId,
  selectIsTranscribing,
  selectIsUserMessageTranscribing,
  selectIsAsrFlowActive,
  selectAsrInsertionContext,
  selectChatFormValue,
  selectUploadedConfigurationSchemas,
  selectConfigurationSchemaByModelId,
  selectConfigurationSchemaByModelIds,
  selectLoadingConfigurationSchemas,
  selectIsConfigurationSchemaLoading,
  selectIsConfigurationBlocksInput,
  selectShouldFocusAndScroll,
  selectInfoModalState,
  selectNotAvailableEntityType,
  selectInfoModalOpened,
  selectSelectedEntityInfo,
};
