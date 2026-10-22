import { ConversationKind, FilterTab } from '@epam/ai-dial-chat-shared';
import type { ConversationItem } from '../models/panel-props';
import { ConversationTypeFilter } from '../types/conversation-kind';

/** Returns whether a conversation item matches the currently selected filter tab. */
export const matchesTab = (item: ConversationItem, tab: FilterTab): boolean => {
  if (tab === FilterTab.All) return true;
  return item.source === tab;
};

/** Returns whether a conversation item is of the kind the type filter shows; an item without a kind is a chat. */
export const matchesKind = (
  item: ConversationItem,
  type: ConversationTypeFilter,
): boolean => {
  if (type === ConversationTypeFilter.All) return true;
  const kind = item.kind ?? ConversationKind.Chat;
  return type === ConversationTypeFilter.Task
    ? kind === ConversationKind.Task
    : kind === ConversationKind.Chat;
};

/** Returns whether a conversation item title matches the current search query. */
export const matchesSearch = (
  item: ConversationItem,
  query: string,
): boolean => {
  if (!query) return true;
  return item.title.toLowerCase().includes(query.toLowerCase());
};
