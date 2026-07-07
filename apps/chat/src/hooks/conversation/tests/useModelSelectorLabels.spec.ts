import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModelSelectorLabels } from '../useModelSelectorLabels';

describe('useModelSelectorLabels', () => {
  it('returns undefined loading/error/empty when items are loaded', () => {
    const { result } = renderHook(() =>
      useModelSelectorLabels({ isLoading: false, error: null, itemCount: 3 }),
    );

    expect(result.current.loading).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.empty).toBeUndefined();
    expect(result.current.ariaLabel).toBeTruthy();
    expect(result.current.searchPlaceholder).toBeTruthy();
    expect(result.current.closeLabel).toBeTruthy();
  });

  it('returns a loading label while isLoading is true', () => {
    const { result } = renderHook(() =>
      useModelSelectorLabels({ isLoading: true, error: null, itemCount: 0 }),
    );

    expect(result.current.loading).toBeTruthy();
    expect(result.current.empty).toBeUndefined();
  });

  it('returns an error label when error is present', () => {
    const { result } = renderHook(() =>
      useModelSelectorLabels({
        isLoading: false,
        error: new Error('failed'),
        itemCount: 0,
      }),
    );

    expect(result.current.error).toBeTruthy();
    expect(result.current.empty).toBeUndefined();
  });

  it('returns an empty label when loaded with no items and no error', () => {
    const { result } = renderHook(() =>
      useModelSelectorLabels({ isLoading: false, error: null, itemCount: 0 }),
    );

    expect(result.current.empty).toBeTruthy();
  });
});
