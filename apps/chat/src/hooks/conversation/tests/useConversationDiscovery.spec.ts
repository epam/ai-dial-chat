import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationDiscovery } from '../useConversationDiscovery';

describe('useConversationDiscovery', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries missing metadata independently of run polling and stops once found', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ items }) => useConversationDiscovery(items, refresh, 'user-1'),
      { initialProps: { items: [] as { id: string }[] } },
    );
    await act(async () => result.current(['conversations/bucket/run%201']));
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(refresh).toHaveBeenCalledTimes(2);
    rerender({ items: [{ id: 'bucket/run 1' }] });
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
