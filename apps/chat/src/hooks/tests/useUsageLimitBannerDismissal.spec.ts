import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resetUsageLimitBannerDismissals,
  useUsageLimitBannerDismissal,
} from '../useUsageLimitBannerDismissal';

const KEY = 'gpt-4o:day:warning';

describe('useUsageLimitBannerDismissal', () => {
  afterEach(() => {
    act(() => {
      resetUsageLimitBannerDismissals();
    });
  });

  it('reads a dismissed key as dismissed in a second hook instance', () => {
    const first = renderHook(() => useUsageLimitBannerDismissal());
    const second = renderHook(() => useUsageLimitBannerDismissal());

    act(() => {
      first.result.current.dismiss(KEY);
    });

    expect(first.result.current.isDismissed(KEY)).toBe(true);
    expect(second.result.current.isDismissed(KEY)).toBe(true);
  });

  it('keeps a dismissal for a hook mounted after it', () => {
    const first = renderHook(() => useUsageLimitBannerDismissal());
    act(() => {
      first.result.current.dismiss(KEY);
    });
    first.unmount();

    const later = renderHook(() => useUsageLimitBannerDismissal());

    expect(later.result.current.isDismissed(KEY)).toBe(true);
  });

  it('does not read another key as dismissed', () => {
    const { result } = renderHook(() => useUsageLimitBannerDismissal());

    act(() => {
      result.current.dismiss(KEY);
    });

    expect(result.current.isDismissed('gpt-4o:day:reached')).toBe(false);
    expect(result.current.isDismissed('claude:day:warning')).toBe(false);
  });

  it('clears every dismissal on reset', () => {
    const { result } = renderHook(() => useUsageLimitBannerDismissal());
    act(() => {
      result.current.dismiss(KEY);
    });

    act(() => {
      resetUsageLimitBannerDismissals();
    });

    expect(result.current.isDismissed(KEY)).toBe(false);
  });
});
