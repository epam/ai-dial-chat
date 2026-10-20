import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageKey } from '../../../types/storage-key';
import { useCelebrationPreference } from '../useCelebrationPreference';

describe('useCelebrationPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('is off when nothing is stored', () => {
    const { result } = renderHook(() => useCelebrationPreference());

    expect(result.current.isEnabled).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['yes', false],
  ])('reads the stored value %s as %s', (stored, expected) => {
    localStorage.setItem(StorageKey.CelebrationsEnabled, stored);

    const { result } = renderHook(() => useCelebrationPreference());

    expect(result.current.isEnabled).toBe(expected);
  });

  it('persists a write and updates every mounted instance', () => {
    const { result: writer } = renderHook(() => useCelebrationPreference());
    const { result: reader } = renderHook(() => useCelebrationPreference());

    act(() => writer.current.setIsEnabled(true));

    expect(localStorage.getItem(StorageKey.CelebrationsEnabled)).toBe('true');
    expect(writer.current.isEnabled).toBe(true);
    expect(reader.current.isEnabled).toBe(true);

    act(() => reader.current.setIsEnabled(false));

    expect(localStorage.getItem(StorageKey.CelebrationsEnabled)).toBe('false');
    expect(writer.current.isEnabled).toBe(false);
  });
});
