import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationItem } from '../../../models/panel-props';
import { FilterTab } from '../../../types/conversation-classification';
import { ConversationPanel } from '../ConversationPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
  DIAL_ICON_SIZE: { SM: 16, LG: 24 },
  GhostButton: ({
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
  SearchBar: ({
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
  Tag: ({
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
  Dropdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Skeleton: () => null,
  SkeletonVariant: { Circular: 'circular' },

  Button: ({
    onClick,
    label,
    'aria-current': ariaCurrent,
  }: {
    onClick?: () => void;
    label?: React.ReactNode;
    'aria-current'?: React.AriaAttributes['aria-current'];
  }) => (
    <button onClick={onClick} aria-current={ariaCurrent}>
      {label}
    </button>
  ),
  Highlight: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@epam/ai-dial-chat-shared', () => ({
  DeploymentIcon: () => null,
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
  buildCssVars: () => ({}),
  Highlight: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@epam/ai-dial-sidebar', () => ({
  PanelEmpty: ({ label }: { label: string }) => <div>{label}</div>,
  PanelNoResults: ({ label }: { label: string }) => <div>{label}</div>,
  SidebarOrientation: { Left: 'left', Right: 'right' },
  SearchInput: ({
    onChange,
    placeholder,
    value,
    clearLabel,
  }: {
    onChange: (v: string) => void;
    placeholder: string;
    value: string;
    clearLabel: string;
  }) => (
    <>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button aria-label={clearLabel} onClick={() => onChange('')} />
    </>
  ),
  SidebarPanel: ({
    children,
    isOpen,
    ariaLabel,
    rightActions,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
    ariaLabel: string;
    rightActions?: React.ReactNode;
  }) => (
    <aside role="complementary" aria-label={ariaLabel} aria-hidden={!isOpen}>
      {rightActions && (
        <div role="group" aria-label="panel header actions">
          {rightActions}
        </div>
      )}
      {children}
    </aside>
  ),
}));

vi.mock('react-window', () => ({
  List: ({
    rowComponent: RowComponent,
    rowCount,
    rowProps,
    role,
  }: {
    rowComponent: React.ComponentType<Record<string, unknown>>;
    rowCount: number;
    rowProps: Record<string, unknown>;
    role?: string;
    [key: string]: unknown;
  }) => (
    <div role={role}>
      {Array.from({ length: rowCount }, (_, index) => (
        <RowComponent
          key={index}
          index={index}
          style={{}}
          ariaAttributes={{}}
          {...rowProps}
        />
      ))}
    </div>
  ),
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
  labels: {
    title: 'Chats',
    emptyLabel: 'No conversations yet',
    noResultsLabel: 'No results found',
    newChatLabel: 'New chat',
    searchPlaceholder: 'Search chat…',
    searchClearLabel: 'Clear search',
    filterLabels: FILTER_LABELS,
  },
};

const items: ConversationItem[] = [
  {
    id: 'c1',
    title: 'First chat',
    source: FilterTab.MyChats,
  },
  {
    id: 'c2',
    title: 'Second chat',
    source: FilterTab.MyChats,
  },
  {
    id: 'c3',
    title: 'Third chat',
    source: FilterTab.Shared,
  },
  {
    id: 'c4',
    title: 'Pinned chat',
    isPinned: true,
    source: FilterTab.MyChats,
  },
  {
    id: 'c5',
    title: 'Shared chat',
    source: FilterTab.Shared,
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
    expect(screen.getAllByText('No conversations yet')).toBeTruthy();
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

  it('renders headerActions in the panel header when provided', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={[]}
        headerActions={<button>Test Action</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Test Action' })).toBeTruthy();
    expect(
      screen.getByRole('group', { name: 'panel header actions' }),
    ).toBeTruthy();
  });

  it('renders without error when headerActions is omitted', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={[]} />);
    expect(
      screen.queryByRole('group', { name: 'panel header actions' }),
    ).toBeNull();
  });
});
