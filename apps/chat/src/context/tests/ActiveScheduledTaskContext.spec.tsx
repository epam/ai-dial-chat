import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as scheduledTasksApi from '../../server-api/scheduled-tasks.api';
import {
  ActiveScheduledTaskProvider,
  useActiveScheduledTask,
} from '../ActiveScheduledTaskContext';

const contextMocks = vi.hoisted(() => ({
  pathname: '/conversations/conv1',
  isFeatureEnabled: true,
  conversations: [] as ConversationListItemDto[],
  isConversationsLoading: false,
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: contextMocks.pathname }),
}));

vi.mock('../AppConfigContext', () => ({
  useFeatureFlag: () => contextMocks.isFeatureEnabled,
}));

vi.mock('../ConversationsContext', () => ({
  useConversations: () => ({
    conversations: contextMocks.conversations,
    isLoading: contextMocks.isConversationsLoading,
  }),
}));

vi.mock('../../server-api/scheduled-tasks.api');

const mockGetScheduledTask = vi.mocked(scheduledTasksApi.getScheduledTask);

const taskConversation = (
  overrides: Partial<ConversationListItemDto> = {},
): ConversationListItemDto => ({
  id: 'conv1',
  title: 'Weekly digest',
  isPinned: false,
  updatedAt: 0,
  sharedWithMe: false,
  publishedWithMe: false,
  isReadonly: false,
  isScheduledTask: true,
  scheduleId: 'schedule-1',
  runId: 'run-1',
  ...overrides,
});

const scheduledTask = { id: 'schedule-1', displayName: 'Weekly digest' };

beforeEach(() => {
  vi.clearAllMocks();
  contextMocks.pathname = '/conversations/conv1';
  contextMocks.isFeatureEnabled = true;
  contextMocks.conversations = [];
  contextMocks.isConversationsLoading = false;
  mockGetScheduledTask.mockResolvedValue(
    scheduledTask as Awaited<
      ReturnType<typeof scheduledTasksApi.getScheduledTask>
    >,
  );
});

const renderActiveScheduledTask = () =>
  renderHook(() => useActiveScheduledTask(), {
    wrapper: ActiveScheduledTaskProvider,
  });

