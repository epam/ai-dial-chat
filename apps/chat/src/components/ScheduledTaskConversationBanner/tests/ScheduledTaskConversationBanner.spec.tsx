import type { ScheduledTaskRunDto } from '@epam/chat-api-client';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduledTaskConversationBanner from '../ScheduledTaskConversationBanner';

const renderBanner = () =>
  render(
    <MemoryRouter>
      <ScheduledTaskConversationBanner />
    </MemoryRouter>,
  );

const contextMocks = vi.hoisted(() => ({
  status: 'task-conversation' as
    | 'resolving'
    | 'not-a-task-conversation'
    | 'task-conversation',
  scheduleId: 'schedule-1' as string | undefined,
  runId: 'run-1' as string | undefined,
  conversationUpdatedAt: undefined as number | undefined,
  taskState: 'success' as
    | 'idle'
    | 'loading'
    | 'error'
    | 'unavailable'
    | 'success',
  task: { id: 'schedule-1', displayName: 'Weekly digest' } as {
    displayName: string;
  } | null,
  retryTask: vi.fn(),
  historyItems: [] as ScheduledTaskRunDto[],
}));

vi.mock('../../../context/ActiveScheduledTaskContext', () => ({
  useActiveScheduledTask: () => ({
    status: contextMocks.status,
    scheduleId: contextMocks.scheduleId,
    runId: contextMocks.runId,
    conversationUpdatedAt: contextMocks.conversationUpdatedAt,
    taskState: contextMocks.taskState,
    task: contextMocks.task,
    retryTask: contextMocks.retryTask,
    history: { items: contextMocks.historyItems },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  contextMocks.status = 'task-conversation';
  contextMocks.scheduleId = 'schedule-1';
  contextMocks.runId = 'run-1';
  contextMocks.conversationUpdatedAt = undefined;
  contextMocks.taskState = 'success';
  contextMocks.task = { id: 'schedule-1', displayName: 'Weekly digest' } as {
    displayName: string;
  };
  contextMocks.historyItems = [];
});

describe('ScheduledTaskConversationBanner', () => {
  it('shows only the task name when neither the matching run nor the conversation timestamp is available', () => {
    renderBanner();

    expect(screen.getByText('Weekly digest')).toBeTruthy();
    expect(
      screen.queryByText('scheduledTasks.detail.historyTodayAt'),
    ).toBeNull();
  });

  it('falls back to the conversation updatedAt timestamp before the matching run has loaded', () => {
    contextMocks.conversationUpdatedAt = Date.now();

    renderBanner();

    expect(screen.getByText('Weekly digest')).toBeTruthy();
    expect(
      screen.getByText('scheduledTasks.detail.historyTodayAt'),
    ).toBeTruthy();
  });

  it('prefers the matching run timestamp over the conversation updatedAt fallback once loaded', () => {
    contextMocks.conversationUpdatedAt = Date.now() - 60 * 60 * 1000;
    contextMocks.historyItems = [
      {
        id: 'run-1',
        status: 'Success',
        startTime: new Date().toISOString(),
        durationSeconds: 99,
      } as ScheduledTaskRunDto,
    ];

    const { container } = renderBanner();

    expect(screen.getByText('Weekly digest')).toBeTruthy();
    expect(container.querySelector('span')?.textContent).toContain(
      'scheduledTasks.detail.historyDurationSuffix',
    );
  });

  it('shows a loading placeholder and no task name while loading', () => {
    contextMocks.taskState = 'loading';
    contextMocks.task = null;

    renderBanner();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('Weekly digest')).toBeNull();
  });

  it('shows a retry action on error without hiding via an app-wide error state', () => {
    contextMocks.taskState = 'error';
    contextMocks.task = null;

    renderBanner();

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('renders the Task details link targeting the task detail route', () => {
    renderBanner();

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/scheduled-tasks/schedule-1');
    expect(link.getAttribute('aria-label')).toBe(
      'scheduledTasks.conversationBanner.taskDetailsAriaLabel',
    );
  });

  it('renders nothing for a non-task conversation', () => {
    contextMocks.status = 'not-a-task-conversation';
    contextMocks.scheduleId = undefined;

    const { container } = renderBanner();

    expect(container.firstChild).toBeNull();
  });
});
