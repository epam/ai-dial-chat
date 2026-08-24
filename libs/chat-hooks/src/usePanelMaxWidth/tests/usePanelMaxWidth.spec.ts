import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePanelMaxWidth } from '../usePanelMaxWidth';

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

describe('usePanelMaxWidth', () => {
  it('leaves room for the minimum content area', () => {
    setInnerWidth(1200);
    const { result } = renderHook(() => usePanelMaxWidth(400));
    expect(result.current).toBe(800);
  });

  it('clamps to 0 when the viewport is narrower than the minimum content area', () => {
    setInnerWidth(300);
    const { result } = renderHook(() => usePanelMaxWidth(400));
    expect(result.current).toBe(0);
  });

  it('recomputes when the viewport is resized', () => {
    setInnerWidth(1200);
    const { result } = renderHook(() => usePanelMaxWidth(400));
    expect(result.current).toBe(800);

    act(() => {
      setInnerWidth(900);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(500);
  });
});
