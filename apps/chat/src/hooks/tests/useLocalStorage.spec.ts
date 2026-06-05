import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useLocalStorage from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initialValue when key is absent from localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', false));
    expect(result.current[0]).toBe(false);
  });

  it('returns the stored value when key is present in localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify(true));
    const { result } = renderHook(() => useLocalStorage('test-key', false));
    expect(result.current[0]).toBe(true);
  });

  it('updates localStorage when setter is called', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', false));

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('test-key')).toBe('true');
  });

  it('returns initialValue when stored value is malformed JSON', () => {
    localStorage.setItem('test-key', 'not-valid-json{{{');
    const { result } = renderHook(() => useLocalStorage('test-key', false));
    expect(result.current[0]).toBe(false);
  });

  it('does not throw when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 0));

    expect(() => {
      act(() => {
        result.current[1](42);
      });
    }).not.toThrow();

    expect(result.current[0]).toBe(42);
  });

  it('returns a stable setter reference across renders', () => {
    const { result, rerender } = renderHook(() =>
      useLocalStorage('test-key', 0),
    );

    const firstSetter = result.current[1];
    rerender();
    expect(result.current[1]).toBe(firstSetter);
  });
});
