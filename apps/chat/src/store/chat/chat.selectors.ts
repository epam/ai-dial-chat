import { createSelector } from '@reduxjs/toolkit';

import { ChatState } from '@/src/store/chat/chat.reducer';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';

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

export const selectIsChatInputDisabled = createSelector(
  [ConversationsSelectors.selectSelectedConversations],
  (conversations) => {
    return conversations.some(
      (conversation) =>
        conversation.messages[conversation.messages.length - 1]?.custom_content
          ?.form_schema?.['dial:chatMessageInputDisabled'],
    );
  },
);

export const ChatSelectors = {
  selectInputContent,
  selectChatFormOptions,
  selectIsChatInputDisabled,
};
