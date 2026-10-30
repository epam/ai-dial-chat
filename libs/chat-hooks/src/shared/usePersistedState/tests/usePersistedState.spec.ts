import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistedState } from '../usePersistedState';

const storage = {
  read: (key: string) => localStorage.getItem(key),
  write: (key: string, value: string) => localStorage.setItem(key, value),
};
const codec = { decode: JSON.parse, encode: JSON.stringify };
const useLocalStorage = <T>(key: string, initialValue: T) =>
  usePersistedState({ key, initialValue, storage, codec });

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

  it('keeps mount initialization across key changes and reads the new key on remount', () => {
    localStorage.setItem('first', '1');
    localStorage.setItem('second', '2');
    const { result, rerender, unmount } = renderHook(
      ({ key }) => useLocalStorage(key, 0),
      { initialProps: { key: 'first' } },
    );
    expect(result.current[0]).toBe(1);
    rerender({ key: 'second' });
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](3));
    expect(localStorage.getItem('first')).toBe('1');
    expect(localStorage.getItem('second')).toBe('3');
    unmount();
    const { result: remounted } = renderHook(() =>
      useLocalStorage('second', 0),
    );
    expect(remounted.current[0]).toBe(3);
  });

  it('does not decode again when codec changes but writes with the current encoder', () => {
    const read = vi.fn(() => '4');
    const write = vi.fn();
    const first = {
      decode: (value: string) => Number(value),
      encode: (value: number) => String(value),
    };
    const second = {
      decode: vi.fn(() => 99),
      encode: (value: number) => `new:${value}`,
    };
    const { result, rerender } = renderHook(
      ({ codec }) =>
        usePersistedState({
          key: 'key',
          initialValue: 0,
          storage: { read, write },
          codec,
        }),
      { initialProps: { codec: first } },
    );
    rerender({ codec: second });
    expect(result.current[0]).toBe(4);
    expect(second.decode).not.toHaveBeenCalled();
    act(() => result.current[1](5));
    expect(write).toHaveBeenCalledWith('key', 'new:5');
  });
});
