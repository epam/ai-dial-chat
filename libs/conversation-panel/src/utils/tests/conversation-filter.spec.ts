import { ConversationKind, FilterTab } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { ConversationItem } from '../../models/panel-props';
import { ConversationTypeFilter } from '../../types/conversation-kind';
import { matchesKind, matchesSearch, matchesTab } from '../conversation-filter';

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
