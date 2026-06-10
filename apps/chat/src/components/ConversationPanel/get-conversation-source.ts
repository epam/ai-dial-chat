import { ConversationSource } from '@epam/ai-dial-conversation-panel';
import { type ConversationListItemDto } from '@epam/chat-api-client';

export const getConversationSource = (
  item: Pick<ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe'>,
): ConversationSource => {
  if (item.sharedWithMe) return ConversationSource.Shared;
  if (item.publishedWithMe) return ConversationSource.Organization;
  return ConversationSource.MyChats;
};
