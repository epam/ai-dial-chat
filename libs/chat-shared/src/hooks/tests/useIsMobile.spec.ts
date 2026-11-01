import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_MEDIA_QUERY } from '../../constants/breakpoint';
import { useIsMobile } from '../useIsMobile';

type Listener = () => void;

/* A `matchMedia` stub whose mobile query can be flipped and dispatched. */
const stubMatchMedia = (initialMatches: boolean) => {
  const listeners = new Set<Listener>();
  let isMobileMatch = initialMatches;
  const createList = (query: string) => ({
    get matches() {
      return query === MOBILE_MEDIA_QUERY && isMobileMatch;
    },
    addEventListener: (_type: 'change', listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: 'change', listener: Listener) => {
      listeners.delete(listener);
    },
  });
  vi.stubGlobal('matchMedia', vi.fn(createList));
  return {
    listeners,
    setMatches: (matches: boolean) => {
      isMobileMatch = matches;
      listeners.forEach((listener) => listener());
    },
  };
};

describe('useIsMobile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true when the mobile media query matches', () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('is false when the mobile media query does not match', () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('updates when the media query changes', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());

    act(() => {
      media.setMatches(true);
    });

    expect(result.current).toBe(true);
  });

  it('removes its listener on unmount', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    expect(media.listeners.size).toBe(0);
  });

  it('is false where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });
});