describe('ActiveScheduledTaskContext', () => {
  it('matches the active conversation via conversationIdsMatch, tolerating encoding differences', async () => {
    contextMocks.pathname = '/conversations/conv%31';
    contextMocks.conversations = [taskConversation()];

    const { result } = renderActiveScheduledTask();

    await waitFor(() =>
      expect(result.current.status).toBe('task-conversation'),
    );
    expect(result.current.scheduleId).toBe('schedule-1');
    expect(result.current.runId).toBe('run-1');
  });

  it('stays resolving while the conversation list is still loading and no match is found yet', () => {
    contextMocks.conversations = [];
    contextMocks.isConversationsLoading = true;

    const { result } = renderActiveScheduledTask();

    expect(result.current.status).toBe('resolving');
    expect(mockGetScheduledTask).not.toHaveBeenCalled();
  });

  it('treats a non-scheduled-task conversation as not-a-task-conversation', async () => {
    contextMocks.conversations = [
      taskConversation({
        isScheduledTask: false,
        scheduleId: undefined,
        runId: undefined,
      }),
    ];

    const { result } = renderActiveScheduledTask();

    await waitFor(() =>
      expect(result.current.status).toBe('not-a-task-conversation'),
    );
    expect(mockGetScheduledTask).not.toHaveBeenCalled();
  });

  it.each(['/conversations/..', '/conversations/.', '/conversations/a/../b'])(
    'treats a path-traversal-shaped route (%s) as not-a-task-conversation without matching any conversation',
    async (pathname) => {
      contextMocks.pathname = pathname;
      contextMocks.conversations = [taskConversation()];

      const { result } = renderActiveScheduledTask();

      await waitFor(() =>
        expect(result.current.status).toBe('not-a-task-conversation'),
      );
      expect(mockGetScheduledTask).not.toHaveBeenCalled();
    },
  );

  it('makes no scheduled-task requests when the feature flag is disabled', async () => {
    contextMocks.isFeatureEnabled = false;
    contextMocks.conversations = [taskConversation()];

    const { result } = renderActiveScheduledTask();

    await waitFor(() =>
      expect(result.current.status).toBe('not-a-task-conversation'),
    );
    expect(mockGetScheduledTask).not.toHaveBeenCalled();
  });

  it('starts the task-detail fetch and the run-history hook concurrently once resolved', async () => {
    contextMocks.conversations = [taskConversation()];

    const { result } = renderActiveScheduledTask();

    await waitFor(() => expect(result.current.taskState).toBe('success'));
    expect(mockGetScheduledTask).toHaveBeenCalledOnce();
    expect(mockGetScheduledTask).toHaveBeenCalledWith('schedule-1');
    expect(result.current.task).toEqual(scheduledTask);
    expect(result.current.history).toBeDefined();
  });

  it('ignores a stale response after switching to a different scheduleId', async () => {
    contextMocks.conversations = [taskConversation()];
    let resolveFirst: ((value: typeof scheduledTask) => void) | undefined;
    const firstPromise = new Promise<typeof scheduledTask>((resolve) => {
      resolveFirst = resolve;
    });
    mockGetScheduledTask.mockReturnValueOnce(
      firstPromise as ReturnType<typeof scheduledTasksApi.getScheduledTask>,
    );

    const { result, rerender } = renderActiveScheduledTask();
    expect(result.current.taskState).toBe('loading');

    contextMocks.conversations = [
      taskConversation({
        id: 'conv2',
        scheduleId: 'schedule-2',
        runId: 'run-2',
      }),
    ];
    contextMocks.pathname = '/conversations/conv2';
    const secondTask = { id: 'schedule-2', displayName: 'Other task' };
    mockGetScheduledTask.mockResolvedValueOnce(
      secondTask as Awaited<
        ReturnType<typeof scheduledTasksApi.getScheduledTask>
      >,
    );
    rerender();

    await waitFor(() => expect(result.current.taskState).toBe('success'));
    expect(result.current.task).toEqual(secondTask);

    resolveFirst?.(scheduledTask);
    await Promise.resolve();
    expect(result.current.task).toEqual(secondTask);
  });

  it('does not refetch task details when only runId changes for the same scheduleId', async () => {
    contextMocks.conversations = [taskConversation()];
    const { result, rerender } = renderActiveScheduledTask();

    await waitFor(() => expect(result.current.taskState).toBe('success'));
    expect(mockGetScheduledTask).toHaveBeenCalledOnce();

    contextMocks.conversations = [taskConversation({ runId: 'run-2' })];
    rerender();

    await waitFor(() => expect(result.current.runId).toBe('run-2'));
    expect(mockGetScheduledTask).toHaveBeenCalledOnce();
  });

  it('maps a 404 task-detail response to the unavailable state, distinct from a generic error', async () => {
    contextMocks.conversations = [taskConversation()];
    mockGetScheduledTask.mockReset();
    mockGetScheduledTask.mockRejectedValueOnce({
      response: { status: 404, json: vi.fn() },
    });

    const { result } = renderActiveScheduledTask();

    await waitFor(() => expect(result.current.taskState).toBe('unavailable'));
    expect(result.current.taskError).toBeNull();
  });

  it('maps non-404 failures (e.g. 429/502) to the generic error state without special handling', async () => {
    contextMocks.conversations = [taskConversation()];
    mockGetScheduledTask.mockReset();
    mockGetScheduledTask.mockRejectedValueOnce({
      response: { status: 429, json: vi.fn() },
    });

    const { result } = renderActiveScheduledTask();

    await waitFor(() => expect(result.current.taskState).toBe('error'));
    expect(result.current.taskError).toBeInstanceOf(Error);
  });

  it('retryTask only re-triggers the task-detail fetch, not the run-history fetch', async () => {
    contextMocks.conversations = [taskConversation()];
    mockGetScheduledTask.mockReset();
    mockGetScheduledTask.mockRejectedValueOnce({
      response: { status: 500, json: vi.fn() },
    });

    const { result } = renderActiveScheduledTask();
    await waitFor(() => expect(result.current.taskState).toBe('error'));

    mockGetScheduledTask.mockResolvedValueOnce(
      scheduledTask as Awaited<
        ReturnType<typeof scheduledTasksApi.getScheduledTask>
      >,
    );
    act(() => {
      result.current.retryTask();
    });

    await waitFor(() => expect(result.current.taskState).toBe('success'));
    expect(mockGetScheduledTask).toHaveBeenCalledTimes(2);
  });
});
