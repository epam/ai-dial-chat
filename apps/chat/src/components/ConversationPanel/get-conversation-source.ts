import { FilterTab } from '@epam/ai-dial-conversation-panel';
import { type ConversationListItemDto } from '@epam/chat-api-client';

export const getConversationSource = (
  item: Pick<ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe'>,
): FilterTab => {
  if (item.sharedWithMe) return FilterTab.Shared;
  if (item.publishedWithMe) return FilterTab.Organization;
  return FilterTab.MyChats;
};
