import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultAgentMode } from '../../../types/default-agent';
import { StorageKey } from '../../../types/storage-key';
import { useDefaultAgentPreference } from '../useDefaultAgentPreference';

describe('useDefaultAgentPreference', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to LastUsedAgent when nothing is stored', () => {
    const { result } = renderHook(() => useDefaultAgentPreference());

    expect(result.current.preference).toBe(DefaultAgentMode.LastUsedAgent);
  });

  /*
   * The raw absence is what tells an explicit "Last used agent" choice from an
   * untouched preference, and only the explicit one outranks a pinned operator
   * default.
   */
  it('reports no stored preference until one is written', () => {
    const { result } = renderHook(() => useDefaultAgentPreference());

    expect(result.current.storedPreference).toBeNull();

    act(() => result.current.setPreference(DefaultAgentMode.LastUsedAgent));

    expect(result.current.storedPreference).toBe(
      DefaultAgentMode.LastUsedAgent,
    );
  });

  it('exposes a stored sentinel as the stored preference', () => {
    localStorage.setItem(
      StorageKey.DefaultAgent,
      DefaultAgentMode.LastUsedAgent,
    );

    const { result } = renderHook(() => useDefaultAgentPreference());

    expect(result.current.storedPreference).toBe(
      DefaultAgentMode.LastUsedAgent,
    );
  });

  it('loads a stored deployment id on mount', () => {
    localStorage.setItem(StorageKey.DefaultAgent, 'gpt-4o');

    const { result } = renderHook(() => useDefaultAgentPreference());

    expect(result.current.preference).toBe('gpt-4o');
  });

  it('loads a stored sentinel on mount', () => {
    localStorage.setItem(
      StorageKey.DefaultAgent,
      DefaultAgentMode.DefaultAgent,
    );

    const { result } = renderHook(() => useDefaultAgentPreference());

    expect(result.current.preference).toBe(DefaultAgentMode.DefaultAgent);
  });

  it('persists and updates the value when setPreference is called', () => {
    const { result } = renderHook(() => useDefaultAgentPreference());

    act(() => result.current.setPreference(DefaultAgentMode.DefaultAgent));

    expect(localStorage.getItem(StorageKey.DefaultAgent)).toBe('default-agent');
    expect(result.current.preference).toBe(DefaultAgentMode.DefaultAgent);
  });

  it('propagates a change to every other mounted instance', () => {
    const { result: writer } = renderHook(() => useDefaultAgentPreference());
    const { result: reader } = renderHook(() => useDefaultAgentPreference());

    act(() => writer.current.setPreference('opus'));

    expect(reader.current.preference).toBe('opus');
  });

  it('removes its listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useDefaultAgentPreference());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      'default-agent-preference-change',
      expect.any(Function),
    );
  });

  it('does not update an unmounted instance', () => {
    const { result: writer } = renderHook(() => useDefaultAgentPreference());
    const { result: gone, unmount } = renderHook(() =>
      useDefaultAgentPreference(),
    );
    unmount();
    const lastSeen = gone.current.preference;

    act(() => writer.current.setPreference('opus'));

    expect(gone.current.preference).toBe(lastSeen);
    expect(writer.current.preference).toBe('opus');
  });

  it('issues no network request when the preference is written', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useDefaultAgentPreference());

    act(() => result.current.setPreference('opus'));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
