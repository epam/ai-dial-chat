import { FilterTab } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_PANEL_CLASS } from '../../../constants/public-class-names';
import { ConversationItem } from '../../../models/panel-props';
import type { PinnedProjects } from '../../../models/pinned-projects';
import { ConversationPanel } from '../ConversationPanel';

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
  GhostIconButton: ({
    onClick,
    'aria-label': ariaLabel,
    'aria-expanded': ariaExpanded,
  }: {
    onClick?: () => void;
    'aria-label'?: string;
    'aria-expanded'?: boolean;
  }) => (
    <button
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      onClick={onClick}
    />
  ),
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
  Search: ({
    onChange,
    placeholder,
    value,
    clearLabel,
    wrapperClassName,
  }: {
    onChange?: (v?: string) => void;
    placeholder?: string;
    value?: string;
    clearLabel?: string;
    wrapperClassName?: string;
  }) => (
    <div data-testid="search-wrapper" className={wrapperClassName}>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <button aria-label={clearLabel} onClick={() => onChange?.(undefined)} />
    </div>
  ),

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
    onRowsRendered?: (visibleRows: {
      startIndex: number;
      stopIndex: number;
    }) => void;
    [key: string]: unknown;
  }) => {
    /* The whole list fits the test viewport. */
    React.useEffect(() => {
      onRowsRendered?.({ startIndex: 0, stopIndex: rowCount - 1 });
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
      IconBriefcase: () => <span>briefcase</span>,
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
  {
    id: 'c6',
    title: 'Org chat',
    source: FilterTab.Organization,
  },
];

describe('ConversationPanel', () => {
  it('forwards visible conversation IDs from its list', () => {
    const onVisibleConversationIdsChange = vi.fn();
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        onVisibleConversationIdsChange={onVisibleConversationIdsChange}
      />,
    );
    expect(onVisibleConversationIdsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining(items.map(({ id }) => id)),
    );
  });

  it('renders all conversation rows when open', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    /* Every conversation row, plus one list item per group header. */
    expect(screen.getAllByRole('listitem')).toHaveLength(items.length + 4);
    expect(screen.getByText('First chat')).toBeTruthy();
    expect(screen.getByText('Second chat')).toBeTruthy();
  });

  it('shows empty label when conversations is empty', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={[]} />);
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.getAllByText('No conversations yet')).toBeTruthy();
  });

  it('forwards labels.tabEmptyLabels to the list for the active filter tab', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={[]}
        activeFilter={FilterTab.Shared}
        labels={{
          ...BASE_PROPS.labels,
          tabEmptyLabels: {
            [FilterTab.Shared]: { label: 'No shared chats yet' },
          },
        }}
      />,
    );

    expect(screen.getAllByText('No shared chats yet').length).toBeGreaterThan(
      0,
    );
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
    /*
     * A backdrop overlay would be a plain div with no accessible role, so
     * there is no semantic query that can assert its absence.
     */
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
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

  it('renders the filter tabs by default', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('does not render the filter tabs when isFilterTabsHidden is true', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        isFilterTabsHidden
      />,
    );
    expect(screen.queryByText('All')).toBeNull();
  });

  it('still lists every conversation group when the filter tabs are hidden', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        isFilterTabsHidden
      />,
    );
    expect(screen.getByText('Pinned chat')).toBeTruthy();
    expect(screen.getByText('First chat')).toBeTruthy();
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
    /*
     * The mocked IconCaretDownFilled doesn't forward aria-hidden, so the
     * header button's accessible name includes the icon's mock text.
     */
    const pinnedHeader = screen.getByRole('button', {
      name: 'caret-down-filled Pinned',
    });
    expect(screen.getByText('Pinned chat')).toBeTruthy();
    fireEvent.click(pinnedHeader);
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

  /*
   * The corner radius itself is a CSS custom property read by the stylesheet
   * (--cp-search-radius), so what a DOM test can pin is that the panel no
   * longer hardcodes a radius utility on the wrapper.
   */
  it('sets no radius utility on the search field by default', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={[]} />);

    expect(screen.getByTestId('search-wrapper').className).not.toMatch(
      /rounded-/,
    );
  });

  it('still forwards styles.searchWrapperClassName to the search field', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={[]}
        styles={{ searchWrapperClassName: 'rounded-xl' }}
      />,
    );

    expect(
      screen.getByTestId('search-wrapper').classList.contains('rounded-xl'),
    ).toBe(true);
  });

  it('drops conversations whose source is in hiddenSources from every group', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        hiddenSources={[FilterTab.Organization]}
      />,
    );
    expect(screen.queryByText('Org chat')).toBeNull();
    expect(screen.getByText('First chat')).toBeTruthy();
  });

  it('omits the hidden source tab from the filter row', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        hiddenSources={[FilterTab.Organization]}
      />,
    );
    expect(screen.queryByText('Organization')).toBeNull();
    expect(screen.getAllByText('Shared').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty label when every conversation is hidden by hiddenSources', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={[items[5]]}
        hiddenSources={[FilterTab.Organization]}
      />,
    );
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.getAllByText('No conversations yet')).toBeTruthy();
  });
});

