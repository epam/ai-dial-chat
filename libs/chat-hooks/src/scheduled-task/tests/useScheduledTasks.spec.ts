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
});
