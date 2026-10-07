import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useScheduledTasks } from '../use-scheduled-tasks';

describe('shared useScheduledTasks', () => {
  it('keeps an incremental failure separate from loaded items', async () => {
    const listScheduledTasks = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'one', trigger: {} }],
        next: 'next',
      })
      .mockRejectedValueOnce(new Error('more failed'));
    const client = { listScheduledTasks };
    const { result } = renderHook(() => useScheduledTasks(client as never));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.initialError).toBeNull();
    expect(result.current.loadMoreError?.message).toBe('more failed');
  });
  it('filters the first page and every next page by model', async () => {
    const listScheduledTasks = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'one', trigger: {} }],
        next: 'next',
      })
      .mockResolvedValueOnce({ items: [{ id: 'two', trigger: {} }] });
    const client = { listScheduledTasks };
    const { result } = renderHook(() =>
      useScheduledTasks(client as never, { model: 'applications/a/b__1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(listScheduledTasks).toHaveBeenCalledTimes(2);
    expect(listScheduledTasks.mock.calls[0][0]).toMatchObject({
      offset: 0,
      model: 'applications/a/b__1',
    });
    expect(listScheduledTasks.mock.calls[1][0]).toMatchObject({
      offset: 1,
      model: 'applications/a/b__1',
    });
  });

  it('reloads from the first page when the model changes', async () => {
    const listScheduledTasks = vi
      .fn()
      .mockResolvedValue({ items: [], next: null });
    const client = { listScheduledTasks };
    const { result, rerender } = renderHook(
      ({ model }: { model: string }) =>
        useScheduledTasks(client as never, { model }),
      { initialProps: { model: 'applications/a/one__1' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ model: 'applications/a/two__1' });
    await waitFor(() => expect(listScheduledTasks).toHaveBeenCalledTimes(2));

    expect(listScheduledTasks.mock.calls[1][0]).toMatchObject({
      offset: 0,
      model: 'applications/a/two__1',
    });
  });
});