/*
 * The public classes are host styling hooks, so these tests never find an
 * element *by* the class — that would still pass with the class on the wrong
 * node. They locate by role or text first, then assert the hook is present.
 *
 * This lives in the main spec rather than its own file so it reuses the ui-kit,
 * chat-shared, sidebar and react-window mocks defined above.
 */
describe('ConversationPanel — public class names', () => {
  it('marks the new-chat button, and only it', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);

    /*
     * Located by its accessible name, which is the label the host passes —
     * finding it by the class would pass even with the class on another node,
     * which is the whole failure this test exists to catch.
     */
    expect(
      screen.getByRole('button', { name: /New chat/ }).classList,
    ).toContain(CONVERSATION_PANEL_CLASS.newChatButton);

    expect(
      screen
        .getAllByRole('button')
        .filter((button) =>
          button.classList.contains(CONVERSATION_PANEL_CLASS.newChatButton),
        ),
    ).toHaveLength(1);
  });

  it('marks the search region found by its role', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);

    expect(screen.getByRole('search').classList).toContain(
      CONVERSATION_PANEL_CLASS.search,
    );
  });
});

describe('ConversationPanel — header style forwarding', () => {
  it('keeps its own header height when the host passes no class', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={[]} />);

    expect(
      screen.getByRole('group', { name: 'panel header' }).classList,
    ).toContain('h-[64px]');
  });

  it('forwards styles.headerClassName onto the header bar', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={[]}
        styles={{ headerClassName: 'h-[80px] border-b' }}
      />,
    );

    const header = screen.getByRole('group', { name: 'panel header' });
    expect(header.classList).toContain('h-[80px]');
    expect(header.classList).toContain('border-b');
  });

  it('forwards styles.newChatButtonClassName onto the New chat button', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={[]}
        styles={{ newChatButtonClassName: 'h-[44px]' }}
      />,
    );

    expect(
      screen.getByRole('button', { name: /New chat/ }).classList,
    ).toContain('h-[44px]');
  });

  it('forwards styles.headerActionsClassName onto the trailing action cluster', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={[]}
        headerActions={<button>Test Action</button>}
        styles={{ headerActionsClassName: 'gap-4' }}
      />,
    );

    expect(
      screen.getByRole('group', { name: 'panel header actions' }).classList,
    ).toContain('gap-4');
  });
});

