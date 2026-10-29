import { ConversationKind, FilterTab } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_PANEL_CLASS } from '../../../constants/public-class-names';
import { ConversationItem } from '../../../models/panel-props';
import { ConversationTypeFilter } from '../../../types/conversation-kind';
import { ConversationList } from '../ConversationList';

/* The visible row range the mocked virtual list reports; `null` reports nothing. */
const renderedRange = vi.hoisted(() => ({
  current: null as { startIndex: number; stopIndex: number } | null,
}));

/* Records one entry per ConversationRow body render (its title renders once). */
const rowRenderLog = vi.hoisted((): string[] => []);

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
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
    <button onClick={onClick} aria-pressed={selected}>
      {label}
    </button>
  ),
  FilterChips: <T extends string>({
    items,
    value,
    onChange,
    'aria-label': ariaLabel,
    chipClassName,
  }: {
    items: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    'aria-label'?: string;
    chipClassName?: string;
  }) => (
    <div role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          aria-pressed={item.value === value}
          className={chipClassName}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  TagAppearance: { Outlined: 'outlined', Selectable: 'selectable' },
  EllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  Dropdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Skeleton: () => null,
  SkeletonVariant: { Circular: 'circular' },
  Button: ({
    onClick,
    label,
    className,
    'aria-current': ariaCurrent,
  }: {
    onClick?: () => void;
    label?: React.ReactNode;
    className?: string;
    'aria-current'?: React.AriaAttributes['aria-current'];
  }) => (
    <button onClick={onClick} className={className} aria-current={ariaCurrent}>
      {label}
    </button>
  ),
  Highlight: ({ text }: { text: string }) => {
    rowRenderLog.push(text);
    return <span>{text}</span>;
  },
}));

