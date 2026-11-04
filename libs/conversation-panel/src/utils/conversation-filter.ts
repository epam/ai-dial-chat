import { ConversationKind, FilterTab } from '@epam/ai-dial-chat-shared';
import type { ConversationItem } from '../models/panel-props';
import type { PinnedProjectGroup } from '../models/pinned-projects';
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

/** Search text and filters that narrow the pinned project trees. */
interface PinnedProjectFilters {
  /** Current search text; empty keeps every project. */
  searchQuery: string;
  /** Origin tab applied to the list. */
  activeFilter: FilterTab;
  /** Kinds of conversation the list shows. */
  activeTypeFilter: ConversationTypeFilter;
  /** Sources excluded entirely. */
  hiddenSources?: FilterTab[];
}

/**
 * Returns the pinned projects that the search and the filters keep, in order. A
 * project matched by name keeps all its rows; one matched only through its chats
 * keeps the matching chats and loses its See all row.
 */
export const filterPinnedProjects = (
  projects: PinnedProjectGroup[],
  {
    searchQuery,
    activeFilter,
    activeTypeFilter,
    hiddenSources,
  }: PinnedProjectFilters,
): PinnedProjectGroup[] => {
  if (activeTypeFilter === ConversationTypeFilter.Task) return [];
  const query = searchQuery.toLowerCase();
  const visible: PinnedProjectGroup[] = [];
  for (const project of projects) {
    const source = project.source ?? FilterTab.MyChats;
    if (hiddenSources?.includes(source)) continue;
    if (activeFilter !== FilterTab.All && activeFilter !== source) continue;
    if (!query || project.name.toLowerCase().includes(query)) {
      visible.push(project);
      continue;
    }
    const conversations = project.conversations.filter((item) =>
      matchesSearch(item, searchQuery),
    );
    if (conversations.length > 0) {
      visible.push({ ...project, conversations, hasMore: false });
    }
  }
  return visible;
};
