import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PinnedProjectGroup } from '../../../models/pinned-projects';
import { ProjectRow } from '../ProjectRow';
import { ProjectSeeAllRow } from '../ProjectSeeAllRow';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  /* Marks the first case-insensitive match, as the kit component does. */
  Highlight: ({
    text,
    query,
    className,
  }: {
    text: string;
    query?: string;
    className?: string;
  }) => {
    const start = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (!query || start < 0) return <span className={className}>{text}</span>;
    const end = start + query.length;
    return (
      <span className={className}>
        {text.slice(0, start)}
        <mark>{text.slice(start, end)}</mark>
        {text.slice(end)}
      </span>
    );
  },
  Button: ({
    iconBefore,
    label,
    'aria-current': ariaCurrent,
    'aria-label': ariaLabel,
    onClick,
    className,
    tabIndex,
  }: {
    iconBefore?: React.ReactNode;
    label?: React.ReactNode;
    'aria-current'?: React.AriaAttributes['aria-current'];
    'aria-label'?: string;
    onClick?: () => void;
    className?: string;
    tabIndex?: number;
  }) => (
    <button
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
      tabIndex={tabIndex}
    >
      {iconBefore}
      {label}
    </button>
  ),
  Dropdown: ({
    children,
    items,
    onOpenChange,
  }: {
    children: React.ReactElement<{ onClick?: () => void }>;
    items?: Array<{ key: string; label: React.ReactNode }>;
    onOpenChange?: (isOpen: boolean) => void;
  }) => (
    <>
      {React.cloneElement(children, {
        onClick: () => onOpenChange?.(true),
      })}
      <ul aria-label="menu items">
        {items?.map((menuItem) => (
          <li key={menuItem.key}>{menuItem.label}</li>
        ))}
      </ul>
    </>
  ),
  GhostIconButton: React.forwardRef<
    HTMLButtonElement,
    {
      'aria-label'?: string;
      'aria-expanded'?: boolean;
      'aria-controls'?: string;
      icon?: React.ReactNode;
      onClick?: () => void;
      onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
    }
  >(
    (
      {
        'aria-label': ariaLabel,
        'aria-expanded': ariaExpanded,
        'aria-controls': ariaControls,
        icon,
        onClick,
        onMouseDown,
      },
      ref,
    ) => (
      <button
        ref={ref}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        onClick={onClick}
        onMouseDown={onMouseDown}
      >
        {icon}
      </button>
    ),
  ),
}));

vi.mock('@epam/ai-dial-chat-shared', () => ({
  mergeClasses: (...classes: (string | undefined | null | false)[]) =>
    classes.filter(Boolean).join(' '),
}));

vi.mock('@tabler/icons-react', () => ({
  IconBriefcase: ({
    className,
    stroke,
    'aria-hidden': ariaHidden,
  }: {
    className?: string;
    stroke?: number;
    'aria-hidden'?: boolean;
  }) => (
    <svg
      role="img"
      aria-hidden={ariaHidden}
      className={className}
      strokeWidth={stroke}
    />
  ),
  IconChevronDown: ({ className }: { className?: string }) => (
    <span aria-hidden="true" className={className}>
      chevron-down
    </span>
  ),
  IconChevronRight: ({ className }: { className?: string }) => (
    <span aria-hidden="true" className={className}>
      chevron-right
    </span>
  ),
  IconDotsVertical: () => <span aria-hidden="true" />,
}));

const project: PinnedProjectGroup = {
  id: 'p1',
  name: 'Support',
  href: '/projects/p1',
  conversations: [{ id: 'c1', title: 'Weekly summary' }],
  hasMore: true,
};

const actions = () => [
  { key: 'unpin', label: 'Unpin' },
  { key: 'edit', label: 'Edit' },
];

