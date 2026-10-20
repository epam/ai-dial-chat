import { FilterTab } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { ConversationItem } from '../../models/panel-props';
import { matchesSearch, matchesTab } from '../conversation-filter';

const item: ConversationItem = {
  id: '1',
  title: 'Quarterly Report',
  source: FilterTab.Shared,
};

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
