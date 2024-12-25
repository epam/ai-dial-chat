import { createSelector } from '@reduxjs/toolkit';

import { ChatState } from '@/src/store/chat/chat.reducer';

import { RootState } from '@/src/store';

const rootSelector = (state: RootState): ChatState => state.chat;

export const selectInputContent = createSelector(
  [rootSelector],
  (state) => state.inputContent,
);

export const selectChatFormOptions = createSelector(
  [rootSelector],
  (state) => state.formOptions,
);

export const ChatSelectors = {
  selectInputContent,
  selectChatFormOptions,
};
