import { FilterTab } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterTabs } from '../FilterTabs';

const labels = {
  all: 'All',
  myChats: 'My chats',
  shared: 'Shared',
  organization: 'Organization',
};

const renderTabs = (tabClassName?: string) =>
  render(
    <FilterTabs
      activeTab={FilterTab.All}
      labels={labels}
      onChange={vi.fn()}
      tabClassName={tabClassName}
    />,
  );

const getTab = (label: string) => screen.getByRole('button', { name: label });

describe('FilterTabs', () => {
  it('renders a tab for each filter', () => {
    renderTabs();
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('My chats')).toBeTruthy();
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.getByText('Organization')).toBeTruthy();
  });

  it('marks only the active tab as pressed', () => {
    renderTabs();
    expect(getTab('All').getAttribute('aria-pressed')).toBe('true');
    expect(getTab('Shared').getAttribute('aria-pressed')).toBe('false');
  });

  it('names the filter row so the group is announced', () => {
    renderTabs();
    expect(screen.getByRole('group', { name: 'Filter chats' })).toBeTruthy();
  });

  it('applies flex-1 by default so the tabs fill the row equally', () => {
    renderTabs();
    expect(getTab('All').className).toContain('flex-1');
  });

  it('applies the provided typography class to each tab', () => {
    renderTabs('dial-small-text');
    expect(getTab('All').className).toContain('dial-small-text');
  });
});
