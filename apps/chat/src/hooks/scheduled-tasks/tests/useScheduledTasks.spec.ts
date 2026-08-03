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
      expect.objectContaining({ offset: 0, search: '' }),
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

  it('does not fetch when sortKey changes', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({
      items: [
        { id: '1', displayName: 'B', trigger: {} },
        { id: '2', displayName: 'A', trigger: {} },
      ],
      next: null,
    });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(listScheduledTasks).mockClear();

    act(() => {
      result.current.setSortKey(ScheduledTasksSortKey.NameAZ);
    });

    expect(listScheduledTasks).not.toHaveBeenCalled();
    expect(result.current.sortKey).toBe(ScheduledTasksSortKey.NameAZ);
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
      expect.objectContaining({ offset: 1 }),
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
});
