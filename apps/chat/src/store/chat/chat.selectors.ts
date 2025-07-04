import { createSelector } from '@reduxjs/toolkit';

import { ModalState } from '@/src/types/modal';
import { RootState } from '@/src/types/store';

import { DialSchemaProperties } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.chat;

const selectInputContent = (state: RootState) =>
  rootSelector(state).inputContent;

const selectChatFormValue = (state: RootState) => rootSelector(state).formValue;

const selectConfigurationSchema = (state: RootState) =>
  rootSelector(state).configurationSchema;

const selectIsConfigurationSchemaLoading = (state: RootState) =>
  rootSelector(state).isConfigurationSchemaLoading;

const selectIsConfigurationBlocksInput = createSelector(
  [selectConfigurationSchema],
  (configurationSchema) =>
    configurationSchema?.[DialSchemaProperties.DialChatMessageInputDisabled] ??
    false,
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
  selectConfigurationSchema,
  selectIsConfigurationSchemaLoading,
  selectIsConfigurationBlocksInput,
  selectShouldFocusAndScroll,
  selectInfoModalState,
  selectNotAvailableEntityType,
  selectInfoModalOpened,
  selectSelectedEntityInfo,
};
