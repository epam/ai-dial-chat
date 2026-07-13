import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDelayedUnmount } from '../useDelayedUnmount';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDelayedUnmount', () => {
  it('renders immediately when isVisible starts true', () => {
    const { result } = renderHook(() => useDelayedUnmount(true, 160));

    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isExiting).toBe(false);
  });

  it('does not render when isVisible starts false', () => {
    const { result } = renderHook(() => useDelayedUnmount(false, 160));

    expect(result.current.shouldRender).toBe(false);
    expect(result.current.isExiting).toBe(false);
  });

  it('keeps rendering and marks isExiting when isVisible turns false', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ isVisible }) => useDelayedUnmount(isVisible, 160),
      { initialProps: { isVisible: true } },
    );

    rerender({ isVisible: false });

    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isExiting).toBe(true);
  });

  it('stops rendering once the exit duration elapses', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ isVisible }) => useDelayedUnmount(isVisible, 160),
      { initialProps: { isVisible: true } },
    );

    rerender({ isVisible: false });

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(result.current.shouldRender).toBe(false);
    expect(result.current.isExiting).toBe(false);
  });

  it('cancels the pending exit and stays visible when isVisible turns true again mid-exit', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ isVisible }) => useDelayedUnmount(isVisible, 160),
      { initialProps: { isVisible: true } },
    );

    rerender({ isVisible: false });
    act(() => {
      vi.advanceTimersByTime(80);
    });
    rerender({ isVisible: true });

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isExiting).toBe(false);
  });

  it('bumps instanceKey every time the element (re)appears, including mid-exit', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ isVisible }) => useDelayedUnmount(isVisible, 160),
      { initialProps: { isVisible: true } },
    );

    const firstKey = result.current.instanceKey;

    rerender({ isVisible: false });
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(result.current.instanceKey).toBe(firstKey);

    rerender({ isVisible: true });
    expect(result.current.instanceKey).toBe(firstKey + 1);
  });

  it('does not bump instanceKey while isVisible stays false', () => {
    const { result } = renderHook(() => useDelayedUnmount(false, 160));

    expect(result.current.instanceKey).toBe(0);
  });
});
