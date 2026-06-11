import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ConversationSource,
  type ConversationHistoryItem,
} from '../../../models/ConversationPanel';
import { ConversationPanel } from '../ConversationPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, LG: 24 },
  DialGhostButton: ({
    onClick,
    label,
    'aria-current': ariaCurrent,
  }: {
    onClick: () => void;
    label: string;
    'aria-current'?: React.AriaAttributes['aria-current'];
  }) => (
    <button onClick={onClick} aria-current={ariaCurrent}>
      {label}
    </button>
  ),
  DialSearch: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange: (v: string) => void;
    placeholder: string;
    value: string;
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  DialRoundedButton: ({
    onClick,
    label,
    selected,
  }: {
    onClick: () => void;
    label: string;
    selected?: boolean;
  }) => (
    <button onClick={onClick} aria-selected={selected} role="tab">
      {label}
    </button>
  ),
  DialTag: ({
    onClick,
    label,
    selected,
  }: {
    onClick: () => void;
    label: string;
    selected?: boolean;
  }) => (
    <button onClick={onClick} aria-selected={selected} role="tab">
      {label}
    </button>
  ),
  DialEllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
}));

vi.mock('@epam/ai-dial-sidebar', () => ({
  PanelEmpty: ({ label }: { label: string }) => <div>{label}</div>,
  PanelNoResults: ({ label }: { label: string }) => <div>{label}</div>,
  SearchInput: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange: (v: string) => void;
    placeholder: string;
    value: string;
  }) => (
    <input
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  SidebarPanel: ({
    children,
    isOpen,
    ariaLabel,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
    ariaLabel: string;
  }) => (
    <aside role="complementary" aria-label={ariaLabel} aria-hidden={!isOpen}>
      {children}
    </aside>
  ),
  SidebarSide: { Right: 'right', Left: 'left' },
}));

vi.mock('@tabler/icons-react', () => ({
  ...new Proxy(
    {
      IconPlus: () => <span>plus-icon</span>,
      IconChevronDown: () => <span>chevron-down</span>,
      IconChevronRight: () => <span>chevron-right</span>,
      IconCaretDownFilled: () => <span>caret-down-filled</span>,
      IconCaretRightFilled: () => <span>caret-right-filled</span>,
      IconMessageCircle: () => <span>message-circle</span>,
      IconSearchOff: () => <span>search-off</span>,
    },
    {
      get: (target, key: string) =>
        target[key as keyof typeof target] ??
        (() => <span>{`${key}-icon`}</span>),
    },
  ),
}));

const FILTER_LABELS = {
  all: 'All',
  myChats: 'My chats',
  shared: 'Shared',
  organization: 'Organization',
};

const BASE_PROPS = {
  isOpen: true,
  onSelectConversation: vi.fn(),
  onNewChat: vi.fn(),
  title: 'Chats',
  emptyLabel: 'No conversations yet',
  noResultsLabel: 'No results found',
  newChatLabel: 'New chat',
  searchPlaceholder: 'Search chat…',
  filterLabels: FILTER_LABELS,
};

const items: ConversationHistoryItem[] = [
  {
    id: 'c1',
    title: 'First chat',
    source: ConversationSource.MyChats,
  },
  {
    id: 'c2',
    title: 'Second chat',
    source: ConversationSource.MyChats,
  },
  {
    id: 'c3',
    title: 'Third chat',
    source: ConversationSource.Shared,
  },
  {
    id: 'c4',
    title: 'Pinned chat',
    isPinned: true,
    source: ConversationSource.MyChats,
  },
  {
    id: 'c5',
    title: 'Shared chat',
    source: ConversationSource.Shared,
  },
];

describe('ConversationPanel', () => {
  it('renders all conversation rows when open', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(items.length);
    expect(screen.getByText('First chat')).toBeTruthy();
    expect(screen.getByText('Second chat')).toBeTruthy();
  });

  it('shows empty label when conversations is empty', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={[]} />);
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });

  it('marks the active conversation with aria-current="page"', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        activeConversationId="c2"
      />,
    );
    const activeBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-current') === 'page');
    expect(activeBtn).toBeTruthy();
    expect(activeBtn?.textContent).toContain('Second chat');
  });

  it('calls onSelectConversation with the correct id', () => {
    const onSelect = vi.fn();
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        onSelectConversation={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Third chat'));
    expect(onSelect).toHaveBeenCalledWith('c3');
  });

  it('sets aria-hidden to true when isOpen is false', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        isOpen={false}
      />,
    );
    const aside = screen.getByRole('complementary', { hidden: true });
    expect(aside.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not render backdrop when isOpen is false', () => {
    render(
      <ConversationPanel {...BASE_PROPS} conversations={[]} isOpen={false} />,
    );
    expect(document.querySelector('div[aria-hidden="true"]')).toBeNull();
  });

  it('calls onNewChat when the New chat button is clicked', () => {
    const onNewChat = vi.fn();
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        onNewChat={onNewChat}
      />,
    );
    fireEvent.click(screen.getByText('New chat'));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('filters conversations by search query', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    const input = screen.getByPlaceholderText('Search chat…');
    fireEvent.change(input, { target: { value: 'First' } });
    expect(screen.getByText('First chat')).toBeTruthy();
    expect(screen.queryByText('Second chat')).toBeNull();
  });

  it('shows empty state when search matches nothing', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    const input = screen.getByPlaceholderText('Search chat…');
    fireEvent.change(input, { target: { value: 'zzznomatch' } });
    expect(screen.getByText('No results found')).toBeTruthy();
  });

  it('filters by Shared tab', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Shared' }));
    expect(screen.getByText('Third chat')).toBeTruthy();
    expect(screen.getByText('Shared chat')).toBeTruthy();
    expect(screen.queryByText('First chat')).toBeNull();
  });

  it('combines tab filter and search query', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Shared' }));
    const input = screen.getByPlaceholderText('Search chat…');
    fireEvent.change(input, { target: { value: 'Third' } });
    expect(screen.getByText('Third chat')).toBeTruthy();
    expect(screen.queryByText('Shared chat')).toBeNull();
  });

  it('puts isPinned items in Pinned group and others in My chats group', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(screen.getAllByText('My chats').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pinned chat')).toBeTruthy();
    expect(screen.getByText('First chat')).toBeTruthy();
  });

  it('collapses a group when its header is clicked', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    const pinnedHeader = screen.getByText('Pinned').closest('button');
    expect(pinnedHeader).toBeTruthy();
    expect(screen.getByText('Pinned chat')).toBeTruthy();
    fireEvent.click(pinnedHeader!);
    expect(screen.queryByText('Pinned chat')).toBeNull();
  });

  it('renders filter tabs with correct aria-selected state', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    const allTab = screen.getByRole('tab', { name: 'All' });
    expect(allTab.getAttribute('aria-selected')).toBe('true');
    const sharedTab = screen.getByRole('tab', { name: 'Shared' });
    expect(sharedTab.getAttribute('aria-selected')).toBe('false');
    fireEvent.click(sharedTab);
    expect(
      screen.getByRole('tab', { name: 'Shared' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getByRole('tab', { name: 'All' }).getAttribute('aria-selected'),
    ).toBe('false');
  });
});
