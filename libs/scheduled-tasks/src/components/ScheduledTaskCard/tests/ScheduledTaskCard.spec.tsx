import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScheduledTaskSectionKey,
  type ScheduledTaskItem,
} from '../../../models/scheduled-task-item';
import { ScheduledTaskCard } from '../ScheduledTaskCard';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  CardShell: ({
    children,
    ...rest
  }: { children: ReactNode } & Record<string, unknown>) => (
    <article {...rest}>{children}</article>
  ),
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Highlight: ({
    text,
    query,
    className,
  }: {
    text: string;
    query?: string;
    className?: string;
  }) => {
    if (!query) return <span className={className}>{text}</span>;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return <span className={className}>{text}</span>;
    return (
      <span className={className}>
        {text.slice(0, index)}
        <mark>{text.slice(index, index + query.length)}</mark>
        {text.slice(index + query.length)}
      </span>
    );
  },
  FolderPath: ({
    segments,
    className,
  }: {
    segments: string[];
    className?: string;
  }) => (
    <div className={className}>
      {segments.map((segment, i) => (
        <span key={i}>{segment}</span>
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
}));

vi.mock('@tabler/icons-react', () => ({
  IconPlayerPause: () => <svg />,
}));

const buildItem = (
  overrides?: Partial<ScheduledTaskItem>,
): ScheduledTaskItem => ({
  id: 'sched_1',
  displayName: 'Competitor Updates',
  scheduleLabel: 'Every Monday 12:00',
  sectionKey: ScheduledTaskSectionKey.MyTasks,
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

  it('renders no interactive control when onCardClick is omitted', () => {
    render(<ScheduledTaskCard item={buildItem()} />);

    expect(screen.queryByRole('button')).toBeNull();
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

  it('invokes onCardClick with the item id when the card body is clicked', async () => {
    const onCardClick = vi.fn();
    render(<ScheduledTaskCard item={buildItem()} onCardClick={onCardClick} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Competitor Updates' }),
    );

    expect(onCardClick).toHaveBeenCalledWith('sched_1');
  });

  it('invokes onCardClick on Enter/Space keyboard activation', async () => {
    const onCardClick = vi.fn();
    render(<ScheduledTaskCard item={buildItem()} onCardClick={onCardClick} />);

    const card = screen.getByRole('button', { name: 'Competitor Updates' });
    card.focus();
    await userEvent.keyboard('{Enter}');

    expect(onCardClick).toHaveBeenCalledWith('sched_1');
  });

  it('renders no added interactive semantics when onCardClick is omitted', () => {
    render(<ScheduledTaskCard item={buildItem()} />);

    expect(
      screen.queryByRole('button', { name: 'Competitor Updates' }),
    ).toBeNull();
    expect(screen.getByRole('group')).toBeTruthy();
  });

  it('renders the "Paused" badge instead of the schedule pill when isActive is false', () => {
    render(<ScheduledTaskCard item={buildItem({ isActive: false })} />);

    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.queryByText('Every Monday 12:00')).toBeNull();
  });

  it('renders the schedule pill when isActive is true or omitted', () => {
    render(<ScheduledTaskCard item={buildItem({ isActive: true })} />);

    expect(screen.getByText('Every Monday 12:00')).toBeTruthy();
    expect(screen.queryByText('Paused')).toBeNull();

    render(<ScheduledTaskCard item={buildItem()} />);
    expect(
      screen.getAllByText('Every Monday 12:00').length,
    ).toBeGreaterThan(0);
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
