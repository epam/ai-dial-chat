import type {
  ConversationHistoryItem,
  FilterTab,
} from '../../models/ConversationPanel.js';

/** Returns whether a conversation item matches the currently selected filter tab. */
export const matchesTab = (
  item: ConversationHistoryItem,
  tab: FilterTab,
): boolean => {
  if (tab === 'all') return true;
  return item.source === tab;
};

/** Returns whether a conversation item title matches the current search query. */
export const matchesSearch = (
  item: ConversationHistoryItem,
  query: string,
): boolean => {
  if (!query) return true;
  return item.title.toLowerCase().includes(query.toLowerCase());
};
