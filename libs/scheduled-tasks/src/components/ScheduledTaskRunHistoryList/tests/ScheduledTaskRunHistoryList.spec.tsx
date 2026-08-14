import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskRunHistoryListLabels } from '../../../models/scheduled-task-run-history-list-props';
import type { ScheduledTaskRunItem } from '../../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../../types/scheduled-task-run-status';
import { ScheduledTaskRunHistoryList } from '../ScheduledTaskRunHistoryList';

vi.mock('@epam/ai-dial-ui-kit', () => ({
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
      screen.getByRole('listitem').getAttribute('aria-current'),
    ).toBeNull();
  });

  it('rows are not clickable when onRunClick is not supplied', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        labels={labels}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(row.getAttribute('role')).toBeNull();
  });

  it('invokes onRunClick with the run id when a row is clicked and onRunClick is supplied', async () => {
    const onRunClick = vi.fn();
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        onRunClick={onRunClick}
        labels={labels}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Succeeded/ }));
    expect(onRunClick).toHaveBeenCalledWith('run_1');
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
    expect(container.querySelectorAll('li').length).toBeGreaterThan(1);
    expect(
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
