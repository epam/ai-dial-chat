import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAfterLoadIdleForTests } from '../../utils/load-idle';
import { useIsAfterLoadIdle } from '../useIsAfterLoadIdle';

describe('useIsAfterLoadIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAfterLoadIdleForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is false until the post-load idle point, then true', () => {
    const { result } = renderHook(() => useIsAfterLoadIdle());
    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current).toBe(true);
  });

  it('is true from the first render once the idle point has passed', () => {
    const { unmount } = renderHook(() => useIsAfterLoadIdle());
    act(() => {
      vi.runAllTimers();
    });
    unmount();

    const { result } = renderHook(() => useIsAfterLoadIdle());

    expect(result.current).toBe(true);
  });
});
