import { createSelector } from '@reduxjs/toolkit';

import { ChatState } from '@/src/store/chat/chat.reducer';

import { RootState } from '@/src/store';
import { DialSchemaProperties } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): ChatState => state.chat;

export const selectInputContent = (state: RootState) =>
  rootSelector(state).inputContent;

export const selectChatFormValue = (state: RootState) =>
  rootSelector(state).formValue;

export const selectConfigurationSchema = (state: RootState) =>
  rootSelector(state).configurationSchema;

export const selectIsConfigurationSchemaLoading = (state: RootState) =>
  rootSelector(state).isConfigurationSchemaLoading;

export const selectIsConfigurationBlocksInput = createSelector(
  [rootSelector],
  (state) =>
    state.configurationSchema?.[
      DialSchemaProperties.DialChatMessageInputDisabled
    ] ?? false,
);

export const ChatSelectors = {
  selectInputContent,
  selectChatFormValue,
  selectConfigurationSchema,
  selectIsConfigurationSchemaLoading,
  selectIsConfigurationBlocksInput,
};
