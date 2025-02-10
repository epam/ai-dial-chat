import { createSelector } from '@reduxjs/toolkit';

import { ChatState } from '@/src/store/chat/chat.reducer';

import { RootState } from '@/src/store';
import { DialSchemaProperties } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): ChatState => state.chat;

const selectInputContent = (state: RootState) =>
  rootSelector(state).inputContent;

const selectChatFormValue = (state: RootState) => rootSelector(state).formValue;

const selectConfigurationSchema = (state: RootState) =>
  rootSelector(state).configurationSchema;

const selectIsConfigurationSchemaLoading = (state: RootState) =>
  rootSelector(state).isConfigurationSchemaLoading;

const selectIsConfigurationBlocksInput = createSelector(
  [rootSelector],
  (state) =>
    state.configurationSchema?.[
      DialSchemaProperties.DialChatMessageInputDisabled
    ] ?? false,
);

const selectShouldFocusAndScroll = (state: RootState) =>
  rootSelector(state).shouldFocusAndScroll;

export const ChatSelectors = {
  selectInputContent,
  selectChatFormValue,
  selectConfigurationSchema,
  selectIsConfigurationSchemaLoading,
  selectIsConfigurationBlocksInput,
  selectShouldFocusAndScroll,
};
