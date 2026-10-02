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

  it('bounds missing metadata discovery to five retries', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConversationDiscovery([], refresh, 'user-1'),
    );
    await act(async () => result.current(['bucket/missing']));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(refresh).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares retries for duplicate callers and different expected chats', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConversationDiscovery([], refresh, 'user-1'),
    );
    await act(async () => {
      await result.current(['bucket/a']);
      await result.current(['conversations/bucket/a', 'bucket/b']);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('does not overlap retries while a list request is pending', async () => {
    let finish!: () => void;
    const refresh = vi
      .fn()
      .mockResolvedValue(undefined)
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
    const { result } = renderHook(() =>
      useConversationDiscovery([], refresh, 'user-1'),
    );
    await act(async () => result.current(['bucket/a']));
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => finish());
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('does not retry already known conversations or ordinary refreshes', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConversationDiscovery([{ id: 'bucket/a' }], refresh, 'user-1'),
    );
    await act(async () => result.current(['conversations/bucket/a']));
    await act(async () => result.current());
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it.each(['identity', 'unmount'])(
    'cancels scheduled discovery on %s change',
    async (change) => {
      const refresh = vi.fn().mockResolvedValue(undefined);
      const { result, rerender, unmount } = renderHook(
        ({ userSub }) => useConversationDiscovery([], refresh, userSub),
        { initialProps: { userSub: 'user-1' } },
      );
      await act(async () => result.current(['bucket/a']));
      if (change === 'identity') rerender({ userSub: 'user-2' });
      else unmount();
      await act(async () => vi.advanceTimersByTimeAsync(60_000));
      expect(refresh).toHaveBeenCalledTimes(1);
    },
  );

  it('does not resume an old identity discovery after an in-flight refresh finishes', async () => {
    let finish!: () => void;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ userSub }) => useConversationDiscovery([], refresh, userSub),
      { initialProps: { userSub: 'user-1' } },
    );
    let request!: Promise<void>;
    act(() => {
      request = result.current(['bucket/a']);
    });
    rerender({ userSub: 'user-2' });
    await act(async () => {
      finish();
      await request;
    });
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
