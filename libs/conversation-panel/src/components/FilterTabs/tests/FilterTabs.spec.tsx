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

const getTab = (label: string) => screen.getByRole('tab', { name: label });

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
    expect(getTab('All').className).toContain('contents');
  });
});
