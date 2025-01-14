import { createSelector } from '@reduxjs/toolkit';

import { ChatState } from '@/src/store/chat/chat.reducer';

import { RootState } from '@/src/store';

const rootSelector = (state: RootState): ChatState => state.chat;

export const selectInputContent = createSelector(
  [rootSelector],
  (state) => state.inputContent,
);

export const selectChatFormValue = createSelector(
  [rootSelector],
  (state) => state.formValue,
);

export const selectConfigurationSchema = createSelector(
  [rootSelector],
  (state) => state.configurationSchema,
);

export const selectIsConfigurationSchemaLoading = createSelector(
  [rootSelector],
  (state) => state.isConfigurationSchemaLoading,
);

export const selectIsConfigurationBlocksInput = createSelector(
  [rootSelector],
  (state) =>
    state.configurationSchema?.['dial:chatMessageInputDisabled'] ?? false,
);

export const ChatSelectors = {
  selectInputContent,
  selectChatFormValue,
  selectConfigurationSchema,
  selectIsConfigurationSchemaLoading,
  selectIsConfigurationBlocksInput,
};
