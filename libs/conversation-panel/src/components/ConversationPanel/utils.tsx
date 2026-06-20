import { ConversationHistoryItem } from '../../models/panel-props';
import { ConversationSource } from '../../types/conversation-source';
import { FilterTab } from '../../types/filter-tab';

/** Returns whether a conversation item matches the currently selected filter tab. */
export const matchesTab = (
  item: ConversationHistoryItem,
  tab: FilterTab,
): boolean => {
  if (tab === FilterTab.All) return true;
  // After checking for 'All', tab is one of {MyChats, Shared, Organization} with matching ConversationSource values
  return item.source === (tab as unknown as ConversationSource);
};

/** Returns whether a conversation item title matches the current search query. */
export const matchesSearch = (
  item: ConversationHistoryItem,
  query: string,
): boolean => {
  if (!query) return true;
  return item.title.toLowerCase().includes(query.toLowerCase());
};
