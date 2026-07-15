import { ConversationItem } from '../../models/panel-props';
import { FilterTab } from '../../types/conversation-classification';

/** Returns whether a conversation item matches the currently selected filter tab. */
export const matchesTab = (item: ConversationItem, tab: FilterTab): boolean => {
  if (tab === FilterTab.All) return true;
  return item.source === tab;
};

/** Returns whether a conversation item title matches the current search query. */
export const matchesSearch = (
  item: ConversationItem,
  query: string,
): boolean => {
  if (!query) return true;
  return item.title.toLowerCase().includes(query.toLowerCase());
};
