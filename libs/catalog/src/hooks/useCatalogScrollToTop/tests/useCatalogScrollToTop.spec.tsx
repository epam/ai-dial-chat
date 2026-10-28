import { act, fireEvent, render, screen } from '@testing-library/react';
import { type FC, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListViewHandle } from '../../../models/list-props';
import { useCatalogScrollToTop } from '../useCatalogScrollToTop';

const CLIENT_HEIGHT = 600;

interface ProbeProps {
  isListView?: boolean;
  listView?: ListViewHandle;
  onRowsScrollReady?: (handleRowsScroll: (top: number) => void) => void;
}

const Probe: FC<ProbeProps> = ({
  isListView = false,
  listView,
  onRowsScrollReady,
}) => {
  const [scrollBody, setScrollBody] = useState<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listViewRef = useRef<ListViewHandle | null>(listView ?? null);
  const { isVisible, handleRowsScroll, scrollToTop } = useCatalogScrollToTop({
    scrollBody,
    searchInputRef,
    listViewRef,
    isListView,
  });
  onRowsScrollReady?.(handleRowsScroll);

  return (
    <>
      <input ref={searchInputRef} aria-label="Search" />
      <div ref={setScrollBody} role="region" aria-label="Scroll body" />
      {isVisible && <button onClick={scrollToTop}>Scroll to top</button>}
    </>
  );
};

/* jsdom has no layout, so the scroll body reports the geometry set here. */
const stubScrollBody = () => {
  const scrollBody = screen.getByRole('region', { name: 'Scroll body' });
  Object.defineProperty(scrollBody, 'clientHeight', {
    configurable: true,
    value: CLIENT_HEIGHT,
  });
  const scrollTo = vi.fn();
  scrollBody.scrollTo = scrollTo as unknown as typeof scrollBody.scrollTo;
  return { scrollBody, scrollTo };
};

/* Frames queue like the real thing and run when flushed, so the hook's
   one-frame coalescing is exercised rather than bypassed. */
let pendingFrames: FrameRequestCallback[] = [];

const flushFrames = () => {
  act(() => {
    const frames = pendingFrames;
    pendingFrames = [];
    frames.forEach((frame) => frame(0));
  });
};

const scrollBodyTo = (scrollBody: HTMLElement, top: number) => {
  scrollBody.scrollTop = top;
  fireEvent.scroll(scrollBody);
  flushFrames();
};

const mockReducedMotion = (isReduced: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: isReduced } as MediaQueryList),
  );
};

describe('useCatalogScrollToTop', () => {
  beforeEach(() => {
    pendingFrames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the control while the scroll body is at the top', () => {
    render(<Probe />);
    const { scrollBody } = stubScrollBody();

    scrollBodyTo(scrollBody, 0);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
  });

  it('shows the control once scrolled down by one scroll-body height', () => {
    render(<Probe />);
    const { scrollBody } = stubScrollBody();

    scrollBodyTo(scrollBody, CLIENT_HEIGHT);

    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeTruthy();
  });

  it('keeps the control hidden for a scroll shorter than one screen', () => {
    render(<Probe />);
    const { scrollBody } = stubScrollBody();

    scrollBodyTo(scrollBody, CLIENT_HEIGHT / 2);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
  });

  it('hides the control again when scrolled back up', () => {
    render(<Probe />);
    const { scrollBody } = stubScrollBody();
    scrollBodyTo(scrollBody, CLIENT_HEIGHT);

    scrollBodyTo(scrollBody, 100);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
  });

  it('counts the list rows offset in list view', () => {
    let handleRowsScroll: (top: number) => void = () => undefined;
    render(
      <Probe
        isListView
        onRowsScrollReady={(handler) => {
          handleRowsScroll = handler;
        }}
      />,
    );
    const { scrollBody } = stubScrollBody();
    scrollBodyTo(scrollBody, 200);

    act(() => handleRowsScroll(400));
    flushFrames();

    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeTruthy();
  });

  it('ignores the list rows offset outside list view', () => {
    let handleRowsScroll: (top: number) => void = () => undefined;
    const { rerender } = render(
      <Probe
        isListView
        onRowsScrollReady={(handler) => {
          handleRowsScroll = handler;
        }}
      />,
    );
    const { scrollBody } = stubScrollBody();
    scrollBodyTo(scrollBody, 200);
    act(() => handleRowsScroll(400));
    flushFrames();

    rerender(<Probe isListView={false} />);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
  });

  it('drops the list rows offset kept from before leaving list view', () => {
    let handleRowsScroll: (top: number) => void = () => undefined;
    const onRowsScrollReady = (handler: (top: number) => void) => {
      handleRowsScroll = handler;
    };
    const { rerender } = render(
      <Probe isListView onRowsScrollReady={onRowsScrollReady} />,
    );
    const { scrollBody } = stubScrollBody();
    scrollBodyTo(scrollBody, 200);
    act(() => handleRowsScroll(400));
    flushFrames();
    rerender(
      <Probe isListView={false} onRowsScrollReady={onRowsScrollReady} />,
    );

    rerender(<Probe isListView onRowsScrollReady={onRowsScrollReady} />);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
  });

  it('does not take a list rows offset reported outside list view', () => {
    let handleRowsScroll: (top: number) => void = () => undefined;
    const onRowsScrollReady = (handler: (top: number) => void) => {
      handleRowsScroll = handler;
    };
    const { rerender } = render(
      <Probe onRowsScrollReady={onRowsScrollReady} />,
    );
    const { scrollBody } = stubScrollBody();
    scrollBodyTo(scrollBody, 200);
    act(() => handleRowsScroll(400));
    flushFrames();

    rerender(<Probe isListView onRowsScrollReady={onRowsScrollReady} />);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
  });

  it('scrolls smoothly to the top and focuses search', () => {
    render(<Probe />);
    const { scrollBody, scrollTo } = stubScrollBody();
    scrollBodyTo(scrollBody, CLIENT_HEIGHT);

    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    // Focus is a document-level fact; no Testing Library query reports it.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(screen.getByLabelText('Search'));
  });

  it('scrolls instantly when reduced motion is preferred', () => {
    mockReducedMotion(true);
    render(<Probe />);
    const { scrollBody, scrollTo } = stubScrollBody();
    scrollBodyTo(scrollBody, CLIENT_HEIGHT);

    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('resets the list rows only in list view', () => {
    const listView = { scrollToTop: vi.fn() };
    const { unmount } = render(<Probe listView={listView} />);
    const grid = stubScrollBody();
    scrollBodyTo(grid.scrollBody, CLIENT_HEIGHT);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));
    expect(listView.scrollToTop).not.toHaveBeenCalled();
    unmount();

    render(<Probe isListView listView={listView} />);
    const list = stubScrollBody();
    scrollBodyTo(list.scrollBody, CLIENT_HEIGHT);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));

    expect(listView.scrollToTop).toHaveBeenCalledOnce();
  });

  it('stops listening to scroll on unmount', () => {
    const { unmount } = render(<Probe />);
    const { scrollBody } = stubScrollBody();
    const removeEventListener = vi.spyOn(scrollBody, 'removeEventListener');

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
    );
  });
});
