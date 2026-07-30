/* eslint-disable @typescript-eslint/no-empty-function */
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
  });

  it('fetches the list on mount', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({
      items: [{ id: '1', displayName: 'Daily summary', trigger: {} }],
    });

    const { result } = renderHook(() => useScheduledTasks());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTasks).toHaveBeenCalledOnce();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch while disabled and starts fetching when enabled', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({ items: [] });

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
    let resolveFetch: (value: { items: never[] }) => void = () => {};
    vi.mocked(listScheduledTasks).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { unmount } = renderHook(() => useScheduledTasks());
    unmount();

    await act(async () => {
      resolveFetch({ items: [] });
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('refetches when refetch is called', async () => {
    vi.mocked(listScheduledTasks).mockResolvedValue({ items: [] });

    const { result } = renderHook(() => useScheduledTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listScheduledTasks).toHaveBeenCalledTimes(2);
  });
});
