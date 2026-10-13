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
    const { result: firstResult } = renderHook(() =>
      useUsageLimitBannerDismissal(),
    );
    const { result: secondResult } = renderHook(() =>
      useUsageLimitBannerDismissal(),
    );

    act(() => {
      firstResult.current.dismiss(KEY);
    });

    expect(firstResult.current.isDismissed(KEY)).toBe(true);
    expect(secondResult.current.isDismissed(KEY)).toBe(true);
  });

  it('keeps a dismissal for a hook mounted after it', () => {
    const { result: firstResult, unmount } = renderHook(() =>
      useUsageLimitBannerDismissal(),
    );
    act(() => {
      firstResult.current.dismiss(KEY);
    });
    unmount();

    const { result: laterResult } = renderHook(() =>
      useUsageLimitBannerDismissal(),
    );

    expect(laterResult.current.isDismissed(KEY)).toBe(true);
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
