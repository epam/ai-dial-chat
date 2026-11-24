import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAfterLoadIdleForTests } from '../../utils/load-idle';
import { useDeferredOverlayMount } from '../useDeferredOverlayMount';

describe('useDeferredOverlayMount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAfterLoadIdleForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a closed overlay unmounted until the page has loaded', () => {
    const { result } = renderHook(() => useDeferredOverlayMount(false));
    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current).toBe(true);
  });

  it('mounts an overlay that opens before the page has loaded', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useDeferredOverlayMount(isOpen),
      { initialProps: { isOpen: false } },
    );

    rerender({ isOpen: true });
    expect(result.current).toBe(true);

    rerender({ isOpen: false });
    expect(result.current).toBe(true);
  });
});
