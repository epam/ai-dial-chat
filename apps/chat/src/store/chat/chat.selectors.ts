import { createSelector } from '@reduxjs/toolkit';

import { ModalState } from '@/src/types/modal';
import { RootState } from '@/src/types/store';

import { DialSchemaProperties } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.chat;

const selectInputContent = (state: RootState) =>
  rootSelector(state).inputContent;

const selectChatFormValue = (state: RootState) => rootSelector(state).formValue;

const selectConfigurationSchemaByModelId = (
  state: RootState,
  modelId: string,
) =>
  rootSelector(state).configurationSchemas.find(
    (schema) => schema.modelId === modelId,
  )?.schema;

const selectConfigurationSchemaByModelIds = (
  state: RootState,
  modelIds: string[],
) =>
  rootSelector(state)
    .configurationSchemas.filter((schema) => modelIds.includes(schema.modelId))
    .map((schema) => schema.schema);

const selectUploadedConfigurationSchemasIds = (state: RootState) =>
  rootSelector(state).configurationSchemas;

const selectIsConfigurationSchemaLoading = (
  state: RootState,
  modelId: string,
) => rootSelector(state).configurationSchemasLoadingIds.includes(modelId);

const selectLoadingConfigurationSchemas = (state: RootState) =>
  rootSelector(state).configurationSchemasLoadingIds;

const selectIsConfigurationBlocksInput = createSelector(
  [selectConfigurationSchemaByModelIds],
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
  selectUploadedConfigurationSchemasIds,
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
