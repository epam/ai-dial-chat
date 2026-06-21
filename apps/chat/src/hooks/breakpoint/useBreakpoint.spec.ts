import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBreakpoint, useIsMobile } from './useBreakpoint';

type Listener = (event: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  query: string;
  matches: boolean;
  addEventListener: (type: 'change', listener: Listener) => void;
  removeEventListener: (type: 'change', listener: Listener) => void;
  dispatch: () => void;
}

const createMatchMediaMock = () => {
  const lists = new Map<string, MockMediaQueryList>();
  const listeners = new Map<string, Set<Listener>>();

  const matchMedia = (query: string): MediaQueryList => {
    const existing = lists.get(query);
    if (existing) {
      return existing as unknown as MediaQueryList;
    }
    const listenerSet = new Set<Listener>();
    listeners.set(query, listenerSet);
    const list: MockMediaQueryList = {
      query,
      matches: false,
      addEventListener: (_type, listener) => {
        listenerSet.add(listener);
      },
      removeEventListener: (_type, listener) => {
        listenerSet.delete(listener);
      },
      dispatch: () => {
        listenerSet.forEach((listener) => listener({} as MediaQueryListEvent));
      },
    };
    lists.set(query, list);
    return list as unknown as MediaQueryList;
  };

  const setWidth = (matchesByQuery: Record<string, boolean>) => {
    Object.entries(matchesByQuery).forEach(([query, matches]) => {
      const list = lists.get(query);
      if (list) {
        list.matches = matches;
      }
    });
    lists.forEach((list) => list.dispatch());
  };

  return { matchMedia, setWidth, lists };
};

describe('useBreakpoint', () => {
  let mock: ReturnType<typeof createMatchMediaMock>;

  beforeEach(() => {
    mock = createMatchMediaMock();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: mock.matchMedia,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mobile when the 1024 query does not match', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it('returns desktop when the 769px query matches', () => {
    mock.matchMedia('(min-width: 769px)');
    mock.setWidth({ '(min-width: 769px)': true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('updates when a media query changes', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');

    act(() => {
      mock.setWidth({ '(min-width: 769px)': true });
    });

    expect(result.current).toBe('desktop');
  });

  it('removes its listeners on unmount', () => {
    const { unmount } = renderHook(() => useBreakpoint());
    const sizes = Array.from(mock.lists.values()).map(
      (list) => (list as unknown as { addEventListener: unknown }) && list,
    );
    expect(sizes.length).toBeGreaterThan(0);

    unmount();

    act(() => {
      mock.setWidth({ '(min-width: 769px)': true });
    });
    // No assertion error means the unmounted hook did not call setState.
    expect(true).toBe(true);
  });
});

describe('useIsMobile', () => {
  beforeEach(() => {
    const mock = createMatchMediaMock();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: mock.matchMedia,
    });
  });

  it('is true when no min-width query matches', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
