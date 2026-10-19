import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from '../useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 19, 20, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current time on mount', () => {
    const { result } = renderHook(() => useNow(60_000));

    expect(result.current.getTime()).toBe(
      new Date(2026, 9, 19, 20, 0).getTime(),
    );
  });

  it('advances once per interval', () => {
    const { result } = renderHook(() => useNow(60_000));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.getTime()).toBe(
      new Date(2026, 9, 19, 20, 1).getTime(),
    );
  });

  it('stops ticking after unmount', () => {
    const { unmount } = renderHook(() => useNow(60_000));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
