import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from '../useIsMobile';
import { useIsPhone } from '../useIsPhone';
import { useIsTablet } from '../useIsTablet';

/*
 * A width-driven `matchMedia` stub. Like a browser, it fires one `change`
 * per query whose match flipped, each as its own dispatch.
 */
const stubViewport = (initialWidth: number) => {
  let width = initialWidth;
  const evaluate = (query: string): boolean => {
    const bounds = query.match(/\d+/g)?.map(Number) ?? [];
    if (query.startsWith('(max-width')) return width <= bounds[0];
    if (bounds.length === 1) return width < bounds[0];
    return width >= bounds[0] && width < bounds[1];
  };
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return evaluate(query);
      },
      addEventListener: (_: string, listener: () => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)?.add(listener);
      },
      removeEventListener: (_: string, listener: () => void) => {
        listeners.get(query)?.delete(listener);
      },
    })),
  );
  return {
    resize: (nextWidth: number) => {
      const before = new Map(
        [...listeners.keys()].map((query) => [query, evaluate(query)]),
      );
      width = nextWidth;
      listeners.forEach((set, query) => {
        if (before.get(query) !== evaluate(query)) {
          act(() => set.forEach((listener) => listener()));
        }
      });
    },
  };
};

const useBreakpoints = () => ({
  isMobile: useIsMobile(),
  isTablet: useIsTablet(),
  isPhone: useIsPhone(),
});

describe('breakpoint hooks used together', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [1281, 1279],
    [1279, 1281],
    [769, 767],
    [767, 769],
  ])(
    'keeps every flag consistent in each render when resizing from %spx to %spx',
    (from, to) => {
      const viewport = stubViewport(from);
      const renders: ReturnType<typeof useBreakpoints>[] = [];
      renderHook(() => {
        const flags = useBreakpoints();
        renders.push(flags);
        return flags;
      });

      viewport.resize(to);

      const expected = {
        isMobile: to <= 1279,
        isTablet: to >= 768 && to < 1280,
        isPhone: to < 768,
      };
      const initialRenderCount = 1;
      renders.slice(initialRenderCount).forEach((flags) => {
        expect(flags).toEqual(expected);
      });
      expect(renders.at(-1)).toEqual(expected);
    },
  );
});
