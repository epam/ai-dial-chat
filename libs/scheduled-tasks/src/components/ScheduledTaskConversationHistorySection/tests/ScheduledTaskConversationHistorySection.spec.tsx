import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskRunItem } from '../../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../../types/scheduled-task-run-status';
import { ScheduledTaskConversationHistorySection } from '../ScheduledTaskConversationHistorySection';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ButtonVariant: { Primary: 'primary' },
  Accordion: ({
    title,
    expanded,
    onToggle,
    contentClassName,
    children,
  }: {
    title: ReactNode;
    expanded?: boolean;
    onToggle?: (expanded: boolean) => void;
    contentClassName?: string;
    children?: ReactNode;
  }) => (
    <div>
      <button aria-expanded={expanded} onClick={() => onToggle?.(!expanded)}>
        {title}
      </button>
      <div className={contentClassName}>{children}</div>
    </div>
  ),
  GhostButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));

vi.mock(
  '../../ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList',
  () => ({
    ScheduledTaskRunHistoryList: ({
      items,
      footer,
    }: {
      items: ScheduledTaskRunItem[];
      footer?: ReactNode;
    }) => (
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.timestampLabel}</li>
        ))}
        {footer}
      </ul>
    ),
  }),
);

const runs: ScheduledTaskRunItem[] = [
  {
    id: 'run_1',
    status: ScheduledTaskRunStatus.Success,
    timestampLabel: 'today at 9:01 AM (99s)',
  },
];

const labels = {
  title: 'History',
  emptyLabel: 'No runs yet',
  errorLabel: 'Failed to load history',
  retryLabel: 'Retry',
  showMoreLabel: 'Show more',
  runStatusLabels: {
    [ScheduledTaskRunStatus.Success]: 'Succeeded',
    [ScheduledTaskRunStatus.Error]: 'Failed',
    [ScheduledTaskRunStatus.InProgress]: 'Running',
    [ScheduledTaskRunStatus.Missed]: 'Missed',
  },
  currentRunLabel: 'Current run',
  unreadIndicatorLabel: 'Unread',
};

describe('ScheduledTaskConversationHistorySection', () => {
  it('renders the History accordion expanded with its run rows by default', () => {
    render(
      <ScheduledTaskConversationHistorySection
        scheduleId="schedule-1"
        items={runs}
        labels={labels}
      />,
    );

    const historyButton = screen.getByRole('button', { name: 'History' });
    expect(historyButton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('today at 9:01 AM (99s)')).toBeTruthy();
  });

  it('resets to expanded when the schedule changes while collapsed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ScheduledTaskConversationHistorySection
        scheduleId="schedule-1"
        items={runs}
        labels={labels}
      />,
    );

    const historyButton = screen.getByRole('button', { name: 'History' });
    await user.click(historyButton);
    expect(historyButton.getAttribute('aria-expanded')).toBe('false');

    rerender(
      <ScheduledTaskConversationHistorySection
        scheduleId="schedule-2"
        items={runs}
        labels={labels}
      />,
    );
    expect(historyButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders the Show more footer wired to onLoadMore while another page is available', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ScheduledTaskConversationHistorySection
        scheduleId="schedule-1"
        items={runs}
        hasMore
        onLoadMore={onLoadMore}
        labels={labels}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender(
      <ScheduledTaskConversationHistorySection
        scheduleId="schedule-1"
        items={runs}
        hasMore
        isLoadingMore
        onLoadMore={onLoadMore}
        labels={labels}
      />,
    );
    expect(
      (screen.getByRole('button', { name: 'Show more' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('hides the Show more footer while the first page is loading', () => {
    render(
      <ScheduledTaskConversationHistorySection
        scheduleId="schedule-1"
        items={[]}
        isLoading
        hasMore
        onLoadMore={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});