vi.mock('@epam/ai-dial-chat-shared', () => ({
  FilterTab: {
    All: 'all',
    Pinned: 'pinned',
    MyChats: 'my-chats',
    Shared: 'shared',
    Organization: 'organization',
  },
  ConversationKind: { Chat: 'chat', Task: 'task' },
  DeploymentIcon: () => null,
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
  buildCssVars: () => ({}),
  Highlight: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@epam/ai-dial-sidebar', () => ({
  PanelEmpty: ({
    label,
    description,
  }: {
    label: string;
    description?: string;
  }) => (
    <div>
      {label}
      {description && <p>{description}</p>}
    </div>
  ),
  PanelNoResults: ({
    label,
    description,
  }: {
    label: string;
    description?: string;
  }) => (
    <div>
      {label}
      {description && <p>{description}</p>}
    </div>
  ),
  SidebarOrientation: { Left: 'left', Right: 'right' },
  /*
   * The real panel puts `styles.headerClassName` on its header bar and
   * `styles.headerActionsClassName` on the cluster holding `rightActions`.
   * The stand-in keeps that nesting and gives both boxes a role and name, so
   * a class landing on the wrong one fails without reaching into the DOM.
   */
  SidebarPanel: ({
    children,
    isOpen,
    ariaLabel,
    rightActions,
    styles,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
    ariaLabel: string;
    rightActions?: React.ReactNode;
    styles?: {
      headerClassName?: string;
      headerActionsClassName?: string;
    };
  }) => (
    <aside role="complementary" aria-label={ariaLabel} aria-hidden={!isOpen}>
      <div
        role="group"
        aria-label="panel header"
        className={styles?.headerClassName}
      >
        {rightActions && (
          <div
            role="group"
            aria-label="panel header actions"
            className={styles?.headerActionsClassName}
          >
            {rightActions}
          </div>
        )}
      </div>
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
    onRowsRendered,
  }: {
    rowComponent: React.ComponentType<Record<string, unknown>>;
    rowCount: number;
    rowProps: Record<string, unknown>;
    role?: string;
    onRowsRendered?: (
      visibleRows: { startIndex: number; stopIndex: number },
      allRows: { startIndex: number; stopIndex: number },
    ) => void;
    [key: string]: unknown;
  }) => {
    /* Reports the test's viewport, plus every row as overscan. */
    React.useEffect(() => {
      if (!renderedRange.current) return;
      onRowsRendered?.(renderedRange.current, {
        startIndex: 0,
        stopIndex: rowCount - 1,
      });
    });
    return (
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
    );
  },
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

const LABELS = {
  emptyLabel: 'No conversations yet',
  noResultsLabel: 'No results found',
};

const BASE_PROPS = {
  onSelectConversation: vi.fn(),
  labels: LABELS,
};

const items: ConversationItem[] = [
  { id: 'c1', title: 'First chat', source: FilterTab.MyChats },
  { id: 'c2', title: 'Second chat', source: FilterTab.MyChats },
  { id: 'c3', title: 'Third chat', source: FilterTab.Shared },
  { id: 'c4', title: 'Pinned chat', isPinned: true, source: FilterTab.MyChats },
  { id: 'c5', title: 'Shared chat', source: FilterTab.Shared },
  { id: 'c6', title: 'Org chat', source: FilterTab.Organization },
];

/** The row (`li`) holding the button with the given accessible name. */
const getRow = (name: string): HTMLElement => {
  const row = screen
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('button', { name }) != null);
  if (!row) throw new Error(`No row named "${name}"`);
  return row;
};

describe('ConversationList', () => {
  it('retains an opened search match when its title changes, until the query changes', () => {
    const props = {
      ...BASE_PROPS,
      activeConversationId: 'c1',
      preserveActiveSearchResult: true,
      searchQuery: 'First',
    };
    const { rerender } = render(
      <ConversationList {...props} conversations={items} />,
    );
    const renamed = items.map((item) =>
      item.id === 'c1' ? { ...item, title: 'Current name' } : item,
    );
    rerender(<ConversationList {...props} conversations={renamed} />);
    expect(screen.getByRole('button', { name: 'Current name' })).toBeTruthy();
    rerender(
      <ConversationList
        {...props}
        conversations={renamed}
        searchQuery="First c"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Current name' })).toBeNull();
    expect(screen.getAllByText('No results found').length).toBeGreaterThan(0);
  });

  it('does not retain a deleted result or bypass source filters after a title update', () => {
    const props = {
      ...BASE_PROPS,
      activeConversationId: 'c1',
      preserveActiveSearchResult: true,
      searchQuery: 'First',
    };
    const { rerender } = render(
      <ConversationList {...props} conversations={items} />,
    );
    const renamed = items.map((item) =>
      item.id === 'c1' ? { ...item, title: 'Current name' } : item,
    );
    rerender(
      <ConversationList
        {...props}
        conversations={renamed}
        activeFilter={FilterTab.Shared}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Current name' })).toBeNull();
    rerender(
      <ConversationList
        {...props}
        conversations={renamed.filter(({ id }) => id !== 'c1')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Current name' })).toBeNull();
  });

  it('keeps the existing search behavior unless retention is enabled', () => {
    const props = {
      ...BASE_PROPS,
      activeConversationId: 'c1',
      searchQuery: 'First',
    };
    const { rerender } = render(
      <ConversationList {...props} conversations={items} />,
    );
    rerender(
      <ConversationList
        {...props}
        conversations={items.map((item) => ({ ...item, title: 'Renamed' }))}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Renamed' })).toBeNull();
  });

  it('shows a pending search state without hiding already matching rows', () => {
    const props = {
      ...BASE_PROPS,
      conversations: items,
      isUpdatingTitles: true,
      labels: { ...LABELS, updatingTitlesLabel: 'Updating names' },
    };
    const { rerender } = render(
      <ConversationList {...props} searchQuery="First" />,
    );
    expect(screen.getByRole('button', { name: 'First chat' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Updating names');
    rerender(<ConversationList {...props} searchQuery="New title" />);
    expect(screen.queryByText('No results found')).toBeNull();
    expect(screen.getAllByText('Updating names').length).toBeGreaterThan(0);
    rerender(
      <ConversationList
        {...props}
        searchQuery="New title"
        isUpdatingTitles={false}
      />,
    );
    expect(screen.getAllByText('No results found').length).toBeGreaterThan(0);
  });

  it('keeps the list valid by making each group header a list item', () => {
    render(<ConversationList {...BASE_PROPS} conversations={items} />);

    for (const heading of ['Pinned', 'My chats', 'Shared', 'Organization']) {
      const header = screen
        .getAllByRole('listitem')
        .find((item) => within(item).queryByText(heading) != null);
      expect(header).toBeTruthy();
    }
  });

  it('renders every group', () => {
    render(<ConversationList {...BASE_PROPS} conversations={items} />);

    ['Pinned', 'My chats', 'Shared', 'Organization'].forEach((heading) => {
      expect(screen.getByText(heading)).toBeTruthy();
    });
  });

  it('stamps the list root with the public list class', () => {
    render(<ConversationList {...BASE_PROPS} conversations={items} />);

    /* The root has no role; it is found as the parent of its own live region,
       which is always its first child. */
    /* eslint-disable testing-library/no-node-access -- see above */
    const root = screen.getByRole('status').parentElement;
    /* eslint-enable testing-library/no-node-access */

    expect(root?.classList).toContain(CONVERSATION_PANEL_CLASS.list);
  });

  it('puts the typography class and font family on the list root', () => {
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        styles={{
          typography: { fontClassName: 'dial-small-text', fontFamily: 'Inter' },
        }}
      />,
    );

    /* eslint-disable testing-library/no-node-access -- the root is found as in the public-class test above */
    const root = screen.getByRole('status').parentElement;
    /* eslint-enable testing-library/no-node-access */

    expect(root?.classList).toContain('dial-small-text');
  });

  it('shows only tasks, or only chats, for the type filter', () => {
    const mixed: ConversationItem[] = [
      { id: 't1', title: 'Daily digest', kind: ConversationKind.Task },
      { id: 'c1', title: 'Plain chat' },
    ];
    const { rerender } = render(
      <ConversationList
        {...BASE_PROPS}
        conversations={mixed}
        activeTypeFilter={ConversationTypeFilter.Task}
      />,
    );

    expect(screen.getByRole('button', { name: 'Daily digest' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Plain chat' })).toBeNull();

    rerender(
      <ConversationList
        {...BASE_PROPS}
        conversations={mixed}
        activeTypeFilter={ConversationTypeFilter.Chat}
      />,
    );

    expect(screen.getByRole('button', { name: 'Plain chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Daily digest' })).toBeNull();
  });

  it('applies the controlled filter', () => {
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        activeFilter={FilterTab.Shared}
      />,
    );

    expect(screen.getByRole('button', { name: 'Third chat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shared chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'First chat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Org chat' })).toBeNull();
  });

  it('applies the controlled search and reports no results', () => {
    const { rerender } = render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        searchQuery="shared"
      />,
    );

    expect(screen.getByRole('button', { name: 'Shared chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'First chat' })).toBeNull();

    rerender(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        searchQuery="zzz"
      />,
    );

    expect(screen.getAllByText('No results found').length).toBeGreaterThan(0);
  });

  describe('empty and no-results states', () => {
    const personalOnly = items.filter(
      (item) => item.source === FilterTab.MyChats,
    );
    const labels = {
      ...LABELS,
      noResultsDescription:
        'Try a different search term or check your filters.',
      sharedEmptyDescription: 'Chats other people share with you show up here.',
    };

    it('reports no results when a filter matches nothing', () => {
      render(
        <ConversationList
          {...BASE_PROPS}
          labels={labels}
          conversations={personalOnly}
          activeTypeFilter={ConversationTypeFilter.Task}
        />,
      );

      expect(screen.getByRole('status').textContent).toBe('No results found');
      expect(
        screen.getByText('Try a different search term or check your filters.'),
      ).toBeTruthy();
    });

    it('reports no results with the shared description under the Shared filter', () => {
      render(
        <ConversationList
          {...BASE_PROPS}
          labels={labels}
          conversations={personalOnly}
          activeFilter={FilterTab.Shared}
        />,
      );

      expect(screen.getByRole('status').textContent).toBe('No results found');
      expect(
        screen.getByText('Chats other people share with you show up here.'),
      ).toBeTruthy();
    });

    it('keeps the search description for a search under the Shared filter', () => {
      render(
        <ConversationList
          {...BASE_PROPS}
          labels={labels}
          conversations={personalOnly}
          activeFilter={FilterTab.Shared}
          searchQuery="zzz"
        />,
      );

      expect(
        screen.getByText('Try a different search term or check your filters.'),
      ).toBeTruthy();
      expect(
        screen.queryByText('Chats other people share with you show up here.'),
      ).toBeNull();
    });

    describe('per-tab empty labels', () => {
      const tabLabels = {
        ...labels,
        tabEmptyLabels: {
          [FilterTab.Shared]: {
            label: 'No shared chats yet',
            description: 'Shared chats will show up here.',
          },
          [FilterTab.Organization]: { description: 'Org chats show up here.' },
        },
      };

      it('uses the tab label and description when the tab alone matches nothing', () => {
        render(
          <ConversationList
            {...BASE_PROPS}
            labels={tabLabels}
            conversations={personalOnly}
            activeFilter={FilterTab.Shared}
          />,
        );

        expect(screen.getByRole('status').textContent).toBe(
          'No shared chats yet',
        );
        expect(
          screen.getByText('Shared chats will show up here.'),
        ).toBeTruthy();
        expect(
          screen.queryByText('Chats other people share with you show up here.'),
        ).toBeNull();
      });

      it('falls back to the generic label for a field the tab leaves out', () => {
        render(
          <ConversationList
            {...BASE_PROPS}
            labels={tabLabels}
            conversations={personalOnly}
            activeFilter={FilterTab.Organization}
          />,
        );

        expect(screen.getByRole('status').textContent).toBe('No results found');
        expect(screen.getByText('Org chats show up here.')).toBeTruthy();
      });

      it('keeps the generic text for a search under the tab', () => {
        render(
          <ConversationList
            {...BASE_PROPS}
            labels={tabLabels}
            conversations={personalOnly}
            activeFilter={FilterTab.Shared}
            searchQuery="zzz"
          />,
        );

        expect(screen.getByRole('status').textContent).toBe('No results found');
        expect(
          screen.getByText(
            'Try a different search term or check your filters.',
          ),
        ).toBeTruthy();
      });

      it('keeps the generic text when a type filter narrows the tab too', () => {
        render(
          <ConversationList
            {...BASE_PROPS}
            labels={tabLabels}
            conversations={personalOnly}
            activeFilter={FilterTab.Shared}
            activeTypeFilter={ConversationTypeFilter.Task}
          />,
        );

        expect(screen.getByRole('status').textContent).toBe('No results found');
      });

      it('ignores tab labels on the All tab', () => {
        render(
          <ConversationList
            {...BASE_PROPS}
            labels={tabLabels}
            conversations={[]}
          />,
        );

        expect(screen.getByRole('status').textContent).toBe(
          'No conversations yet',
        );
      });
    });

    it('reports no results when a filter is set and there are no conversations at all', () => {
      render(
        <ConversationList
          {...BASE_PROPS}
          conversations={[]}
          activeFilter={FilterTab.Shared}
        />,
      );

      expect(screen.getByRole('status').textContent).toBe('No results found');
    });
  });

  it('drops hidden sources before grouping', () => {
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        hiddenSources={[FilterTab.Organization]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Org chat' })).toBeNull();
    expect(screen.queryByText('Organization')).toBeNull();
  });

  it('shows the empty state and announces it', () => {
    render(<ConversationList {...BASE_PROPS} conversations={[]} />);

    expect(screen.getAllByText('No conversations yet').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole('status').textContent).toBe('No conversations yet');
  });

  it('announces loading and hides the rows', () => {
    render(
      <ConversationList {...BASE_PROPS} conversations={items} isLoading />,
    );

    expect(screen.getByRole('status').textContent).toBe(
      'Loading conversations',
    );
    expect(screen.queryByRole('button', { name: 'First chat' })).toBeNull();
  });

  it('marks the active conversation as the current page', () => {
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        activeConversationId="c2"
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Second chat' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('collapses a group when its header is toggled', () => {
    render(<ConversationList {...BASE_PROPS} conversations={items} />);

    fireEvent.click(screen.getByText('Organization'));

    expect(screen.queryByRole('button', { name: 'Org chat' })).toBeNull();
  });

  it('reports a drop onto the pinned group', () => {
    const onMoveConversation = vi.fn();
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        onMoveConversation={onMoveConversation}
      />,
    );

    const dragged = getRow('First chat');
    const target = getRow('Pinned chat');

    fireEvent.dragStart(dragged);
    fireEvent.drop(target);

    /* The insertion point (`afterId`) comes from the cursor position, which
       jsdom does not provide; `utils/tests/drag.spec.ts` covers it. */
    expect(onMoveConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        draggedId: 'c1',
        targetGroupKey: FilterTab.Pinned,
      }),
    );
  });

  it('ignores a drop onto a group that is not allowed', () => {
    const onMoveConversation = vi.fn();
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        onMoveConversation={onMoveConversation}
      />,
    );

    const dragged = getRow('First chat');
    const target = getRow('Shared chat');

    fireEvent.dragStart(dragged);
    fireEvent.drop(target);

    expect(onMoveConversation).not.toHaveBeenCalled();
  });

  it('re-renders only the two affected rows when the active conversation changes', () => {
    const getActions = vi.fn(() => []);
    const { rerender } = render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        activeConversationId="c1"
        getActions={getActions}
      />,
    );
    rowRenderLog.length = 0;
    getActions.mockClear();

    rerender(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        activeConversationId="c2"
        getActions={getActions}
      />,
    );

    expect([...rowRenderLog].sort()).toEqual(['First chat', 'Second chat']);
    expect(getActions).not.toHaveBeenCalled();
  });
});

/*
 * Virtual rows for `items`: 0 Pinned header, 1 c4, 2 My chats header, 3 c1,
 * 4 c2, 5 Shared header, 6 c3, 7 c5, 8 Organization header, 9 c6.
 */
describe('ConversationList — visible conversation IDs', () => {
  afterEach(() => {
    renderedRange.current = null;
  });

  it('reports only conversations in the visible range, without headers or overscan rows', () => {
    renderedRange.current = { startIndex: 0, stopIndex: 4 };
    const onVisibleConversationIdsChange = vi.fn();
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        onVisibleConversationIdsChange={onVisibleConversationIdsChange}
      />,
    );
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([
      'c4',
      'c1',
      'c2',
    ]);
  });

  it('does not notify again while the visible sequence is unchanged', () => {
    renderedRange.current = { startIndex: 0, stopIndex: 4 };
    const onVisibleConversationIdsChange = vi.fn();
    const props = {
      ...BASE_PROPS,
      conversations: items,
      onVisibleConversationIdsChange,
    };
    const { rerender } = render(<ConversationList {...props} />);
    /* A fresh array re-renders the memoized list, as a scroll re-renders the virtualizer. */
    renderedRange.current = { startIndex: 1, stopIndex: 5 };
    rerender(<ConversationList {...props} conversations={[...items]} />);
    rerender(<ConversationList {...props} conversations={[...items]} />);
    expect(onVisibleConversationIdsChange).toHaveBeenCalledOnce();
  });

  it('reports a new sequence when the viewport scrolls', () => {
    renderedRange.current = { startIndex: 0, stopIndex: 4 };
    const onVisibleConversationIdsChange = vi.fn();
    const props = {
      ...BASE_PROPS,
      conversations: items,
      onVisibleConversationIdsChange,
    };
    const { rerender } = render(<ConversationList {...props} />);
    renderedRange.current = { startIndex: 5, stopIndex: 9 };
    rerender(<ConversationList {...props} conversations={[...items]} />);
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([
      'c3',
      'c5',
      'c6',
    ]);
  });

  it('reports the rows that move into an unchanged range when a group collapses', () => {
    renderedRange.current = { startIndex: 0, stopIndex: 4 };
    const onVisibleConversationIdsChange = vi.fn();
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        onVisibleConversationIdsChange={onVisibleConversationIdsChange}
      />,
    );
    fireEvent.click(screen.getByText('My chats'));
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([
      'c4',
      'c3',
    ]);
  });

  it('reports a duplicated conversation ID once', () => {
    renderedRange.current = { startIndex: 0, stopIndex: 3 };
    const onVisibleConversationIdsChange = vi.fn();
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={[items[0], items[0], items[1]]}
        onVisibleConversationIdsChange={onVisibleConversationIdsChange}
      />,
    );
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([
      'c1',
      'c2',
    ]);
  });

  it.each([
    { name: 'the list is empty', props: { conversations: [] } },
    { name: 'the list is loading', props: { isLoading: true } },
    { name: 'a search has no visible match', props: { searchQuery: 'zzz' } },
  ])('reports no visible conversations when $name', ({ props }) => {
    renderedRange.current = { startIndex: 0, stopIndex: 4 };
    const onVisibleConversationIdsChange = vi.fn();
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        onVisibleConversationIdsChange={onVisibleConversationIdsChange}
        {...props}
      />,
    );
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([]);
  });

  it('clears the report when a search hides every visible row, then restores it', () => {
    renderedRange.current = { startIndex: 0, stopIndex: 4 };
    const onVisibleConversationIdsChange = vi.fn();
    const props = {
      ...BASE_PROPS,
      conversations: items,
      onVisibleConversationIdsChange,
    };
    const { rerender } = render(<ConversationList {...props} />);
    rerender(<ConversationList {...props} searchQuery="zzz" />);
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([]);
    rerender(<ConversationList {...props} searchQuery="" />);
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([
      'c4',
      'c1',
      'c2',
    ]);
  });

  it('reports the same IDs inside a right-to-left document', () => {
    renderedRange.current = { startIndex: 0, stopIndex: 4 };
    const onVisibleConversationIdsChange = vi.fn();
    render(
      <div dir="rtl">
        <ConversationList
          {...BASE_PROPS}
          conversations={items}
          isUpdatingTitles
          onVisibleConversationIdsChange={onVisibleConversationIdsChange}
        />
      </div>,
    );
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith([
      'c4',
      'c1',
      'c2',
    ]);
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('status').textContent).toBe(
      'Updating conversation names',
    );
  });
});
