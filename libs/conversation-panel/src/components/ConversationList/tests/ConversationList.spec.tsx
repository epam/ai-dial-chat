import { ConversationKind, FilterTab } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_PANEL_CLASS } from '../../../constants/public-class-names';
import { ConversationItem } from '../../../models/panel-props';
import type {
  PinnedProjectGroup,
  PinnedProjects,
} from '../../../models/pinned-projects';
import { ConversationTypeFilter } from '../../../types/conversation-kind';
import { ConversationRowVariant } from '../../../types/conversation-row-variant';
import { ConversationList } from '../ConversationList';

/* The visible row range the mocked virtual list reports; `null` reports nothing. */
const renderedRange = vi.hoisted(() => ({
  current: null as { startIndex: number; stopIndex: number } | null,
}));

/* Records one entry per ConversationRow body render (its title renders once). */
const rowRenderLog = vi.hoisted((): string[] => []);

vi.mock('@epam/ai-dial-ui-kit', async () => ({
  /* The real live region: a hand-rolled stub would hide its always-mounted markup. */
  ...(await vi
    .importActual<typeof import('@epam/ai-dial-ui-kit')>('@epam/ai-dial-ui-kit')
    .then(({ LiveRegion, LiveRegionElement, LiveRegionPoliteness }) => ({
      LiveRegion,
      LiveRegionElement,
      LiveRegionPoliteness,
    }))),
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
  GhostIconButton: React.forwardRef<
    HTMLButtonElement,
    {
      'aria-label'?: string;
      'aria-expanded'?: boolean;
      'aria-controls'?: string;
      onClick?: () => void;
    }
  >(
    (
      {
        'aria-label': ariaLabel,
        'aria-expanded': ariaExpanded,
        'aria-controls': ariaControls,
        onClick,
      },
      ref,
    ) => (
      <button
        ref={ref}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        onClick={onClick}
      />
    ),
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Skeleton: () => null,
  SkeletonVariant: { Circular: 'circular' },
  Button: ({
    onClick,
    label,
    className,
    'aria-current': ariaCurrent,
    'aria-label': ariaLabel,
  }: {
    onClick?: () => void;
    label?: React.ReactNode;
    className?: string;
    'aria-current'?: React.AriaAttributes['aria-current'];
    'aria-label'?: string;
  }) => (
    <button
      onClick={onClick}
      className={className}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
    >
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
      IconBriefcase: () => <span aria-hidden="true" />,
      IconDotsVertical: () => <span aria-hidden="true" />,
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

  it('gives group headers the secondary color class only over Indicator rows', () => {
    const { rerender } = render(
      <ConversationList {...BASE_PROPS} conversations={items} />,
    );
    /* The icon mocks put their names into the header's, so match the label. */
    const getHeader = () =>
      screen
        .getAllByRole('button')
        .find((button) => within(button).queryByText('Pinned') != null);
    expect(getHeader()?.className).not.toMatch(/groupHeaderIndicator/);

    rerender(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        rowVariant={ConversationRowVariant.Indicator}
      />,
    );

    expect(getHeader()?.className).toMatch(/groupHeaderIndicator/);
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

describe('ConversationList — pinned projects', () => {
  const makeProject = (
    overrides: Partial<PinnedProjectGroup> = {},
  ): PinnedProjectGroup => ({
    id: 'p1',
    name: 'Support',
    href: '/projects/p1',
    conversations: [
      { id: 'n1', title: 'Weekly summary', href: '/projects/p1/n1' },
      { id: 'n2', title: 'Billing reply', href: '/projects/p1/n2' },
    ],
    hasMore: true,
    ...overrides,
  });

  const tenChats = Array.from({ length: 10 }, (_, index) => ({
    id: `n${index + 1}`,
    title: `Nested ${index + 1}`,
  }));

  const pinned: ConversationItem = {
    id: 'c4',
    title: 'Pinned chat',
    isPinned: true,
    source: FilterTab.MyChats,
  };

  const renderList = (
    pinnedProjects: Partial<PinnedProjects> & {
      projects: PinnedProjectGroup[];
    },
    props: Partial<React.ComponentProps<typeof ConversationList>> = {},
  ) => {
    const callbacks = {
      onSelectProject: vi.fn(),
      onSelectConversation: vi.fn(),
      onSeeAll: vi.fn(),
    };
    const onSelectConversation = vi.fn();
    const onMoveConversation = vi.fn();
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={[pinned]}
        onSelectConversation={onSelectConversation}
        onMoveConversation={onMoveConversation}
        rowVariant={ConversationRowVariant.Indicator}
        pinnedProjects={{ ...callbacks, ...pinnedProjects }}
        {...props}
      />,
    );
    return { ...callbacks, onSelectConversation, onMoveConversation };
  };

  /** The `li` whose text includes `text`. */
  const getListItem = (text: string): HTMLElement => {
    const row = screen
      .getAllByRole('listitem')
      .find(
        (item) =>
          item.tagName === 'LI' && within(item).queryByText(text) != null,
      );
    if (!row) throw new Error(`No list item with "${text}"`);
    return row;
  };

  it('draws nested chats as Indicator rows unless the Avatar variant is set', () => {
    const { rerender } = render(
      <ConversationList
        {...BASE_PROPS}
        conversations={[pinned]}
        onSelectConversation={vi.fn()}
        onMoveConversation={vi.fn()}
        rowVariant={ConversationRowVariant.Indicator}
        pinnedProjects={{
          projects: [makeProject({ hasMore: false })],
          onSelectProject: vi.fn(),
          onSelectConversation: vi.fn(),
          onSeeAll: vi.fn(),
        }}
      />,
    );
    /* The mocked kit button keeps its class, which is all the variant leaves on a row here. */
    const getNestedButton = () =>
      within(getListItem('Weekly summary')).getByRole('button');
    expect(getNestedButton().className).toMatch(/itemIndicator/);

    rerender(
      <ConversationList
        {...BASE_PROPS}
        conversations={[pinned]}
        onSelectConversation={vi.fn()}
        onMoveConversation={vi.fn()}
        rowVariant={ConversationRowVariant.Indicator}
        pinnedProjects={{
          projects: [makeProject({ hasMore: false })],
          conversationRowVariant: ConversationRowVariant.Avatar,
          onSelectProject: vi.fn(),
          onSelectConversation: vi.fn(),
          onSeeAll: vi.fn(),
        }}
      />,
    );
    expect(getNestedButton().className).not.toMatch(/itemIndicator/);
  });

  it('offers the project actions on the project row and on See all', () => {
    renderList({
      projects: [makeProject({ conversations: tenChats, hasMore: true })],
      getActions: () => [{ key: 'unpin', label: 'Unpin' }],
    });

    expect(
      within(getListItem('Support')).getByRole('button', {
        name: 'More actions',
      }),
    ).toBeTruthy();
    expect(
      within(getListItem('See all')).getByRole('button', {
        name: 'More actions',
      }),
    ).toBeTruthy();
  });

  it('renders ten nested rows and a See all row with their levels and positions', () => {
    renderList({
      projects: [makeProject({ conversations: tenChats, hasMore: true })],
    });

    expect(getListItem('Support').getAttribute('aria-level')).toBe('1');
    tenChats.forEach((chat, index) => {
      const row = getListItem(chat.title);
      expect(row.getAttribute('aria-level')).toBe('2');
      expect(row.getAttribute('aria-posinset')).toBe(String(index + 1));
      expect(row.getAttribute('aria-setsize')).toBe('11');
    });
    const seeAll = getListItem('See all');
    expect(seeAll.getAttribute('aria-level')).toBe('2');
    expect(seeAll.getAttribute('aria-posinset')).toBe('11');
    expect(seeAll.getAttribute('aria-setsize')).toBe('11');
    expect(
      screen.getByRole('link', { name: 'See all chats in Support' }),
    ).toBeTruthy();
  });

  it('renders the project rows before the pinned conversations', () => {
    renderList({ projects: [makeProject()] });

    const titles = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    const projectIndex = titles.findIndex((text) => text.includes('Support'));
    const pinnedIndex = titles.findIndex((text) =>
      text.includes('Pinned chat'),
    );
    expect(titles[0]).toContain('Pinned');
    expect(projectIndex).toBeGreaterThan(0);
    expect(pinnedIndex).toBeGreaterThan(projectIndex);
  });

  describe('collapsing a project', () => {
    it('renders only the project row of a collapsed project and keeps the rows after it', () => {
      renderList({
        projects: [makeProject({ isExpanded: false })],
        onToggleProject: vi.fn(),
      });

      expect(getListItem('Support')).toBeTruthy();
      expect(screen.queryByText('Weekly summary')).toBeNull();
      expect(screen.queryByText('Billing reply')).toBeNull();
      expect(screen.queryByText('See all')).toBeNull();
      expect(getListItem('Pinned chat')).toBeTruthy();
    });

    it('renders the nested rows of a project whose isExpanded is not set', () => {
      renderList({
        projects: [makeProject()],
        onToggleProject: vi.fn(),
      });

      expect(screen.getByText('Weekly summary')).toBeTruthy();
      expect(screen.getByText('See all')).toBeTruthy();
    });

    it('collapses only the project whose isExpanded is false', () => {
      renderList({
        projects: [
          makeProject({ isExpanded: false }),
          makeProject({
            id: 'p2',
            name: 'Sales',
            conversations: [{ id: 'm1', title: 'Quarterly numbers' }],
            hasMore: false,
          }),
        ],
        onToggleProject: vi.fn(),
      });

      expect(screen.queryByText('Weekly summary')).toBeNull();
      expect(screen.getByText('Quarterly numbers')).toBeTruthy();
    });

    it('reports the toggled project id and does not open it', () => {
      const { onSelectProject, onSelectConversation } = renderList({
        projects: [makeProject()],
        onToggleProject: vi.fn(),
      });

      fireEvent.click(
        within(getListItem('Support')).getByRole('button', {
          name: 'Collapse project',
        }),
      );

      expect(onSelectProject).not.toHaveBeenCalled();
      expect(onSelectConversation).not.toHaveBeenCalled();
    });

    it('passes the toggle callback the project id', () => {
      const onToggleProject = vi.fn();
      renderList({
        projects: [makeProject({ isExpanded: false })],
        onToggleProject,
      });

      fireEvent.click(
        within(getListItem('Support')).getByRole('button', {
          name: 'Expand project',
        }),
      );

      expect(onToggleProject).toHaveBeenCalledWith('p1');
    });

    it('uses the host labels for the chevron', () => {
      renderList(
        { projects: [makeProject()], onToggleProject: vi.fn() },
        {
          labels: {
            ...LABELS,
            collapseProjectLabel: 'Hide project chats',
          },
        },
      );

      expect(
        within(getListItem('Support')).getByRole('button', {
          name: 'Hide project chats',
        }),
      ).toBeTruthy();
    });

    it('renders no chevron without a toggle callback', () => {
      renderList({ projects: [makeProject({ isExpanded: false })] });

      expect(
        screen.queryByRole('button', { name: 'Expand project' }),
      ).toBeNull();
      expect(screen.queryByText('Weekly summary')).toBeNull();
    });

    it('shows a chat that matches the search inside a collapsed project without calling the toggle', () => {
      const onToggleProject = vi.fn();
      renderList(
        {
          projects: [makeProject({ isExpanded: false })],
          onToggleProject,
        },
        { searchQuery: 'billing' },
      );

      expect(screen.getByText('Billing reply')).toBeTruthy();
      expect(screen.queryByText('Weekly summary')).toBeNull();
      expect(
        within(getListItem('Support')).getByRole('button', {
          name: 'Collapse project',
        }),
      ).toBeTruthy();
      expect(onToggleProject).not.toHaveBeenCalled();
    });

    it('keeps a project collapsed when only its name matches the search', () => {
      renderList(
        {
          projects: [makeProject({ isExpanded: false })],
          onToggleProject: vi.fn(),
        },
        { searchQuery: 'support' },
      );

      expect(getListItem('Support')).toBeTruthy();
      expect(screen.queryByText('Weekly summary')).toBeNull();
      expect(screen.queryByText('Billing reply')).toBeNull();
    });

    it('collapses the project again once the search is cleared', () => {
      const props = {
        ...BASE_PROPS,
        conversations: [pinned],
        rowVariant: ConversationRowVariant.Indicator,
        pinnedProjects: {
          projects: [makeProject({ isExpanded: false })],
          onSelectProject: vi.fn(),
          onSelectConversation: vi.fn(),
          onSeeAll: vi.fn(),
          onToggleProject: vi.fn(),
        },
      };
      const { rerender } = render(
        <ConversationList {...props} searchQuery="billing" />,
      );
      expect(screen.getByText('Billing reply')).toBeTruthy();

      rerender(<ConversationList {...props} searchQuery="" />);

      expect(screen.queryByText('Billing reply')).toBeNull();
    });
  });

  it('renders no See all row without more chats', () => {
    renderList({ projects: [makeProject({ hasMore: false })] });

    expect(screen.queryByText('See all')).toBeNull();
    expect(getListItem('Billing reply').getAttribute('aria-setsize')).toBe('2');
  });

  it('renders only the project row for a project with no chats', () => {
    renderList({
      projects: [makeProject({ conversations: [], hasMore: false })],
    });

    expect(getListItem('Support')).toBeTruthy();
    expect(
      screen
        .getAllByRole('listitem')
        .filter((item) => item.getAttribute('aria-level') === '2'),
    ).toHaveLength(0);
  });

  it('calls the project callbacks and never the list selection for nested rows', () => {
    const calls: string[] = [];
    const { onSelectConversation } = renderList({
      projects: [makeProject()],
      onSelectProject: (id) => calls.push(`project:${id}`),
      onSelectConversation: (id, projectId) =>
        calls.push(`chat:${id}:${projectId}`),
      onSeeAll: (id) => calls.push(`see-all:${id}`),
    });

    fireEvent.click(screen.getByRole('link', { name: 'Support' }));
    fireEvent.click(screen.getByRole('link', { name: 'Billing reply' }));
    fireEvent.click(
      screen.getByRole('link', { name: 'See all chats in Support' }),
    );

    expect(calls).toEqual(['project:p1', 'chat:n2:p1', 'see-all:p1']);
    expect(onSelectConversation).not.toHaveBeenCalled();
  });

  it('marks the active project and the active nested chat as the current page', () => {
    renderList(
      { projects: [makeProject()], activeProjectId: 'p1' },
      { activeConversationId: 'n2' },
    );

    expect(
      screen
        .getByRole('button', { name: 'Support' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen
        .getByRole('button', { name: 'Billing reply' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('keeps only the matching chats and no See all row on a chat search', () => {
    renderList({ projects: [makeProject()] }, { searchQuery: 'billing' });

    expect(getListItem('Support')).toBeTruthy();
    expect(screen.getByText('Billing reply')).toBeTruthy();
    expect(screen.queryByText('Weekly summary')).toBeNull();
    expect(screen.queryByText('See all')).toBeNull();
  });

  it('keeps every listed chat and See all on a project name search', () => {
    renderList({ projects: [makeProject()] }, { searchQuery: 'supp' });

    expect(screen.getByText('Weekly summary')).toBeTruthy();
    expect(screen.getByText('Billing reply')).toBeTruthy();
    expect(screen.getByText('See all')).toBeTruthy();
  });

  it('hides every project under the Task type filter', () => {
    renderList(
      { projects: [makeProject()] },
      {
        conversations: [{ ...pinned, kind: ConversationKind.Task }],
        activeTypeFilter: ConversationTypeFilter.Task,
      },
    );

    expect(screen.queryByText('Support')).toBeNull();
    expect(screen.getByText('Pinned chat')).toBeTruthy();
  });

  it('does not treat a list of only project rows as empty', () => {
    renderList({ projects: [makeProject()] }, { conversations: [] });

    expect(screen.queryByText('No conversations yet')).toBeNull();
    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(getListItem('Support')).toBeTruthy();
  });

  it('hides the project rows when the Pinned section collapses', () => {
    renderList({ projects: [makeProject()] });

    fireEvent.click(screen.getByText('Pinned'));

    expect(screen.queryByText('Support')).toBeNull();
    expect(screen.queryByText('Billing reply')).toBeNull();
  });

  it('makes no project row draggable and starts no move from one', () => {
    const { onMoveConversation } = renderList({ projects: [makeProject()] });

    for (const text of ['Support', 'Billing reply', 'See all']) {
      expect(getListItem(text).getAttribute('draggable')).toBeNull();
    }
    fireEvent.dragStart(getListItem('Billing reply'));
    fireEvent.drop(getListItem('Pinned chat'));
    fireEvent.drop(getListItem('Support'));

    expect(onMoveConversation).not.toHaveBeenCalled();
  });

  it('indents nested rows and draws the guide line with logical classes only', () => {
    renderList({ projects: [makeProject()] });

    const first = getListItem('Weekly summary');
    const seeAll = getListItem('See all');
    expect(first.className).toContain('ps-7');
    expect(first.className).toMatch(/guideLine/);
    expect(first.className).toMatch(/guideLineFirst/);
    expect(seeAll.className).toMatch(/guideLineLast/);
    for (const row of [first, getListItem('Billing reply'), seeAll]) {
      expect(row.className).not.toMatch(/\b(pl|pr|ml|mr|left|right)-/);
    }
  });

  it('renders the same rows as before without pinned projects', () => {
    render(
      <ConversationList
        {...BASE_PROPS}
        conversations={items}
        rowVariant={ConversationRowVariant.Indicator}
      />,
    );

    expect(
      screen
        .getAllByRole('listitem')
        .filter((item) => item.hasAttribute('aria-level')),
    ).toHaveLength(0);
    expect(screen.queryByText('See all')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });
});
