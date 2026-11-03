import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TABLET_MEDIA_QUERY } from '../../constants/breakpoint';
import { useIsTablet } from '../useIsTablet';

describe('useIsTablet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([767, 767.5, 768, 1024, 1279, 1279.5, 1280])(
    'selects the surface policy at %spx',
    (width) => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => {
          const bounds = query.match(/\d+/g)?.map(Number) ?? [];
          return {
            matches:
              bounds.length === 1
                ? width < bounds[0]
                : width >= bounds[0] && width < bounds[1],
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }),
      );
      const { result } = renderHook(() => useIsTablet());
      expect(result.current).toBe(width >= 768 && width < 1280);
      expect(window.matchMedia).toHaveBeenCalledWith(TABLET_MEDIA_QUERY);
    },
  );

  it('updates an open surface and unsubscribes on unmount', () => {
    const listeners = new Set<() => void>();
    const media = {
      matches: false,
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    };
    vi.stubGlobal('matchMedia', () => media);
    const { result, unmount } = renderHook(() => useIsTablet());
    act(() => {
      media.matches = true;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it('falls back safely without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useIsTablet()).result.current).toBe(false);
  });

  it('can render on the server without window', () => {
    vi.stubGlobal('window', undefined);
    const Probe = () => String(useIsTablet());
    expect(renderToString(createElement(Probe))).toBe('false');
  });
});
