import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import useLocalStorage from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
