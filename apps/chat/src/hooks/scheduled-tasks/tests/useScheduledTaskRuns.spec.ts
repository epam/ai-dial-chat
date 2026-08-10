/* eslint-disable @typescript-eslint/no-empty-function */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listScheduledTaskRuns } from '../../../server-api/scheduled-tasks.api';
import { useScheduledTaskRuns } from '../useScheduledTaskRuns';

vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  listScheduledTaskRuns: vi.fn(),
}));

describe('useScheduledTaskRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches page 0 on mount', async () => {
    vi.mocked(listScheduledTaskRuns).mockResolvedValue({
      items: [
        { id: 'r1', status: 'Success', startTime: '2026-07-24T09:00:00.000Z' },
      ],
      next: null,
    });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTaskRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: 'sched_123',
        limit: 20,
        offset: 0,
      }),
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  it('does not fetch while disabled and starts fetching when enabled', async () => {
    vi.mocked(listScheduledTaskRuns).mockResolvedValue({
      items: [],
      next: null,
    });

    const { result, rerender } = renderHook(
      ({ enabled }) => useScheduledTaskRuns('sched_123', enabled),
      { initialProps: { enabled: false } },
    );

    expect(result.current.isLoading).toBe(false);
    expect(listScheduledTaskRuns).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listScheduledTaskRuns).toHaveBeenCalledOnce();
  });

  it('sets error and does not throw when the fetch rejects', async () => {
    vi.mocked(listScheduledTaskRuns).mockRejectedValue(
      new Error('network down'),
    );

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.message).toBe('network down');
    expect(result.current.items).toEqual([]);
  });

  it('does not warn about updating state after unmount when the fetch resolves late', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    let resolveFetch: (value: {
      items: never[];
      next: null;
    }) => void = () => {};
    vi.mocked(listScheduledTaskRuns).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { unmount } = renderHook(() => useScheduledTaskRuns('sched_123'));
    unmount();

    await act(async () => {
      resolveFetch({ items: [], next: null });
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('refetches page 0 when refetch is called', async () => {
    vi.mocked(listScheduledTaskRuns).mockResolvedValue({
      items: [],
      next: null,
    });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
  });

  it('refetches when scheduleId changes', async () => {
    vi.mocked(listScheduledTaskRuns).mockResolvedValue({
      items: [],
      next: null,
    });

    const { result, rerender } = renderHook(
      ({ scheduleId }) => useScheduledTaskRuns(scheduleId),
      { initialProps: { scheduleId: 'sched_123' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ scheduleId: 'sched_456' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    expect(listScheduledTaskRuns).toHaveBeenLastCalledWith(
      expect.objectContaining({ scheduleId: 'sched_456' }),
    );
  });

  it('loadMore appends the next page and derives hasMore from next', async () => {
    vi.mocked(listScheduledTaskRuns)
      .mockResolvedValueOnce({
        items: [{ id: 'r1', status: 'Success', startTime: 't1' }],
        next: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'r2', status: 'Success', startTime: 't2' }],
        next: null,
      });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['r1', 'r2']);
    expect(result.current.hasMore).toBe(false);
    expect(listScheduledTaskRuns).toHaveBeenLastCalledWith(
      expect.objectContaining({ scheduleId: 'sched_123', offset: 1 }),
    );
  });

  it('derives hasMore from count when next is absent', async () => {
    vi.mocked(listScheduledTaskRuns).mockResolvedValue({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`,
        status: 'Success',
        startTime: 't',
      })),
      count: 42,
    });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasMore).toBe(true);
  });

  it('falls back to a full-page heuristic for hasMore when both count and next are absent', async () => {
    vi.mocked(listScheduledTaskRuns).mockResolvedValue({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`,
        status: 'Success',
        startTime: 't',
      })),
    });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasMore).toBe(true);
  });

  it('the full-page fallback stops once a short page is returned, even without count/next', async () => {
    vi.mocked(listScheduledTaskRuns)
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, i) => ({
          id: `r${i}`,
          status: 'Success',
          startTime: 't',
        })),
      })
      .mockResolvedValueOnce({
        items: [{ id: 'r20', status: 'Success', startTime: 't' }],
      });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.items).toHaveLength(21);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore deduplicates items by id', async () => {
    vi.mocked(listScheduledTaskRuns)
      .mockResolvedValueOnce({
        items: [{ id: 'r1', status: 'Success', startTime: 't1' }],
        next: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'r1', status: 'Success', startTime: 't1' }],
        next: null,
      });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.items).toHaveLength(1);
  });

  it('loadMore is a no-op when hasMore is false', async () => {
    vi.mocked(listScheduledTaskRuns).mockResolvedValue({
      items: [],
      next: null,
    });

    const { result } = renderHook(() => useScheduledTaskRuns('sched_123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(listScheduledTaskRuns).mockClear();

    act(() => {
      result.current.loadMore();
    });

    expect(listScheduledTaskRuns).not.toHaveBeenCalled();
  });

  it('discards a stale loadMore result that resolves after scheduleId has already changed', async () => {
    let resolveFirstLoadMore: (
      value: Awaited<ReturnType<typeof listScheduledTaskRuns>>,
    ) => void = () => {};

    vi.mocked(listScheduledTaskRuns)
      .mockResolvedValueOnce({
        items: [{ id: 'a1', status: 'Success', startTime: 't1' }],
        next: 'cursor-1',
      }) // sched_a initial load
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstLoadMore = resolve;
        }),
      ) // sched_a loadMore — stays pending
      .mockResolvedValueOnce({
        items: [{ id: 'b1', status: 'Success', startTime: 't2' }],
        next: null,
      }); // sched_b initial load

    const { result, rerender } = renderHook(
      ({ scheduleId }) => useScheduledTaskRuns(scheduleId),
      { initialProps: { scheduleId: 'sched_a' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));

    rerender({ scheduleId: 'sched_b' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(['b1']);

    await act(async () => {
      resolveFirstLoadMore({
        items: [{ id: 'a2', status: 'Success', startTime: 't1b' }],
        next: null,
      });
      await Promise.resolve();
    });

    // The stale sched_a loadMore result must not be appended to sched_b's items.
    expect(result.current.items.map((item) => item.id)).toEqual(['b1']);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('does not warn about updating state after unmount when a loadMore fetch resolves late', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    let resolveLoadMore: (value: {
      items: never[];
      next: null;
    }) => void = () => {};

    vi.mocked(listScheduledTaskRuns)
      .mockResolvedValueOnce({
        items: [{ id: 'r1', status: 'Success', startTime: 't1' }],
        next: 'cursor-1',
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
      );

    const { result, unmount } = renderHook(() =>
      useScheduledTaskRuns('sched_123'),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });
    unmount();

    await act(async () => {
      resolveLoadMore({ items: [], next: null });
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
