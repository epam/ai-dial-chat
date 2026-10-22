import { FilterTab } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_PANEL_CLASS } from '../../../constants/public-class-names';
import type { ConversationListSectionProps } from '../../../models/conversation-list-section';
import { ConversationListSection } from '../ConversationListSection';

vi.mock('@epam/ai-dial-chat-shared', () => ({
  FilterTab: {
    All: 'all',
    Pinned: 'pinned',
    MyChats: 'my-chats',
    Shared: 'shared',
    Organization: 'organization',
  },
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
}));

const listProps = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
}));

/* The list and its header have their own suites; they are replaced by stubs
   that expose what the section hands them, so these tests cover the wiring. */
vi.mock('../../ConversationListHeader/ConversationListHeader', () => ({
  ConversationListHeader: ({
    actions,
    isExpanded,
    onToggleExpanded,
    onSearchChange,
    onSearchOpenChange,
    onFilterChange,
    onTypeFilterChange,
    searchQuery,
    activeFilter,
    hiddenSources,
  }: {
    actions?: ReactNode;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    onSearchChange?: (query: string) => void;
    onSearchOpenChange?: (isOpen: boolean) => void;
    onFilterChange?: (tab: string) => void;
    onTypeFilterChange?: (type: string) => void;
    searchQuery?: string;
    activeFilter?: string;
    hiddenSources?: string[];
  }) => (
    <div role="group" aria-label="list header">
      <button
        aria-expanded={isExpanded}
        aria-label="toggle list"
        onClick={onToggleExpanded}
      />
      <button
        aria-label="type query"
        onClick={() => onSearchChange?.('plot')}
      />
      <button aria-label="clear query" onClick={() => onSearchChange?.('')} />
      <button
        aria-label="open search"
        onClick={() => onSearchOpenChange?.(true)}
      />
      {onFilterChange && (
        <button
          aria-label="choose shared"
          onClick={() => onFilterChange('shared')}
        />
      )}
      {onTypeFilterChange && (
        <button
          aria-label="choose tasks"
          onClick={() => onTypeFilterChange('task')}
        />
      )}
      <span aria-label="header state">{`${searchQuery}|${activeFilter}|${hiddenSources?.join(',') ?? ''}`}</span>
      {actions}
    </div>
  ),
}));

vi.mock('../../ConversationList/ConversationList', () => ({
  ConversationList: (props: Record<string, unknown>) => {
    listProps.current = props;
    return (
      <div
        role="list"
        aria-label="conversation list"
        className={props.className as string | undefined}
      >
        <input aria-label="list state" />
        {(props.conversations as { id: string }[]).map((item) => (
          <button
            key={item.id}
            role="listitem"
            onClick={() =>
              (props.onSelectConversation as (id: string) => void)(item.id)
            }
          >
            {item.id}
          </button>
        ))}
      </div>
    );
  },
}));

const LABELS = {
  title: 'Chats and tasks',
  searchOpenLabel: 'Search chats',
  searchCloseLabel: 'Close search',
  searchPlaceholder: 'Search...',
  searchClearLabel: 'Clear search',
  filterLabels: {
    all: 'All',
    myChats: 'My chats',
    shared: 'Shared',
    organization: 'Organization',
  },
  emptyLabel: 'Empty',
  noResultsLabel: 'No results',
};

const renderSection = (props: Partial<ConversationListSectionProps> = {}) =>
  render(
    <ConversationListSection
      conversations={[{ id: 'c1', title: 'Chat 1' }]}
      onSelectConversation={vi.fn()}
      labels={LABELS}
      {...props}
    />,
  );

