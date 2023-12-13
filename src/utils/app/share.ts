import { SharingType } from '@/src/types/share';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';

export const getShareActionByType = (type: SharingType) => {
  switch (type) {
    case SharingType.Conversation:
      return ConversationsActions.shareConversation;
    case SharingType.ConversationFolder:
      return ConversationsActions.shareFolder;
    case SharingType.Prompt:
      return PromptsActions.sharePrompt;
    case SharingType.PromptFolder:
      return PromptsActions.shareFolder;
    default:
      throw new Error('unknown type');
  }
};

export const getPublishActionByType = (type: SharingType) => {
  switch (type) {
    case SharingType.Conversation:
      return ConversationsActions.publishConversation;
    case SharingType.ConversationFolder:
      return ConversationsActions.publishFolder;
    case SharingType.Prompt:
      return PromptsActions.publishPrompt;
    case SharingType.PromptFolder:
      return PromptsActions.publishFolder;
    default:
      throw new Error('unknown type');
  }
};

export const getUnpublishActionByType = (type: SharingType) => {
  switch (type) {
    case SharingType.Conversation:
      return ConversationsActions.unpublishConversation;
    case SharingType.ConversationFolder:
      return ConversationsActions.unpublishFolder;
    case SharingType.Prompt:
      return PromptsActions.unpublishPrompt;
    case SharingType.PromptFolder:
      return PromptsActions.unpublishFolder;
    default:
      throw new Error('unknown type');
  }
};
