import type { ScheduledTaskRunDto } from '@epam/ai-dial-chat-api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { UseScheduledTaskRunsResult } from '../../../../hooks/scheduled-tasks/useScheduledTaskRuns';
import TaskHistorySection from '../TaskHistorySection';

const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockConversations: { id: string; isUnread?: boolean }[] = [];
vi.mock('../../../../context/ConversationsContext', () => ({
  useConversations: () => ({ conversations: mockConversations }),
}));

const makeHistory = (
  items: ScheduledTaskRunDto[] = [],
): UseScheduledTaskRunsResult =>
  ({
    items,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
  }) as unknown as UseScheduledTaskRunsResult;

const renderSection = (
  scheduleId = 'schedule-1',
  items: ScheduledTaskRunDto[] = [],
) =>
  render(
    <TaskHistorySection
      history={makeHistory(items)}
      currentRunId="run-1"
      scheduleId={scheduleId}
    />,
  );

describe('TaskHistorySection', () => {
  it('renders the History accordion expanded with its run rows by default', () => {
    renderSection('schedule-1', [
      { id: 'run-1', status: 'Success', startTime: new Date().toISOString() },
    ]);

    const historyButton = screen.getByRole('button', {
      name: 'scheduledTasks.detail.historyTitle',
    });
    expect(historyButton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listitem')).toBeTruthy();
  });

  it('resets to expanded when the schedule changes while collapsed', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSection('schedule-1');

    const historyButton = screen.getByRole('button', {
      name: 'scheduledTasks.detail.historyTitle',
    });
    await user.click(historyButton);
    expect(historyButton.getAttribute('aria-expanded')).toBe('false');

    rerender(
      <TaskHistorySection
        history={makeHistory()}
        currentRunId="run-1"
        scheduleId="schedule-2"
      />,
    );
    expect(historyButton.getAttribute('aria-expanded')).toBe('true');
  });
});
