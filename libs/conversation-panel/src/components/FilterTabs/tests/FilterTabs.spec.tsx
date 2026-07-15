import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterTab } from '../../../types/conversation-classification';
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

const getTab = (label: string) => {
  const tab = screen.getByText(label).closest('div');
  if (!tab) {
    throw new Error(`Tab wrapper for "${label}" not found`);
  }
  return tab;
};

describe('FilterTabs', () => {
  it('renders a tab for each filter', () => {
    renderTabs();
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('My chats')).toBeTruthy();
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.getByText('Organization')).toBeTruthy();
  });

  it('applies flex-1 by default so the tabs fill the row equally', () => {
    renderTabs();
    expect(getTab('All').className).toContain('flex');
  });

  it('lets the host override the tab class', () => {
    renderTabs('shrink-0');
    const tab = getTab('All');
    expect(tab.className).toContain('shrink-0');
    expect(tab.className).not.toContain('flex-1');
  });
});
