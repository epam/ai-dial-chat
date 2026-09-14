import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ScheduledTaskHistorySectionLabels,
  ScheduledTaskHistorySectionProps,
} from '../../../models/scheduled-task-history-section-props';
import type { ScheduledTaskRunItem } from '../../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../../types/scheduled-task-run-status';
import { ScheduledTaskHistorySectionVariant } from '../../../types/scheduled-task-history-section-variant';
import { ScheduledTaskHistorySection } from '../ScheduledTaskHistorySection';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
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

const labels: ScheduledTaskHistorySectionLabels = {
  historyTitle: 'History',
  historyEmptyLabel: 'No runs yet',
  historyErrorLabel: 'Failed to load history',
  historyRetryLabel: 'Retry',
  historyLoadingMoreLabel: 'Loading more…',
  historyShowMoreLabel: 'Show more',
  runStatusLabels: {
    [ScheduledTaskRunStatus.Success]: 'Succeeded',
    [ScheduledTaskRunStatus.Error]: 'Failed',
    [ScheduledTaskRunStatus.InProgress]: 'Running',
    [ScheduledTaskRunStatus.Missed]: 'Missed',
  },
};

const runs: ScheduledTaskRunItem[] = [
  {
    id: 'run_1',
    status: ScheduledTaskRunStatus.Success,
    timestampLabel: 'today at 9:01 AM (99s)',
  },
];

const renderSection = (props?: Partial<ScheduledTaskHistorySectionProps>) =>
  render(
    <ScheduledTaskHistorySection
      variant={ScheduledTaskHistorySectionVariant.Card}
      labels={labels}
      items={runs}
      hasMore
      onLoadMore={vi.fn()}
      {...props}
    />,
  );

describe('ScheduledTaskHistorySection', () => {
  describe('ScheduledTaskHistorySection — card variant', () => {
    it('renders the section title, next-run label, and run rows', () => {
      renderSection({ nextRunLabel: 'Next run: Jul 31 at 9:00 AM' });

      expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
      expect(screen.getByText('Next run: Jul 31 at 9:00 AM')).toBeTruthy();
      expect(screen.getByText('today at 9:01 AM (99s)')).toBeTruthy();
    });

    it('omits the next-run label when not supplied', () => {
      renderSection();

      expect(screen.queryByText('Next run: Jul 31 at 9:00 AM')).toBeNull();
    });
  });

  describe('ScheduledTaskHistorySection — flow variant', () => {
    it('renders the next-run label and run rows without a section title', () => {
      renderSection({
        variant: ScheduledTaskHistorySectionVariant.Flow,
        nextRunLabel: 'Next run: Jul 31 at 9:00 AM',
      });

      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.getByText('Next run: Jul 31 at 9:00 AM')).toBeTruthy();
      expect(screen.getByText('today at 9:01 AM (99s)')).toBeTruthy();
    });
  });

  it('renders the Show more button only while hasMore is true', () => {
    renderSection();

    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
  });

  it('hides the Show more button once all pages are loaded', () => {
    renderSection({ hasMore: false });

    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('disables the Show more button while a load-more fetch is in flight', () => {
    renderSection({ isLoadingMore: true });

    expect(screen.getByRole('button', { name: 'Show more' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('calls onLoadMore when the Show more button is activated', async () => {
    const onLoadMore = vi.fn();
    renderSection({ onLoadMore });

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
