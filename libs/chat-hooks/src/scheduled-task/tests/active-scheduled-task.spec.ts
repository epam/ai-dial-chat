import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveActiveScheduledTask } from '../active-scheduled-task';
import { useActiveScheduledTaskDetails } from '../useActiveScheduledTaskDetails';

const task = (id: string) => ({ id }) as ScheduledTaskDto;
describe('active scheduled task', () => {
  it('respects disabled, unresolved and complete metadata states', () => {
    const options = {
      routeConversationId: 'a',
      enabled: true,
      isLoading: true,
      items: [],
      matches: (a: string, b: string) => a === b,
    };
    expect(resolveActiveScheduledTask(options).status).toBe('resolving');
    expect(
      resolveActiveScheduledTask({ ...options, enabled: false }).status,
    ).toBe('not-a-task-conversation');
    expect(
      resolveActiveScheduledTask({ ...options, isLoading: false }).status,
    ).toBe('not-a-task-conversation');
    expect(
      resolveActiveScheduledTask({
        ...options,
        items: [
          { id: 'a', isScheduledTask: true, scheduleId: 's', runId: 'r' },
        ],
      }),
    ).toMatchObject({
      status: 'task-conversation',
      scheduleId: 's',
      runId: 'r',
    });
    expect(
      resolveActiveScheduledTask({
        ...options,
        items: [{ id: 'a', isScheduledTask: true }],
      }).status,
    ).toBe('not-a-task-conversation');
  });
  it.each([404, 500])(
    'classifies status %s and supports explicit retry',
    async (status) => {
      const getTask = vi
        .fn()
        .mockRejectedValueOnce({ response: { status, json: vi.fn() } })
        .mockResolvedValue(task('a'));
      const { result } = renderHook(() =>
        useActiveScheduledTaskDetails('a', getTask),
      );
      await waitFor(() =>
        expect(result.current.taskState).toBe(
          status === 404 ? 'unavailable' : 'error',
        ),
      );
      expect(result.current.taskError === null).toBe(status === 404);
      act(() => result.current.retryTask());
      await waitFor(() => expect(result.current.taskState).toBe('success'));
      expect(getTask).toHaveBeenCalledTimes(2);
    },
  );
  it('aborts superseded requests and ignores late results even without transport cancellation', async () => {
    let resolveFirst!: (task: ScheduledTaskDto) => void;
    const getTask = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ScheduledTaskDto>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(task('b'));
    const { result, rerender, unmount } = renderHook(
      ({ id }) => useActiveScheduledTaskDetails(id, getTask),
      { initialProps: { id: 'a' as string | undefined } },
    );
    const firstSignal = getTask.mock.calls[0][1] as AbortSignal;
    rerender({ id: 'b' });
    expect(firstSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.task?.id).toBe('b'));
    await act(async () => resolveFirst(task('a')));
    expect(result.current.task?.id).toBe('b');
    rerender({ id: 'b' });
    expect(getTask).toHaveBeenCalledTimes(2);
    rerender({ id: undefined });
    expect(result.current.taskState).toBe('idle');
    expect(result.current.task).toBeNull();
    unmount();
  });
  it('aborts on unmount without committing late completion', async () => {
    let resolve!: (task: ScheduledTaskDto) => void;
    const getTask = vi.fn(
      (_id: string, _signal: AbortSignal) =>
        new Promise<ScheduledTaskDto>((done) => {
          resolve = done;
        }),
    );
    const { unmount } = renderHook(() =>
      useActiveScheduledTaskDetails('a', getTask),
    );
    unmount();
    expect(getTask.mock.calls[0][1].aborted).toBe(true);
    await act(async () => resolve(task('a')));
  });
});
