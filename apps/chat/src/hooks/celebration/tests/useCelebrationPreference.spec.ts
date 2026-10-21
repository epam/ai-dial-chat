import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import { StorageKey } from '../../../types/storage-key';
import { useCelebrationPreference } from '../useCelebrationPreference';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const setOperatorDefault = (celebrationsEnabledByDefault: boolean) => {
  vi.mocked(useAppConfig).mockReturnValue({
    config: { celebrationsEnabledByDefault },
  } as ReturnType<typeof useAppConfig>);
};

describe('useCelebrationPreference', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setOperatorDefault(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it.each([true, false])(
    'follows the operator default %s when nothing is stored',
    (isDefaultOn) => {
      setOperatorDefault(isDefaultOn);

      const { result } = renderHook(() => useCelebrationPreference());

      expect(result.current.isEnabled).toBe(isDefaultOn);
    },
  );

  it.each([
    ['true', false, true],
    ['false', true, false],
    ['yes', true, true],
    ['yes', false, false],
  ])(
    'reads the stored value %s with operator default %s as %s',
    (stored, isDefaultOn, expected) => {
      localStorage.setItem(StorageKey.CelebrationsEnabled, stored);
      setOperatorDefault(isDefaultOn);

      const { result } = renderHook(() => useCelebrationPreference());

      expect(result.current.isEnabled).toBe(expected);
    },
  );

  it('follows a changed operator default while nothing is stored', () => {
    const { result, rerender } = renderHook(() => useCelebrationPreference());
    expect(result.current.isEnabled).toBe(true);

    setOperatorDefault(false);
    rerender();

    expect(result.current.isEnabled).toBe(false);
  });

  it('never writes the operator default to storage', () => {
    renderHook(() => useCelebrationPreference());

    expect(localStorage.getItem(StorageKey.CelebrationsEnabled)).toBeNull();
  });

  it('keeps a saved choice after the operator default changes', () => {
    const { result, rerender } = renderHook(() => useCelebrationPreference());

    act(() => result.current.setIsEnabled(false));
    setOperatorDefault(true);
    rerender();

    expect(result.current.isEnabled).toBe(false);
  });

  it('persists a write and updates every mounted instance', () => {
    setOperatorDefault(false);
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
