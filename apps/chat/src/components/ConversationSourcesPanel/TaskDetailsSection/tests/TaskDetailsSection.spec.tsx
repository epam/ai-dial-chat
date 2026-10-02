import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveScheduledTaskDetailState } from '../../../../types/active-scheduled-task';
import TaskDetailsSection from '../TaskDetailsSection';

let mockSidebarConversationModelId: string | undefined;
vi.mock('../../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebarData: () => ({
    messages: [],
    conversationModelId: mockSidebarConversationModelId,
  }),
}));

vi.mock('../../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: [
      { id: 'gpt-5', displayName: 'GPT-5' },
      { id: 'gpt-4o', displayName: 'GPT-4o' },
    ],
  }),
}));

vi.mock('../../../../hooks/language/useLanguage', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../../hooks/language/useLanguage')
    >();
  return {
    ...actual,
    useLanguage: () => ({ language: 'en' }),
  };
});

const mockSkillDisplayNames = vi.hoisted(() => ({
  value: undefined as string[] | undefined,
}));
vi.mock(
  '../../../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames',
  () => ({
    useScheduledTaskSkillDisplayNames: () => mockSkillDisplayNames.value,
  }),
);

const makeTask = (): ScheduledTaskDto =>
  ({
    id: 'schedule-1',
    displayName: 'Weekly digest',
    model: 'gpt-5',
    prompt: 'Do the thing',
  }) as ScheduledTaskDto;

const renderSection = (
  scheduleId = 'schedule-1',
  taskState: ActiveScheduledTaskDetailState = ActiveScheduledTaskDetailState.Success,
) =>
  render(
    <TaskDetailsSection
      task={makeTask()}
      taskState={taskState}
      onRetry={vi.fn()}
      scheduleId={scheduleId}
    />,
  );

describe('TaskDetailsSection', () => {
  it('renders the Details accordion collapsed by default', () => {
    renderSection();

    const detailsButton = screen.getByRole('button', {
      name: 'scheduledTasks.create.detailsSectionTitle',
    });
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the run deployment and instructions once expanded', async () => {
    mockSidebarConversationModelId = 'gpt-4o';
    renderSection();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.create.detailsSectionTitle',
      }),
    );

    expect(screen.getByText('GPT-4o')).toBeTruthy();
    expect(screen.getByText('Do the thing')).toBeTruthy();
    mockSidebarConversationModelId = undefined;
  });

  it('resets to collapsed when the schedule changes while expanded', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSection('schedule-1');

    const detailsButton = screen.getByRole('button', {
      name: 'scheduledTasks.create.detailsSectionTitle',
    });
    await user.click(detailsButton);
    expect(detailsButton.getAttribute('aria-expanded')).toBe('true');

    rerender(
      <TaskDetailsSection
        task={makeTask()}
        taskState={ActiveScheduledTaskDetailState.Success}
        onRetry={vi.fn()}
        scheduleId="schedule-2"
      />,
    );
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the scoped unavailable state with retry wired to onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskDetailsSection
        task={null}
        taskState={ActiveScheduledTaskDetailState.Error}
        onRetry={onRetry}
        scheduleId="schedule-1"
      />,
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.create.detailsSectionTitle',
      }),
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'scheduledTasks.list.retryLabel' }),
    );
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
