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
    { 'aria-label'?: string; onClick?: () => void }
  >(({ 'aria-label': ariaLabel, onClick }, ref) => (
    <button ref={ref} aria-label={ariaLabel} onClick={onClick} />
  )),
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
