import { createSelector } from '@reduxjs/toolkit';

import { ModalState } from '@/src/types/modal';
import { RootState } from '@/src/types/store';

import { DialSchemaProperties } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.chat;

const selectInputContent = (state: RootState) =>
  rootSelector(state).inputContent;

const selectChatFormValue = (state: RootState) => rootSelector(state).formValue;

const selectUploadedConfigurationSchemas = (state: RootState) =>
  rootSelector(state).configurationSchemas;

const selectConfigurationSchemaByModelId = createSelector(
  [selectUploadedConfigurationSchemas, (_state, modelId: string) => modelId],
  (configurationSchemas, modelId) =>
    configurationSchemas.find((schema) => schema.modelId === modelId)?.schema,
);

const selectConfigurationSchemaByModelIds = createSelector(
  [
    selectUploadedConfigurationSchemas,
    (_state, modelIds: string[]) => modelIds,
  ],
  (configurationSchemas, modelIds) =>
    configurationSchemas
      .filter((schema) => modelIds.includes(schema.modelId))
      .map((schema) => schema.schema),
);

const selectLoadingConfigurationSchemas = (state: RootState) =>
  rootSelector(state).configurationSchemasLoadingIds;

const selectIsConfigurationSchemaLoading = createSelector(
  [selectLoadingConfigurationSchemas, (_state, modelId: string) => modelId],
  (configurationSchemasLoadingIds, modelId) =>
    configurationSchemasLoadingIds.includes(modelId),
);

const selectIsConfigurationBlocksInput = createSelector(
  [
    (_state, modelId: string[]) =>
      selectConfigurationSchemaByModelIds(_state, modelId),
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

export const ChatSelectors = {
  selectInputContent,
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
