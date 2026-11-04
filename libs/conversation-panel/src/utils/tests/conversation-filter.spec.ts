import { ConversationKind, FilterTab } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { ConversationItem } from '../../models/panel-props';
import type { PinnedProjectGroup } from '../../models/pinned-projects';
import { ConversationTypeFilter } from '../../types/conversation-kind';
import {
  filterPinnedProjects,
  matchesKind,
  matchesSearch,
  matchesTab,
} from '../conversation-filter';

const item: ConversationItem = {
  id: '1',
  title: 'Quarterly Report',
  source: FilterTab.Shared,
};

describe('matchesKind', () => {
  const task: ConversationItem = { ...item, kind: ConversationKind.Task };

  it('shows every item for the All type', () => {
    expect(matchesKind(item, ConversationTypeFilter.All)).toBe(true);
    expect(matchesKind(task, ConversationTypeFilter.All)).toBe(true);
  });

  it('treats an item without a kind as a chat', () => {
    expect(matchesKind(item, ConversationTypeFilter.Chat)).toBe(true);
    expect(matchesKind(item, ConversationTypeFilter.Task)).toBe(false);
  });

  it('separates tasks from chats', () => {
    expect(matchesKind(task, ConversationTypeFilter.Task)).toBe(true);
    expect(matchesKind(task, ConversationTypeFilter.Chat)).toBe(false);
  });
});

describe('matchesTab', () => {
  it('matches every item under All', () => {
    expect(matchesTab(item, FilterTab.All)).toBe(true);
  });

  it('matches only the item source otherwise', () => {
    expect(matchesTab(item, FilterTab.Shared)).toBe(true);
    expect(matchesTab(item, FilterTab.MyChats)).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('matches every item for an empty query', () => {
    expect(matchesSearch(item, '')).toBe(true);
  });

  it('matches the title case-insensitively', () => {
    expect(matchesSearch(item, 'report')).toBe(true);
    expect(matchesSearch(item, 'budget')).toBe(false);
  });
});

describe('filterPinnedProjects', () => {
  const support: PinnedProjectGroup = {
    id: 'p1',
    name: 'Support',
    conversations: [
      { id: 'c1', title: 'Weekly summary' },
      { id: 'c2', title: 'Billing reply' },
    ],
    hasMore: true,
  };
  const shared: PinnedProjectGroup = {
    id: 'p2',
    name: 'Research',
    source: FilterTab.Shared,
    conversations: [{ id: 'c3', title: 'Papers' }],
    hasMore: false,
  };
  const noFilters = {
    searchQuery: '',
    activeFilter: FilterTab.All,
    activeTypeFilter: ConversationTypeFilter.All,
  };

  it('keeps every project unchanged without a search or filter', () => {
    expect(filterPinnedProjects([support, shared], noFilters)).toEqual([
      support,
      shared,
    ]);
  });

  it('keeps all rows and See all of a project whose name matches', () => {
    expect(
      filterPinnedProjects([support], { ...noFilters, searchQuery: 'SUPP' }),
    ).toEqual([support]);
  });

  it('keeps only the matching chats and drops See all on a chat match', () => {
    expect(
      filterPinnedProjects([support], {
        ...noFilters,
        searchQuery: 'billing',
      }),
    ).toEqual([
      {
        ...support,
        conversations: [{ id: 'c2', title: 'Billing reply' }],
        hasMore: false,
      },
    ]);
  });

  it('hides a project with no matching name or chat', () => {
    expect(
      filterPinnedProjects([support], { ...noFilters, searchQuery: 'zzz' }),
    ).toEqual([]);
  });

  it('treats a project without a source as My chats under the Origin filter', () => {
    expect(
      filterPinnedProjects([support, shared], {
        ...noFilters,
        activeFilter: FilterTab.MyChats,
      }),
    ).toEqual([support]);
    expect(
      filterPinnedProjects([support, shared], {
        ...noFilters,
        activeFilter: FilterTab.Shared,
      }),
    ).toEqual([shared]);
    expect(
      filterPinnedProjects([support, shared], {
        ...noFilters,
        activeFilter: FilterTab.Organization,
      }),
    ).toEqual([]);
  });

  it('hides every project under the Task type filter', () => {
    expect(
      filterPinnedProjects([support, shared], {
        ...noFilters,
        activeTypeFilter: ConversationTypeFilter.Task,
      }),
    ).toEqual([]);
  });

  it('keeps projects under the Chat type filter', () => {
    expect(
      filterPinnedProjects([support], {
        ...noFilters,
        activeTypeFilter: ConversationTypeFilter.Chat,
      }),
    ).toEqual([support]);
  });

  it('excludes a project whose source is hidden', () => {
    expect(
      filterPinnedProjects([support, shared], {
        ...noFilters,
        hiddenSources: [FilterTab.Shared],
      }),
    ).toEqual([support]);
  });
});
