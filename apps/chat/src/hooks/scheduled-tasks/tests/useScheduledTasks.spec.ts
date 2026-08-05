/* eslint-disable @typescript-eslint/no-empty-function */
import { ScheduledTasksSortKey } from '@epam/ai-dial-scheduled-tasks';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listScheduledTasks } from '../../../server-api/scheduled-tasks.api';
import { useScheduledTasks } from '../useScheduledTasks';

vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  listScheduledTasks: vi.fn(),
}));

describe('useScheduledTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('fetches page 0 on mount', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({
      items: [{ id: '1', displayName: 'Daily summary', trigger: {} }],
      next: null,
    });

    const { result } = renderHook(() => useScheduledTasks());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        search: '',
        sort: ScheduledTasksSortKey.FirstToRun,
      }),
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  it('does not fetch while disabled and starts fetching when enabled', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({ items: [], next: null });

    const { result, rerender } = renderHook(
      ({ enabled }) => useScheduledTasks(enabled),
      { initialProps: { enabled: false } },
    );

    expect(result.current.isLoading).toBe(false);
    expect(listScheduledTasks).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listScheduledTasks).toHaveBeenCalledOnce();
  });

  it('sets error and does not throw when the fetch rejects', async () => {
    vi.mocked(listScheduledTasks).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useScheduledTasks());

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
    vi.mocked(listScheduledTasks).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { unmount } = renderHook(() => useScheduledTasks());
    unmount();

    await act(async () => {
      resolveFetch({ items: [], next: null });
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('refetches page 0 when refetch is called', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({ items: [], next: null });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTasks).toHaveBeenCalledTimes(2);
  });

  it('debounces searchQuery changes before refetching page 0', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listScheduledTasks).mockResolvedValue({ items: [], next: null });

    const { result } = renderHook(() => useScheduledTasks());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(listScheduledTasks).mockClear();

    act(() => {
      result.current.setSearchQuery('d');
      result.current.setSearchQuery('da');
      result.current.setSearchQuery('daily');
    });

    expect(listScheduledTasks).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await vi.waitFor(() =>
      expect(listScheduledTasks).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0, search: 'daily' }),
      ),
    );
    expect(listScheduledTasks).toHaveBeenCalledOnce();
  });

  it('changing sortKey resets pagination and refetches page 0 with the new sort', async () => {
    vi.mocked(listScheduledTasks)
      .mockResolvedValueOnce({
        items: [
          { id: '1', displayName: 'B', trigger: {} },
          { id: '2', displayName: 'A', trigger: {} },
        ],
        next: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [{ id: '2', displayName: 'A', trigger: {} }],
        next: null,
      });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);
    vi.mocked(listScheduledTasks).mockClear();

    act(() => {
      result.current.setSortKey(ScheduledTasksSortKey.NameAZ);
    });

    expect(result.current.sortKey).toBe(ScheduledTasksSortKey.NameAZ);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTasks).toHaveBeenCalledOnce();
    expect(listScheduledTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        sort: ScheduledTasksSortKey.NameAZ,
      }),
    );
    expect(result.current.items.map((item) => item.id)).toEqual(['2']);
  });

  it('loadMore appends the next page and derives hasMore from next', async () => {
    vi.mocked(listScheduledTasks)
      .mockResolvedValueOnce({
        items: [{ id: '1', displayName: 'First', trigger: {} }],
        next: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [{ id: '2', displayName: 'Second', trigger: {} }],
        next: null,
      });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['1', '2']);
    expect(result.current.hasMore).toBe(false);
    expect(listScheduledTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offset: 1,
        sort: ScheduledTasksSortKey.FirstToRun,
      }),
    );
  });

  it('loadMore deduplicates items by id', async () => {
    vi.mocked(listScheduledTasks)
      .mockResolvedValueOnce({
        items: [{ id: '1', displayName: 'First', trigger: {} }],
        next: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [{ id: '1', displayName: 'First', trigger: {} }],
        next: null,
      });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.items).toHaveLength(1);
  });

  it('loadMore is a no-op when hasMore is false', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({ items: [], next: null });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(listScheduledTasks).mockClear();

    act(() => {
      result.current.loadMore();
    });

    expect(listScheduledTasks).not.toHaveBeenCalled();
  });

  it('loadMore requests the next offset based on the raw server page size, not the deduplicated items length', async () => {
    vi.mocked(listScheduledTasks)
      .mockResolvedValueOnce({
        items: [{ id: '1', displayName: 'First', trigger: {} }],
        next: 'cursor-1',
      })
      .mockResolvedValueOnce({
        // Server re-serves id "1" alongside a new item; dedupe drops it from
        // `items`, but the next offset must still advance by the full raw
        // page size the server returned, not by the post-dedupe count.
        items: [
          { id: '1', displayName: 'First', trigger: {} },
          { id: '2', displayName: 'Second', trigger: {} },
        ],
        next: 'cursor-2',
      })
      .mockResolvedValueOnce({
        items: [{ id: '3', displayName: 'Third', trigger: {} }],
        next: null,
      });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
    expect(result.current.items).toHaveLength(2);

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(listScheduledTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 3 }),
    );
    expect(result.current.items.map((item) => item.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('cancels an in-flight loadMore when searchQuery changes, so its response is never applied', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveLoadMore: (value: {
      items: { id: string; displayName: string; trigger: object }[];
      next: null;
    }) => void = () => {};

    vi.mocked(listScheduledTasks)
      .mockResolvedValueOnce({
        items: [{ id: '1', displayName: 'First', trigger: {} }],
        next: 'cursor-1',
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
      )
      .mockResolvedValueOnce({
        items: [{ id: 'new', displayName: 'New search result', trigger: {} }],
        next: null,
      });

    const { result } = renderHook(() => useScheduledTasks());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });
    expect(result.current.isLoadingMore).toBe(true);

    act(() => {
      result.current.setSearchQuery('daily');
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['new']);

    // The stale loadMore response arrives after the new search already
    // resolved; it must not be appended onto the new search's result.
    await act(async () => {
      resolveLoadMore({
        items: [{ id: '1', displayName: 'First', trigger: {} }],
        next: null,
      });
      await Promise.resolve();
    });

    expect(result.current.items.map((item) => item.id)).toEqual(['new']);
  });

  it('does not warn about updating state after unmount when a loadMore fetch resolves late', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    let resolveLoadMore: (value: {
      items: never[];
      next: null;
    }) => void = () => {};

    vi.mocked(listScheduledTasks)
      .mockResolvedValueOnce({
        items: [{ id: '1', displayName: 'First', trigger: {} }],
        next: 'cursor-1',
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
      );

    const { result, unmount } = renderHook(() => useScheduledTasks());
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
