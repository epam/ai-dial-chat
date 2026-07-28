import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageKey } from '../../../types/storage-key';
import { useAnnouncementDismissal } from '../useAnnouncementDismissal';

describe('useAnnouncementDismissal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to an empty dismissed text when nothing is persisted', () => {
    const { result } = renderHook(() => useAnnouncementDismissal());

    expect(result.current.dismissedText).toBe('');
  });

  it('restores a persisted dismissed text', () => {
    localStorage.setItem(
      StorageKey.TextOfClosedAnnouncement,
      JSON.stringify('Welcome to DIAL!'),
    );

    const { result } = renderHook(() => useAnnouncementDismissal());

    expect(result.current.dismissedText).toBe('Welcome to DIAL!');
  });

  it('persists the dismissed text when dismiss is called', () => {
    const { result } = renderHook(() => useAnnouncementDismissal());

    act(() => {
      result.current.dismiss('Welcome to DIAL!');
    });

    expect(result.current.dismissedText).toBe('Welcome to DIAL!');
    expect(localStorage.getItem(StorageKey.TextOfClosedAnnouncement)).toBe(
      JSON.stringify('Welcome to DIAL!'),
    );
  });
});
