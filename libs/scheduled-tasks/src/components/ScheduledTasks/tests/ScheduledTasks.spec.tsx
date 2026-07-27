import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskItem } from '../../../models/scheduled-task-item';
import { ScheduledTasksProps } from '../../../models/scheduled-tasks-props';
import { ScheduledTasks } from '../ScheduledTasks';

vi.mock('@epam/ai-dial-kit', () => ({
  FolderPath: ({ segments }: { segments: string[] }) => (
    <>{segments.join(' / ')}</>
  ),
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  GhostButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  SearchBar: ({
    value,
    onChange,
    labels,
  }: {
    value: string;
    onChange: (v: string) => void;
    labels?: {
      placeholder?: string;
      ariaLabel?: string;
      clearLabel?: string;
    };
  }) => (
    <>
      <input
        value={value}
        placeholder={labels?.placeholder}
        aria-label={labels?.ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label={labels?.clearLabel} onClick={() => onChange('')} />
      )}
    </>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  CardShell: ({
    children,
    ...rest
  }: { children: ReactNode } & Record<string, unknown>) => (
    <article {...rest}>{children}</article>
  ),
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialSpinner: () => <div role="progressbar" />,
  DialDropdown: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialIconButton: ({
    icon,
    ...rest
  }: { icon: ReactNode } & Record<string, unknown>) => (
    <button {...rest}>{icon}</button>
  ),
  DialEllipsisTooltip: ({
    text,
    className,
  }: {
    text: ReactNode;
    className?: string;
  }) => <span className={className}>{text}</span>,
  DialNoDataContent: ({ title, icon }: { title: string; icon?: ReactNode }) => (
    <div>
      {icon}
      <span>{title}</span>
    </div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowsSort: () => <svg />,
  IconCalendarTime: () => <svg />,
  IconCheck: () => <svg />,
  IconChevronUp: () => <svg />,
  IconChevronRight: () => <svg />,
  IconDotsVertical: () => <svg />,
  IconEdit: () => <svg />,
  IconFolder: () => <svg />,
  IconPlayerPlay: () => <svg />,
  IconPlus: () => <svg />,
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

const renderScheduledTasks = (overrides?: Partial<ScheduledTasksProps>) =>
  render(
    <ScheduledTasks
      labels={{
        title: 'Scheduled tasks',
        subtitle: 'Automate recurring tasks with scheduled runs.',
        createButtonLabel: 'New task',
        searchPlaceholder: 'Search scheduled tasks...',
        searchAriaLabel: 'Search scheduled tasks by name',
        clearSearchLabel: 'Clear scheduled tasks search',
        sortLabel: 'Sort',
        sortOptions: [
          { key: 'firstToRun', label: 'First to run' },
          { key: 'lastToRun', label: 'Last to run' },
        ],
        emptyStateLabel: 'No scheduled tasks yet',
        noResultsLabel: 'No results',
        errorLabel: 'Something went wrong',
        retryLabel: 'Retry',
        sharedSectionTitle: 'Shared',
      }}
      onCreateClick={vi.fn()}
      searchQuery=""
      onSearchQueryChange={vi.fn()}
      sortKey="firstToRun"
      onSortChange={vi.fn()}
      items={[]}
      {...overrides}
    />,
  );

describe('ScheduledTasks', () => {
  it('renders the header and toolbar from props', () => {
    renderScheduledTasks();

    expect(
      screen.getByRole('heading', { name: 'Scheduled tasks' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Automate recurring tasks with scheduled runs.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New task' })).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Search scheduled tasks...'),
    ).toBeTruthy();
    expect(
      screen.getByRole('textbox', {
        name: 'Search scheduled tasks by name',
      }),
    ).toBeTruthy();
  });

  it('passes the localized clear-search label to the search control', () => {
    renderScheduledTasks({ searchQuery: 'daily' });

    expect(
      screen.getByRole('button', {
        name: 'Clear scheduled tasks search',
      }),
    ).toBeTruthy();
  });

  it('shows a spinner and no other content when isLoading', () => {
    renderScheduledTasks({ isLoading: true, items: [buildItem()] });

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Competitor Updates')).toBeNull();
  });

  it('shows an error message and calls onRetry when the retry action is activated', async () => {
    const onRetry = vi.fn();
    renderScheduledTasks({ error: new Error('boom'), onRetry });

    expect(screen.getAllByText('Something went wrong').length).toBeGreaterThan(
      0,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the empty state when the source item list is empty', () => {
    renderScheduledTasks({ items: [] });

    expect(
      screen.getAllByText('No scheduled tasks yet').length,
    ).toBeGreaterThan(0);
  });

  it('renders the no-results state, not the empty state, when search filters everything out', () => {
    renderScheduledTasks({
      items: [buildItem({ displayName: 'Daily summary' })],
      searchQuery: 'nonexistent',
    });

    expect(screen.getAllByText('No results').length).toBeGreaterThan(0);
    expect(screen.queryByText('No scheduled tasks yet')).toBeNull();
  });

  it('renders cards for each matching item without a "My tasks" section heading', () => {
    renderScheduledTasks({
      items: [
        buildItem({ id: '1', displayName: 'Daily summary' }),
        buildItem({ id: '2', displayName: 'Weekly digest' }),
      ],
    });

    expect(screen.queryByRole('heading', { name: 'My tasks' })).toBeNull();
    expect(screen.getByText('Daily summary')).toBeTruthy();
    expect(screen.getByText('Weekly digest')).toBeTruthy();
  });

  it('renders a "Shared" section heading with a count badge for shared items', () => {
    renderScheduledTasks({
      items: [
        buildItem({
          id: '1',
          displayName: 'Daily summary',
          sectionKey: 'shared',
        }),
        buildItem({
          id: '2',
          displayName: 'Weekly digest',
          sectionKey: 'shared',
        }),
      ],
    });

    expect(screen.getByRole('heading', { name: 'Shared' })).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('sorts rendered cards by nameAZ', () => {
    renderScheduledTasks({
      items: [
        buildItem({ id: '1', displayName: 'Zeta' }),
        buildItem({ id: '2', displayName: 'Alpha' }),
      ],
      sortKey: 'nameAZ',
    });

    const titles = screen
      .getAllByText(/Zeta|Alpha/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Alpha', 'Zeta']);
  });

  it('calls onCreateClick when the create button is clicked', async () => {
    const onCreateClick = vi.fn();
    renderScheduledTasks({ onCreateClick });

    await userEvent.click(screen.getByRole('button', { name: 'New task' }));

    expect(onCreateClick).toHaveBeenCalledOnce();
  });

  it('calls onSearchQueryChange when typing in the search input', async () => {
    const onSearchQueryChange = vi.fn();
    renderScheduledTasks({ onSearchQueryChange });

    await userEvent.type(
      screen.getByPlaceholderText('Search scheduled tasks...'),
      'a',
    );

    expect(onSearchQueryChange).toHaveBeenCalledWith('a');
  });
});
