import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskItem } from '../../../models/scheduled-task-item';
import { ScheduledTaskCard } from '../ScheduledTaskCard';

interface MockPathItem {
  label: ReactNode;
  disabled?: boolean;
  iconBefore?: ReactNode;
}

vi.mock('@epam/ai-dial-ui-kit', () => ({
  CardShell: ({
    children,
    ...rest
  }: { children: ReactNode } & Record<string, unknown>) => (
    <article {...rest}>{children}</article>
  ),
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialIcon: ({ icon, className }: { icon: ReactNode; className?: string }) => (
    <span className={className}>{icon}</span>
  ),
  DialBreadcrumb: ({
    pathItems,
    labelClassName,
    className,
  }: {
    pathItems: MockPathItem[];
    labelClassName?: string;
    className?: string;
  }) => (
    <div className={className}>
      {pathItems.map((item, i) => (
        <span key={i} className={labelClassName}>
          {item.iconBefore}
          {item.label}
        </span>
      ))}
    </div>
  ),
  DialEllipsisTooltip: ({
    text,
    className,
  }: {
    text: ReactNode;
    className?: string;
  }) => <span className={className}>{text}</span>,
  DialDropdown: ({
    children,
    items,
  }: {
    children: ReactNode;
    items: {
      key: string;
      label: ReactNode;
      onClick: () => void;
    }[];
  }) => (
    <div>
      {children}
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <button onClick={item.onClick}>{item.label}</button>
          </li>
        ))}
      </ul>
    </div>
  ),
  DialIconButton: ({
    icon,
    ...rest
  }: { icon: ReactNode } & Record<string, unknown>) => (
    <button {...rest}>{icon}</button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconChevronRight: () => <svg />,
  IconDotsVertical: () => <svg />,
  IconEdit: () => <svg />,
  IconFolder: () => <svg />,
  IconPlayerPlay: () => <svg />,
  IconTrash: () => <svg />,
}));

const buildItem = (
  overrides?: Partial<ScheduledTaskItem>,
): ScheduledTaskItem => ({
  id: 'sched_1',
  displayName: 'Competitor Updates',
  scheduleLabel: 'Every Monday 12:00',
  sectionKey: 'myTasks',
  sortValues: {},
  ...overrides,
});

describe('ScheduledTaskCard', () => {
  it('highlights the matching substring of the title', () => {
    render(<ScheduledTaskCard item={buildItem()} searchQuery="comp" />);

    const mark = screen.getByText('Comp', { selector: 'mark' });
    expect(mark).toBeTruthy();
  });

  it('renders the schedule pill and location breadcrumb verbatim', () => {
    render(
      <ScheduledTaskCard
        item={buildItem({ locationSegments: ['Public', 'Project folder'] })}
      />,
    );

    expect(screen.getByText('Every Monday 12:00')).toBeTruthy();
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Project folder')).toBeTruthy();
  });

  it('does not render an overflow trigger when no action handlers are supplied', () => {
    render(<ScheduledTaskCard item={buildItem()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows exactly one menu action when only onDelete is supplied and calls it with the item id', async () => {
    const onDelete = vi.fn();
    render(<ScheduledTaskCard item={buildItem()} onDelete={onDelete} />);

    const menuButtons = screen.getAllByRole('button');
    expect(menuButtons).toHaveLength(2); // trigger + single action
    await userEvent.click(screen.getByText('Delete'));

    expect(onDelete).toHaveBeenCalledWith('sched_1');
  });

  it('renders the "new" badge when isNew is set', () => {
    render(<ScheduledTaskCard item={buildItem({ isNew: true })} />);

    expect(screen.getByText('NEW')).toBeTruthy();
  });

  it('renders the card with a fixed height', () => {
    render(<ScheduledTaskCard item={buildItem()} />);

    expect(screen.getByRole('group').className).toContain('h-[232px]');
  });

  it('clamps a long description instead of growing the card', () => {
    render(
      <ScheduledTaskCard
        item={buildItem({
          descriptionPreview: 'a'.repeat(600),
        })}
      />,
    );

    expect(screen.getByText('a'.repeat(600)).className).toContain(
      'line-clamp-4',
    );
  });

  it('pins the schedule pill to the bottom of the card regardless of description length', () => {
    render(
      <ScheduledTaskCard
        item={buildItem({ locationSegments: ['Public', 'Project folder'] })}
      />,
    );

    const pill = screen.getByText('Every Monday 12:00');
    const bottomGroup = pill.closest('div.mt-auto');
    expect(bottomGroup).toBeTruthy();
    expect(bottomGroup?.contains(screen.getByText('Public'))).toBe(true);
  });
});