describe('ConversationListSection', () => {
  it('renders a region named by the title around the header and the list', () => {
    renderSection();

    const region = screen.getByRole('region', { name: 'Chats and tasks' });
    expect(
      within(region).getByRole('group', { name: 'list header' }),
    ).toBeTruthy();
    expect(
      within(region).getByRole('list', { name: 'conversation list' }),
    ).toBeTruthy();
  });

  it('renders indicator rows and passes the list class through', () => {
    renderSection({ listClassName: 'host-anchor' });

    expect(listProps.current?.rowVariant).toBe('indicator');
    expect(
      screen.getByRole('list', { name: 'conversation list' }).className,
    ).toContain('host-anchor');
  });

  it('selects a conversation through the list', () => {
    const onSelectConversation = vi.fn();
    renderSection({ onSelectConversation });

    fireEvent.click(screen.getByRole('listitem'));

    expect(onSelectConversation).toHaveBeenCalledExactlyOnceWith('c1');
  });

  it('hands the search text from the header to the list', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'type query' }));

    expect(listProps.current?.searchQuery).toBe('plot');
  });

  it('hands the chosen filter to the list and reports it', () => {
    const onFilterChange = vi.fn();
    renderSection({ onFilterChange });

    fireEvent.click(screen.getByRole('button', { name: 'choose shared' }));

    expect(listProps.current?.activeFilter).toBe('shared');
    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith('shared');
  });

  it('adopts a requested filter and again whenever it changes', () => {
    const { rerender } = renderSection({ requestedFilter: FilterTab.MyChats });
    expect(listProps.current?.activeFilter).toBe('my-chats');

    rerender(
      <ConversationListSection
        conversations={[{ id: 'c1', title: 'Chat 1' }]}
        onSelectConversation={vi.fn()}
        labels={LABELS}
        requestedFilter={FilterTab.Shared}
      />,
    );

    expect(listProps.current?.activeFilter).toBe('shared');
  });

  it('hands the chosen type to the list and reports it', () => {
    const onTypeFilterChange = vi.fn();
    renderSection({ onTypeFilterChange });

    fireEvent.click(screen.getByRole('button', { name: 'choose tasks' }));

    expect(listProps.current?.activeTypeFilter).toBe('task');
    expect(onTypeFilterChange).toHaveBeenCalledExactlyOnceWith('task');
  });

  it('omits the type filter when it is hidden, and keeps the origin filter', () => {
    renderSection({ onFilterChange: vi.fn(), isTypeFilterHidden: true });

    expect(screen.queryByRole('button', { name: 'choose tasks' })).toBeNull();
    expect(screen.getByRole('button', { name: 'choose shared' })).toBeTruthy();
  });

  it('omits the filter control when it is hidden', () => {
    renderSection({ isFilterHidden: true });

    expect(screen.queryByRole('button', { name: 'choose shared' })).toBeNull();
    expect(
      screen.getByRole('list', { name: 'conversation list' }),
    ).toBeTruthy();
  });

  it('passes hidden sources to both the header and the list', () => {
    renderSection({ hiddenSources: [FilterTab.Organization] });

    expect(screen.getByLabelText('header state').textContent).toContain(
      'organization',
    );
    expect(listProps.current?.hiddenSources).toEqual(['organization']);
  });

  it('collapses the list through the header title and reports the state', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'toggle list' }));

    expect(
      screen.queryByRole('list', { name: 'conversation list' }),
    ).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'toggle list' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('keeps the list mounted while collapsed, so its own state survives', () => {
    renderSection();
    fireEvent.change(screen.getByRole('textbox', { name: 'list state' }), {
      target: { value: 'kept' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle list' }));
    expect(screen.queryByRole('textbox', { name: 'list state' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'toggle list' }));

    expect(
      (screen.getByRole('textbox', { name: 'list state' }) as HTMLInputElement)
        .value,
    ).toBe('kept');
  });

  it('expands a collapsed list when the search opens', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'toggle list' }));

    fireEvent.click(screen.getByRole('button', { name: 'open search' }));

    expect(
      screen.getByRole('list', { name: 'conversation list' }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'toggle list' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('expands a collapsed list when a search query is typed, but not when it is cleared', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'toggle list' }));

    fireEvent.click(screen.getByRole('button', { name: 'clear query' }));
    expect(
      screen.queryByRole('list', { name: 'conversation list' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'type query' }));
    expect(
      screen.getByRole('list', { name: 'conversation list' }),
    ).toBeTruthy();
  });

  it('renders the header actions slot inside the header', () => {
    renderSection({ headerActions: <button>overflow</button> });

    expect(
      within(screen.getByRole('group', { name: 'list header' })).getByRole(
        'button',
        { name: 'overflow' },
      ),
    ).toBeTruthy();
  });
});

describe('ConversationListSection — public class names', () => {
  it('stamps the section root, last after a host class', () => {
    renderSection({ className: 'host-section' });

    const classes = screen.getByRole('region', {
      name: 'Chats and tasks',
    }).classList;
    expect(classes).toContain(CONVERSATION_PANEL_CLASS.listSection);
    expect(classes).toContain('host-section');
  });
});
