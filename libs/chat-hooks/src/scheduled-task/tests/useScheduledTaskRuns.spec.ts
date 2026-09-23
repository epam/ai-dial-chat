import type { ListScheduledTaskRunsResponseDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTasksApiClient } from '../scheduled-tasks-api-client';
import { useScheduledTaskRuns } from '../use-scheduled-task-runs';

describe('shared useScheduledTaskRuns', () => {
  it.each(['resolve', 'reject'] as const)(
    'ignores a stale initial request that completes with %s after the new task loads',
    async (completion) => {
      let resolveOld!: (page: ListScheduledTaskRunsResponseDto) => void;
      let rejectOld!: (error: Error) => void;
      const oldRequest = new Promise<ListScheduledTaskRunsResponseDto>(
        (resolve, reject) => {
          resolveOld = resolve;
          rejectOld = reject;
        },
      );
      const newPage = {
        items: [{ id: 'new-run' }],
        next: null,
      } as ListScheduledTaskRunsResponseDto;
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockReturnValueOnce(oldRequest)
        .mockResolvedValueOnce(newPage);
      const client: ScheduledTasksApiClient = {
        listScheduledTaskRuns,
        listScheduledTasks: vi.fn(),
        createScheduledTask: vi.fn(),
        getScheduledTask: vi.fn(),
        updateScheduledTask: vi.fn(),
        pauseScheduledTask: vi.fn(),
        resumeScheduledTask: vi.fn(),
        deleteScheduledTask: vi.fn(),
      };
      const { result, rerender } = renderHook(
        ({ scheduleId }) => useScheduledTaskRuns(client, { scheduleId }),
        { initialProps: { scheduleId: 'old' } },
      );
      expect(listScheduledTaskRuns).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleId: 'old' }),
      );
      const oldSignal = listScheduledTaskRuns.mock.calls[0][0].signal;
      rerender({ scheduleId: 'new' });
      await waitFor(() => expect(result.current.items).toEqual(newPage.items));
      expect(oldSignal?.aborted).toBe(true);

      await act(async () => {
        if (completion === 'resolve') {
          resolveOld({
            items: [{ id: 'old-run' }],
            next: 'old-next',
          } as ListScheduledTaskRunsResponseDto);
        } else {
          rejectOld(new Error('Old request failed'));
        }
        await oldRequest.catch(() => undefined);
      });

      expect(result.current.items).toEqual(newPage.items);
      expect(result.current.initialError).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(false);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    },
  );
});