describe('ConversationPanel — navigation re-renders', () => {
  it('re-renders only the previous and the new active row', () => {
    /* Stable host callback; each row builds its actions only when it must. */
    const getActions = vi.fn((_item: ConversationItem): never[] => []);
    const { rerender } = render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        activeConversationId="c1"
        getActions={getActions}
      />,
    );
    rowRenderLog.length = 0;
    getActions.mockClear();

    rerender(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        activeConversationId="c2"
        getActions={getActions}
      />,
    );

    expect([...rowRenderLog].sort()).toEqual(['First chat', 'Second chat']);
    expect(getActions).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'Second chat' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});

describe('ConversationPanel — pinned projects', () => {
  const seeAllAriaLabel = (name: string) => `All chats of ${name}`;

  const makePinnedProjects = (
    overrides: Partial<PinnedProjects> = {},
  ): PinnedProjects => ({
    projects: [
      {
        id: 'p1',
        name: 'Support',
        href: '/projects/p1',
        conversations: [
          { id: 'n1', title: 'Weekly summary', href: '/projects/p1/n1' },
          { id: 'n2', title: 'Billing reply', href: '/projects/p1/n2' },
        ],
        hasMore: true,
      },
    ],
    onSelectProject: vi.fn(),
    onSelectConversation: vi.fn(),
    onSeeAll: vi.fn(),
    ...overrides,
  });

  const renderPanel = (
    pinnedProjects: PinnedProjects | undefined,
    props: Partial<React.ComponentProps<typeof ConversationPanel>> = {},
  ) =>
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        pinnedProjects={pinnedProjects}
        {...props}
      />,
    );

  it('renders a pinned project with its chats and a See all row', () => {
    renderPanel(makePinnedProjects());

    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('Weekly summary')).toBeTruthy();
    expect(screen.getByText('Billing reply')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'See all chats in Support' }),
    ).toBeTruthy();
    expect(screen.getByText('Pinned chat')).toBeTruthy();
  });

  it('calls the project callbacks and not the panel callback when project rows are activated', async () => {
    const pinnedProjects = makePinnedProjects();
    const onSelectConversation = vi.fn();
    renderPanel(pinnedProjects, { onSelectConversation });

    await userEvent.click(screen.getByRole('link', { name: 'Support' }));
    await userEvent.click(screen.getByRole('link', { name: 'Weekly summary' }));
    await userEvent.click(
      screen.getByRole('link', { name: 'See all chats in Support' }),
    );

    expect(pinnedProjects.onSelectProject).toHaveBeenCalledWith('p1');
    expect(pinnedProjects.onSelectConversation).toHaveBeenCalledWith(
      'n1',
      'p1',
    );
    expect(pinnedProjects.onSeeAll).toHaveBeenCalledWith('p1');
    expect(onSelectConversation).not.toHaveBeenCalled();
  });

  it('filters the project chats by the panel search text and drops See all', async () => {
    renderPanel(makePinnedProjects());

    await userEvent.type(screen.getByRole('searchbox'), 'billing');

    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('Billing reply')).toBeTruthy();
    expect(screen.queryByText('Weekly summary')).toBeNull();
    expect(screen.queryByRole('link', { name: /See all/ })).toBeNull();
  });

  it('hides a project whose source does not match the selected filter chip', async () => {
    const pinnedProjects = makePinnedProjects();
    pinnedProjects.projects[0].source = FilterTab.Shared;
    renderPanel(pinnedProjects);

    expect(screen.getByText('Support')).toBeTruthy();

    await userEvent.click(screen.getByText('My chats', { selector: 'button' }));

    expect(screen.queryByText('Support')).toBeNull();
  });

  it('excludes a project whose source is listed in hiddenSources', () => {
    const pinnedProjects = makePinnedProjects();
    pinnedProjects.projects[0].source = FilterTab.Organization;
    renderPanel(pinnedProjects, { hiddenSources: [FilterTab.Organization] });

    expect(screen.queryByText('Support')).toBeNull();
  });

  it('uses the See all labels passed through the panel labels', () => {
    renderPanel(makePinnedProjects(), {
      labels: {
        ...BASE_PROPS.labels,
        seeAllLabel: 'Show all',
        seeAllAriaLabel,
      },
    });

    const link = screen.getByRole('link', { name: 'All chats of Support' });
    expect(within(link).getByText('Show all')).toBeTruthy();
  });

  it('collapses a project through the panel and reports its toggle', async () => {
    const onToggleProject = vi.fn();
    const pinnedProjects = makePinnedProjects({ onToggleProject });
    pinnedProjects.projects[0].isExpanded = false;
    renderPanel(pinnedProjects);

    expect(screen.queryByText('Weekly summary')).toBeNull();
    expect(screen.queryByRole('link', { name: /See all/ })).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: 'Expand project' }),
    );

    expect(onToggleProject).toHaveBeenCalledWith('p1');
    expect(pinnedProjects.onSelectProject).not.toHaveBeenCalled();
  });

  it('uses the project toggle labels passed through the panel labels', () => {
    renderPanel(makePinnedProjects({ onToggleProject: vi.fn() }), {
      labels: {
        ...BASE_PROPS.labels,
        collapseProjectLabel: 'Hide project chats',
      },
    });

    expect(
      screen.getByRole('button', { name: 'Hide project chats' }),
    ).toBeTruthy();
  });

  it('falls back to the default See all labels', () => {
    renderPanel(makePinnedProjects());

    const link = screen.getByRole('link', { name: 'See all chats in Support' });
    expect(within(link).getByText('See all')).toBeTruthy();
  });

  it('renders no project rows without pinnedProjects', () => {
    renderPanel(undefined);

    expect(screen.queryByText('Support')).toBeNull();
    expect(screen.getByText('Pinned chat')).toBeTruthy();
  });

  it('keeps the list rows still when the labels object is rebuilt with the same values', () => {
    const pinnedProjects = makePinnedProjects();
    const getActions = vi.fn((_item: ConversationItem): never[] => []);
    const { rerender } = renderPanel(pinnedProjects, {
      getActions,
      labels: {
        ...BASE_PROPS.labels,
        seeAllLabel: 'Show all',
        seeAllAriaLabel,
      },
    });
    rowRenderLog.length = 0;
    getActions.mockClear();

    rerender(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        pinnedProjects={pinnedProjects}
        getActions={getActions}
        labels={{
          ...BASE_PROPS.labels,
          seeAllLabel: 'Show all',
          seeAllAriaLabel,
        }}
      />,
    );

    expect(rowRenderLog).toEqual([]);
    expect(getActions).not.toHaveBeenCalled();
  });
});