describe('ProjectRow', () => {
  const onSelectProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRow = (props: Partial<React.ComponentProps<typeof ProjectRow>>) =>
    render(
      <ProjectRow
        project={project}
        isActive={false}
        onSelectProject={onSelectProject}
        {...props}
      />,
    );

  it('renders the project name as a level-1 list item linking to the project', () => {
    renderRow({});

    const row = screen.getByRole('listitem');
    expect(row.getAttribute('aria-level')).toBe('1');
    expect(
      screen.getByRole('link', { name: 'Support' }).getAttribute('href'),
    ).toBe('/projects/p1');
  });

  it('renders the briefcase icon hidden, with the kit stroke and unmirrored', () => {
    renderRow({});

    const icon = screen.getByRole('img', { hidden: true });
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('stroke-width')).toBe('1.5');
    expect(icon.getAttribute('class') ?? '').not.toContain('rtl:');
  });

  it('paints the briefcase icon in the secondary color class', () => {
    renderRow({});

    expect(
      screen.getByRole('img', { hidden: true }).getAttribute('class'),
    ).toMatch(/projectIcon/);
  });

  it('calls onSelectProject on activation instead of following the link', () => {
    renderRow({});

    const link = screen.getByRole('link', { name: 'Support' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onSelectProject).toHaveBeenCalledWith('p1');
  });

  it('calls onSelectProject from the button when there is no href', () => {
    renderRow({ project: { ...project, href: undefined } });

    fireEvent.click(screen.getByRole('button', { name: 'Support' }));

    expect(onSelectProject).toHaveBeenCalledWith('p1');
  });

  it('marks the active project as the current page', () => {
    renderRow({ isActive: true });

    expect(
      screen
        .getByRole('button', { name: 'Support' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('highlights the matched part of the name', () => {
    renderRow({ searchQuery: 'port' });

    expect(screen.getByText('port').tagName).toBe('MARK');
  });

  it('pads the row 8px on both inline sides without actions', () => {
    renderRow({});

    const button = screen.getByRole('button', { name: 'Support' });
    expect(button.classList.contains('ps-2')).toBe(true);
    expect(button.classList.contains('pe-2')).toBe(true);
  });

  it('renders no actions trigger without actions', () => {
    renderRow({ getActions: () => [] });

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it('reports the trigger when the actions menu opens', () => {
    const onActionMenuOpen = vi.fn();
    renderRow({ getActions: actions, onActionMenuOpen });

    const trigger = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(trigger);

    expect(onActionMenuOpen).toHaveBeenCalledWith(project, trigger);
  });

  it('renders the actions trigger with the host label and items', () => {
    renderRow({ getActions: actions, actionsLabel: 'Project actions' });

    expect(
      screen.getByRole('button', { name: 'Project actions' }),
    ).toBeTruthy();
    const menu = screen.getByRole('list', { name: 'menu items' });
    expect(within(menu).getByText('Unpin')).toBeTruthy();
    expect(within(menu).getByText('Edit')).toBeTruthy();
  });
});

describe('ProjectRow — collapse toggle', () => {
  const onSelectProject = vi.fn();
  const onToggleProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRow = (props: Partial<React.ComponentProps<typeof ProjectRow>>) =>
    render(
      <ProjectRow
        project={project}
        isActive={false}
        onSelectProject={onSelectProject}
        onToggleProject={onToggleProject}
        listId="list-1"
        {...props}
      />,
    );

  it('renders no chevron without a toggle callback', () => {
    renderRow({ onToggleProject: undefined });

    expect(
      screen.queryByRole('button', { name: 'Collapse project' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Expand project' })).toBeNull();
  });

  it('names the chevron after the action and points it at the list while expanded', () => {
    renderRow({ isExpanded: true });

    const toggle = screen.getByRole('button', { name: 'Collapse project' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe('list-1');
    expect(within(toggle).getByText('chevron-down')).toBeTruthy();
  });

  it('names the chevron after the action and mirrors its inline-end arrow while collapsed', () => {
    renderRow({ isExpanded: false });

    const toggle = screen.getByRole('button', { name: 'Expand project' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(toggle).getByText('chevron-right').className).toContain(
      'rtl:scale-x-[-1]',
    );
  });

  it('uses the host labels for the chevron', () => {
    renderRow({
      isExpanded: false,
      expandLabel: 'Show project chats',
      collapseLabel: 'Hide project chats',
    });

    expect(
      screen.getByRole('button', { name: 'Show project chats' }),
    ).toBeTruthy();
  });

  it('toggles the project without opening it', () => {
    renderRow({});

    fireEvent.click(screen.getByRole('button', { name: 'Collapse project' }));

    expect(onToggleProject).toHaveBeenCalledWith('p1');
    expect(onToggleProject).toHaveBeenCalledOnce();
    expect(onSelectProject).not.toHaveBeenCalled();
  });

  it('shows the chevron instead of the project icon on mobile, where there is no hover', () => {
    renderRow({});

    const toggle = screen.getByRole('button', { name: 'Collapse project' });
    expect(toggle.parentElement?.className).toContain('mobile:opacity-100');
    expect(
      screen.getByRole('img', { hidden: true }).parentElement?.className,
    ).toContain('mobile:opacity-0');
  });

  it('keeps the project icon on mobile when there is no toggle', () => {
    renderRow({ onToggleProject: undefined });

    expect(
      screen.getByRole('img', { hidden: true }).parentElement?.className,
    ).not.toContain('mobile:opacity-0');
  });

  it('does not move focus to the chevron on a pointer press', () => {
    renderRow({});

    const notPrevented = fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Collapse project' }),
    );

    expect(notPrevented).toBe(false);
  });

  it('keeps the row highlight on the whole row while the chevron is hovered', () => {
    renderRow({});

    expect(screen.getByRole('listitem').className).toMatch(/projectRow/);
    expect(screen.getByRole('button', { name: 'Support' }).className).toMatch(
      /projectButton/,
    );
  });

  it('leaves the active row on its own highlight', () => {
    renderRow({ isActive: true });

    expect(
      screen.getByRole('button', { name: 'Support' }).className,
    ).not.toMatch(/projectButton/);
  });

  it('keeps the chevron outside the project link', () => {
    renderRow({});

    expect(
      within(screen.getByRole('link')).queryByRole('button', {
        name: 'Collapse project',
      }),
    ).toBeNull();
  });

  it('keeps the actions menu available while collapsed', () => {
    renderRow({ isExpanded: false, getActions: actions });

    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
    expect(screen.getByText('Unpin')).toBeTruthy();
  });

  it('shows the unread dot of a collapsed project with an unread chat', () => {
    renderRow({
      isExpanded: false,
      project: {
        ...project,
        conversations: [{ id: 'c1', title: 'Weekly summary', isUnread: true }],
      },
    });

    expect(screen.getByText('Unread')).toBeTruthy();
  });

  it('uses the host label for the unread dot', () => {
    renderRow({
      isExpanded: false,
      unreadIndicatorLabel: 'New chats',
      project: {
        ...project,
        conversations: [{ id: 'c1', title: 'Weekly summary', isUnread: true }],
      },
    });

    expect(screen.getByText('New chats')).toBeTruthy();
  });

  it('shows no unread dot when the collapsed project has only read chats', () => {
    renderRow({ isExpanded: false });

    expect(screen.queryByText('Unread')).toBeNull();
  });

  it('shows no unread dot while the project is expanded', () => {
    renderRow({
      isExpanded: true,
      project: {
        ...project,
        conversations: [{ id: 'c1', title: 'Weekly summary', isUnread: true }],
      },
    });

    expect(screen.queryByText('Unread')).toBeNull();
  });
});

describe('ProjectSeeAllRow', () => {
  const onSeeAll = vi.fn();
  const position = {
    posInSet: 2,
    setSize: 2,
    isFirstNested: false,
    isLastNested: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRow = (
    props: Partial<React.ComponentProps<typeof ProjectSeeAllRow>> = {},
  ) =>
    render(
      <ProjectSeeAllRow
        project={project}
        position={position}
        onSeeAll={onSeeAll}
        {...props}
      />,
    );

  it('shows the visible label first and names the row after the project', () => {
    renderRow();

    expect(screen.getByText('See all')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'See all chats in Support' }),
    ).toBeTruthy();
  });

  it('uses the host labels', () => {
    renderRow({
      label: 'Tout voir',
      ariaLabel: (name) => `Tout voir dans ${name}`,
    });

    expect(screen.getByText('Tout voir')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Tout voir dans Support' }),
    ).toBeTruthy();
  });

  it('exposes its level and position', () => {
    renderRow();

    const row = screen.getByRole('listitem');
    expect(row.getAttribute('aria-level')).toBe('2');
    expect(row.getAttribute('aria-posinset')).toBe('2');
    expect(row.getAttribute('aria-setsize')).toBe('2');
  });

  it('is indented and closes the guide line', () => {
    renderRow();

    const row = screen.getByRole('listitem');
    expect(row.className).toContain('ps-7');
    expect(row.className).toMatch(/guideLine/);
    expect(row.className).toMatch(/guideLineLast/);
    expect(row.className).not.toMatch(/guideLineFirst/);
  });

  it('renders the text in the secondary color class', () => {
    renderRow();

    expect(screen.getByText('See all').className).toMatch(/seeAllText/);
  });

  it('calls onSeeAll on activation', () => {
    renderRow();

    fireEvent.click(
      screen.getByRole('link', { name: 'See all chats in Support' }),
    );

    expect(onSeeAll).toHaveBeenCalledWith('p1');
  });

  it('renders no actions trigger', () => {
    renderRow();

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it('starts its text at the inline start', () => {
    renderRow();

    expect(screen.getByText('See all').className).toContain('text-start');
  });
});
