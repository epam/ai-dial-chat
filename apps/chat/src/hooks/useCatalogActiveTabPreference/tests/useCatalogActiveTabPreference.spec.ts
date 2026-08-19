import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageKey } from '../../../types/storage-key';
import { useCatalogActiveTabPreference } from '../useCatalogActiveTabPreference';

describe('useCatalogActiveTabPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves to the first available tab when nothing is persisted', () => {
    const { result } = renderHook(() =>
      useCatalogActiveTabPreference(['model', 'agent', 'prompt']),
    );

    expect(result.current.activeTab).toBe('model');
  });

  it('restores a persisted tab that is still available', () => {
    localStorage.setItem(StorageKey.CatalogActiveTab, JSON.stringify('agent'));

    const { result } = renderHook(() =>
      useCatalogActiveTabPreference(['model', 'agent', 'prompt']),
    );

    expect(result.current.activeTab).toBe('agent');
  });

  it('falls back to the first available tab when the persisted tab is stale', () => {
    localStorage.setItem(StorageKey.CatalogActiveTab, JSON.stringify('skill'));

    const { result } = renderHook(() =>
      useCatalogActiveTabPreference(['model', 'agent']),
    );

    expect(result.current.activeTab).toBe('model');
  });

  it('persists the new tab when setActiveTab is called', () => {
    const { result } = renderHook(() =>
      useCatalogActiveTabPreference(['model', 'agent', 'prompt']),
    );

    act(() => {
      result.current.setActiveTab('prompt');
    });

    expect(result.current.activeTab).toBe('prompt');
    expect(localStorage.getItem(StorageKey.CatalogActiveTab)).toBe(
      JSON.stringify('prompt'),
    );
  });

  it('resolves to undefined when no tabs are available', () => {
    const { result } = renderHook(() => useCatalogActiveTabPreference([]));

    expect(result.current.activeTab).toBeUndefined();
  });

  it('does not throw and still updates in-memory state when localStorage.setItem fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() =>
      useCatalogActiveTabPreference(['model', 'agent']),
    );

    act(() => {
      result.current.setActiveTab('agent');
    });

    expect(result.current.activeTab).toBe('agent');
  });
});
