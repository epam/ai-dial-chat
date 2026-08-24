import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useViewportWidth } from '../useViewportWidth';

const setInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
};

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  setInnerWidth(originalInnerWidth);
});

describe('useViewportWidth', () => {
  it('returns the current window.innerWidth on mount', () => {
    setInnerWidth(1024);
    const { result } = renderHook(() => useViewportWidth());
    expect(result.current).toBe(1024);
  });

  it('updates when the window is resized', () => {
    setInnerWidth(1024);
    const { result } = renderHook(() => useViewportWidth());

    act(() => {
      setInnerWidth(768);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(768);
  });

  it('removes the resize listener on unmount', () => {
    const { unmount, result } = renderHook(() => useViewportWidth());
    unmount();

    act(() => {
      setInnerWidth(500);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).not.toBe(500);
  });
});
