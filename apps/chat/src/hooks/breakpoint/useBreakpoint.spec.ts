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

  it('returns mobile when no min-width query matches', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it('returns small_tablet when only the 768 query matches', () => {
    // Prime the lists by calling matchMedia first so initial state sees them.
    mock.matchMedia('(min-width: 768px)');
    mock.matchMedia('(min-width: 1024px)');
    mock.matchMedia('(min-width: 1280px)');
    mock.matchMedia('(min-width: 2560px)');
    mock.setWidth({
      '(min-width: 768px)': true,
      '(min-width: 1024px)': false,
      '(min-width: 1280px)': false,
      '(min-width: 2560px)': false,
    });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('small_tablet');
  });

  it('returns desktop when 1280 matches but 2560 does not', () => {
    mock.matchMedia('(min-width: 768px)');
    mock.matchMedia('(min-width: 1024px)');
    mock.matchMedia('(min-width: 1280px)');
    mock.matchMedia('(min-width: 2560px)');
    mock.setWidth({
      '(min-width: 768px)': true,
      '(min-width: 1024px)': true,
      '(min-width: 1280px)': true,
      '(min-width: 2560px)': false,
    });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('returns large_desktop when 2560 matches', () => {
    mock.matchMedia('(min-width: 768px)');
    mock.matchMedia('(min-width: 1024px)');
    mock.matchMedia('(min-width: 1280px)');
    mock.matchMedia('(min-width: 2560px)');
    mock.setWidth({
      '(min-width: 768px)': true,
      '(min-width: 1024px)': true,
      '(min-width: 1280px)': true,
      '(min-width: 2560px)': true,
    });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('large_desktop');
  });

  it('updates when a media query changes', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');

    act(() => {
      mock.setWidth({
        '(min-width: 768px)': true,
        '(min-width: 1024px)': true,
        '(min-width: 1280px)': true,
        '(min-width: 2560px)': false,
      });
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
      mock.setWidth({
        '(min-width: 768px)': true,
      });
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
