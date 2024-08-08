import { renderHook, waitFor } from '@testing-library/react';

import { RefObject } from 'react';

import { useChatViewAutoScroll } from '../useChatViewAutoScroll';

interface ExtendedRefObject<T> extends RefObject<T> {
  resizeObserver?: MockResizeObserver;
}

class MockResizeObserver {
  constructor(callback: () => unknown) {
    this.callback = callback;
  }

  callback: () => unknown;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  triggerResize() {
    this.callback();
  }
}

function createResizeObserverMock() {
  let mockInstance: MockResizeObserver | undefined;

  window.ResizeObserver = vi.fn().mockImplementation((callback) => {
    mockInstance = new MockResizeObserver(callback);
    return mockInstance;
  });

  return {
    get instance() {
      if (!mockInstance) {
        throw new Error('MockResizeObserver has not been initialized');
      }
      return mockInstance;
    },
  };
}

describe('useChatViewAutoScroll', () => {
  let chatContainerRef: ExtendedRefObject<HTMLDivElement>;
  let chatMessagesRef: ExtendedRefObject<HTMLDivElement>;

  // Replace the original observer with the Fake
  let originalResizeObserver: typeof ResizeObserver;
  beforeAll(() => {
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = vi
      .fn()
      .mockImplementation((callback) => new MockResizeObserver(callback));
  });

  afterAll(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    chatContainerRef = { current: document.createElement('div') };
    chatMessagesRef = { current: document.createElement('div') };

    // Mocking the size of chatContainerRef
    Object.defineProperty(chatContainerRef.current, 'clientHeight', {
      value: 500,
      writable: true,
    });
    Object.defineProperty(chatContainerRef.current, 'scrollHeight', {
      value: 1000,
      writable: true,
    });
    Object.defineProperty(chatContainerRef.current, 'scrollTop', {
      value: 0,
      writable: true,
    });
    Object.defineProperty(chatContainerRef.current, 'scrollTo', {
      value: vi.fn(),
      writable: true,
    });
  });

  test('initial state', () => {
    const { result } = renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 0, false),
    );

    expect(result.current.showScrollDownButton).toBe(false);
  });

  test('scrollToContainerHeight', () => {
    const { result } = renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 0, false),
    );

    result.current.scrollToContainerHeight();

    expect(chatContainerRef.current!.scrollTo).toHaveBeenCalledWith({
      top: chatContainerRef.current!.scrollHeight,
      behavior: undefined,
    });
  });

  test('setAutoScroll', () => {
    const { result } = renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 0, false),
    );

    result.current.setAutoScroll(true);

    expect(result.current.showScrollDownButton).toBe(false);
  });

  test('scrollDown', () => {
    const { result } = renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 0, false),
    );

    result.current.handleScrollDown();

    expect(result.current.showScrollDownButton).toBe(false);
  });

  test('handleScroll call from ResizeObserver', async () => {
    const resizeObserverMock = createResizeObserverMock();

    const { result } = renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 1, false),
    );

    resizeObserverMock.instance.triggerResize();

    await waitFor(() => {
      expect(result.current.showScrollDownButton).toBe(false);
    });

    chatContainerRef.current!.scrollTop = 400;

    resizeObserverMock.instance.triggerResize();

    await waitFor(() => {
      expect(result.current.showScrollDownButton).toBe(true);
    });

    chatContainerRef.current!.scrollTop = 200;

    resizeObserverMock.instance.triggerResize();

    await waitFor(() => {
      expect(result.current.showScrollDownButton).toBe(true);
    });
  });

  test('handleScroll', async () => {
    const { result } = renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 0, false),
    );

    expect(result.current.showScrollDownButton).toBe(false);

    // Simulate scroll event
    chatContainerRef.current!.scrollTop = 200;
    result.current.handleScroll();

    await waitFor(() => {
      expect(result.current.showScrollDownButton).toBe(true);
    });
  });

  test('observeResize', () => {
    const resizeObserverMock = createResizeObserverMock();

    const { rerender } = renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 0, false),
    );

    expect(resizeObserverMock.instance).toBeDefined();
    expect(resizeObserverMock.instance.observe).toHaveBeenCalledWith(
      chatContainerRef.current,
    );

    // Trigger the useEffect that sets up the resize observer
    rerender();

    expect(resizeObserverMock.instance.observe).toHaveBeenCalledWith(
      chatContainerRef.current,
    );
  });

  test('useEffect side effects', () => {
    renderHook(() =>
      useChatViewAutoScroll(chatContainerRef, chatMessagesRef, 1, false),
    );

    expect(chatContainerRef.current!.scrollTo).toHaveBeenCalledWith({
      top: chatContainerRef.current!.scrollHeight,
    });
  });
});
