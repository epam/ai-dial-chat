import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  describeScheduledTaskTrigger,
  ScheduledTaskTriggerDescriptionKind,
} from '../scheduled-task-description';
import { useScheduledTaskRuns } from '../use-scheduled-task-runs';
import { useScheduledTasks } from '../use-scheduled-tasks';

const deferred = () => {
  let resolve!: (value: {
    items: { id: string }[];
    next: string | null;
  }) => void;
  const promise = new Promise<{ items: { id: string }[]; next: string | null }>(
    (done) => {
      resolve = done;
    },
  );
  return { promise, resolve };
};

describe('request lifecycle and full trigger regressions', () => {
  it('aborts pagination on unmount and ignores late transport completion', async () => {
    const pending = deferred();
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], next: 'next' })
      .mockReturnValueOnce(pending.promise);
    const client = { listScheduledTasks: list };
    const { result, unmount } = renderHook(() =>
      useScheduledTasks(client as never),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    const signal = list.mock.calls[1][0].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () =>
      pending.resolve({ items: [{ id: 'late' }], next: null }),
    );
  });

  it('retries the failed history offset and appends each id once', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], next: 'next' })
      .mockRejectedValueOnce(new Error('failed page'))
      .mockResolvedValueOnce({
        items: [{ id: 'a' }, { id: 'b' }, { id: 'b' }],
        next: null,
        count: 4,
      });
    const client = { listScheduledTaskRuns: list };
    const { result } = renderHook(() =>
      useScheduledTaskRuns(client as never, { scheduleId: 'task' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadMoreError).not.toBeNull());
    expect(result.current.items.map((item) => item.id)).toEqual(['a']);
    act(() => result.current.retryLoadMore());
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
    expect(list.mock.calls[1][0].offset).toBe(1);
    expect(list.mock.calls[2][0].offset).toBe(1);
    expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.current.loadMoreError).toBeNull();
  });

  it('resets list pagination state after a query change', async () => {
    const oldMore = deferred();
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], next: 'next' })
      .mockReturnValueOnce(oldMore.promise)
      .mockResolvedValueOnce({ items: [{ id: 'b' }], next: 'next' });
    const client = { listScheduledTasks: list };
    const { result } = renderHook(() => useScheduledTasks(client as never));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    act(() => result.current.setSortKey('newest' as never));
    await waitFor(() => expect(result.current.items[0]?.id).toBe('b'));
    expect(result.current.isLoadingMore).toBe(false);
    act(() => result.current.loadMore());
    expect(list).toHaveBeenCalledTimes(4);
  });

  it('old history completion does not release the current request guard', async () => {
    const oldMore = deferred();
    const newMore = deferred();
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], next: 'next' })
      .mockReturnValueOnce(oldMore.promise)
      .mockResolvedValueOnce({ items: [{ id: 'b' }], next: 'next' })
      .mockReturnValue(newMore.promise);
    const client = { listScheduledTaskRuns: list };
    const { result, rerender } = renderHook(
      ({ id }) => useScheduledTaskRuns(client as never, { scheduleId: id }),
      { initialProps: { id: 'A' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    rerender({ id: 'B' });
    await waitFor(() => expect(result.current.items[0]?.id).toBe('b'));
    act(() => result.current.loadMore());
    await act(async () =>
      oldMore.resolve({ items: [{ id: 'old' }], next: null }),
    );
    act(() => result.current.loadMore());
    expect(list).toHaveBeenCalledTimes(4);
  });

  it.each<Record<string, string>>([
    { hour: '9', minute: '0', month: '1' },
    { hour: '*', minute: '0', day_of_week: '0' },
    { hour: '9', minute: '0', day_of_week: 'mon-fri' },
  ])(
    'preserves constrained cron as custom instead of losing fields: %j',
    (fields) => {
      const result = describeScheduledTaskTrigger({ cron: { fields } });
      expect(result.kind).toBe(ScheduledTaskTriggerDescriptionKind.Custom);
      expect(result.expression).toBeDefined();
    },
  );
});
