import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskRunHistoryListLabels } from '../../../models/scheduled-task-run-history-list-props';
import type { ScheduledTaskRunItem } from '../../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../../types/scheduled-task-run-status';
import { ScheduledTaskRunHistoryList } from '../ScheduledTaskRunHistoryList';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Spinner: () => <div role="progressbar" />,
  Skeleton: (props: Record<string, unknown>) => (
    <div data-skeleton {...props} />
  ),
  SkeletonVariant: { Default: 'default', Rectangular: 'rectangular' },
  GhostButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconCircleCheck: () => <svg data-icon="success" />,
  IconCircleX: () => <svg data-icon="error" />,
  IconAlertTriangle: () => <svg data-icon="missed" />,
  IconClipboardX: () => <svg data-icon="empty" />,
}));

const labels: ScheduledTaskRunHistoryListLabels = {
  historyTitle: 'History',
  emptyLabel: 'No runs yet',
  errorLabel: 'Failed to load history',
  retryLabel: 'Retry',
  runStatusLabels: {
    [ScheduledTaskRunStatus.Success]: 'Succeeded',
    [ScheduledTaskRunStatus.Error]: 'Failed',
    [ScheduledTaskRunStatus.InProgress]: 'Running',
    [ScheduledTaskRunStatus.Missed]: 'Missed',
  },
  currentRunLabel: 'Current run',
};

const buildRun = (
  overrides?: Partial<ScheduledTaskRunItem>,
): ScheduledTaskRunItem => ({
  id: 'run_1',
  status: ScheduledTaskRunStatus.Success,
  timestampLabel: 'today at 9:01 AM (99s)',
  ...overrides,
});

describe('ScheduledTaskRunHistoryList', () => {
  it('renders a row per item with its timestamp and status icon', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[
          buildRun({ id: 'run_1' }),
          buildRun({
            id: 'run_2',
            status: ScheduledTaskRunStatus.Error,
            timestampLabel: 'Jul 10 at 9:46 AM (154s)',
          }),
        ]}
        labels={labels}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('today at 9:01 AM (99s)')).toBeTruthy();
    expect(screen.getByText('Jul 10 at 9:46 AM (154s)')).toBeTruthy();
  });

  it('shows skeleton rows during initial loading', () => {
    const { container } = render(
      <ScheduledTaskRunHistoryList items={[]} isLoading labels={labels} />,
    );

    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- skeleton rows are plain divs with no accessible role/text; only their data-skeleton CSS hook distinguishes them
      container.querySelectorAll('[data-skeleton]').length,
    ).toBeGreaterThan(0);
  });

  it('shows the empty label when there are no runs and loading has finished', () => {
    render(<ScheduledTaskRunHistoryList items={[]} labels={labels} />);

    expect(screen.getByText('No runs yet')).toBeTruthy();
  });

  it('shows a scoped error message with a retry action', async () => {
    const onRetry = vi.fn();
    render(
      <ScheduledTaskRunHistoryList
        items={[]}
        error={new Error('failed')}
        onRetry={onRetry}
        labels={labels}
      />,
    );

    expect(screen.getByText('Failed to load history')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('marks the row matching currentRunId as current, visually and accessibly', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' }), buildRun({ id: 'run_2' })]}
        currentRunId="run_1"
        labels={labels}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows[0].getAttribute('aria-current')).toBe('true');
    expect(rows[0].getAttribute('aria-label')).toContain('Current run');
    expect(rows[1].getAttribute('aria-current')).toBeNull();
  });

  it('does not mark any row as current when currentRunId is not among the loaded items', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        currentRunId="run_99"
        labels={labels}
      />,
    );

    expect(
      screen.queryByRole('listitem')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('rows are not clickable when onRunClick is not supplied, even with a conversationId', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', conversationId: 'conversations/c1' })]}
        labels={labels}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(row.getAttribute('role')).toBeNull();
  });

  it('invokes onRunClick with the run when a row with a conversationId is clicked', async () => {
    const onRunClick = vi.fn();
    const run = buildRun({ id: 'run_1', conversationId: 'conversations/c1' });
    render(
      <ScheduledTaskRunHistoryList
        items={[run]}
        onRunClick={onRunClick}
        labels={labels}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Succeeded/ }));
    expect(onRunClick).toHaveBeenCalledWith(run);
  });

  it('invokes onRunClick when a row is activated via keyboard', async () => {
    const onRunClick = vi.fn();
    const run = buildRun({ id: 'run_1', conversationId: 'conversations/c1' });
    render(
      <ScheduledTaskRunHistoryList
        items={[run]}
        onRunClick={onRunClick}
        labels={labels}
      />,
    );

    screen.getByRole('button', { name: /Succeeded/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onRunClick).toHaveBeenCalledWith(run);
  });

  it('does not render as clickable, and never invokes onRunClick, when the run has no conversationId', async () => {
    const onRunClick = vi.fn();
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        onRunClick={onRunClick}
        labels={labels}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(row.getAttribute('role')).toBeNull();
    expect(row.className).not.toContain('cursor-pointer');

    await userEvent.click(row);
    expect(onRunClick).not.toHaveBeenCalled();
  });

  it('folds the unread label into the row accessible name when isUnread is true', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: true })]}
        labels={labels}
      />,
    );

    expect(screen.getByRole('listitem', { name: /Unread$/ })).toBeTruthy();
  });

  it('uses a custom unreadIndicatorLabel when provided', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: true })]}
        labels={{ ...labels, unreadIndicatorLabel: 'New task' }}
      />,
    );

    expect(screen.getByRole('listitem', { name: /New task$/ })).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: /Unread$/ })).toBeNull();
  });

  it('does not append an unread suffix when isUnread is false or omitted', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: false })]}
        labels={labels}
      />,
    );

    expect(
      screen.getByRole('listitem', {
        name: 'Succeeded today at 9:01 AM (99s)',
      }),
    ).toBeTruthy();
  });

  it('renders the supplied footer after the rows', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        labels={labels}
        footer={<li data-testid-footer="show-more">Show more</li>}
      />,
    );

    expect(screen.getByText('Show more')).toBeTruthy();
  });

  it('appends loading-more skeletons below the loaded rows', () => {
    const { container } = render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        isLoadingMore
        labels={labels}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(
      screen.getAllByRole('listitem', { hidden: true }).length,
    ).toBeGreaterThan(1);
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- skeleton rows are plain divs with no accessible role/text; only their data-skeleton CSS hook distinguishes them
      container.querySelectorAll('[data-skeleton]').length,
    ).toBeGreaterThan(0);
  });

  it('keeps already-loaded rows visible and shows an inline retry notice when a loadMore fails', async () => {
    const onRetry = vi.fn();
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        error={new Error('failed')}
        onRetry={onRetry}
        labels={labels}
        footer={<li>Show more</li>}
      />,
    );

    expect(screen.getByText('today at 9:01 AM (99s)')).toBeTruthy();
    expect(screen.getByText('Failed to load history')).toBeTruthy();
    expect(screen.queryByText('Show more')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
