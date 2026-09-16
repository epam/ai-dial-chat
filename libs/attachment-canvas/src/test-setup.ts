// Vitest setup for attachment-canvas
import { vi } from 'vitest';

vi.mock('@epam/pdf-highlighter-kit', () => ({
  PDFHighlightViewer: () => null,
}));

vi.mock('@epam/ai-dial-react-pdf-highlighter', () => ({
  DocumentPreview: () => null,
  PageThumbnail: () => null,
}));

/** One constructed `ResizeObserver` mock instance, tracked so a test can deliver a size change to it. */
interface MockResizeObserverInstance {
  observer: ResizeObserver;
  callback: ResizeObserverCallback;
  elements: Set<Element>;
}

const mockResizeObserverInstances: MockResizeObserverInstance[] = [];

class MockResizeObserver implements ResizeObserver {
  private readonly elements = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    mockResizeObserverInstances.push({
      observer: this,
      callback,
      elements: this.elements,
    });
  }

  observe(target: Element) {
    this.elements.add(target);
  }

  unobserve(target: Element) {
    this.elements.delete(target);
  }

  disconnect() {
    this.elements.clear();
  }
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

const buildResizeObserverEntry = (
  target: Element,
  contentRect: Partial<DOMRectReadOnly> = {},
): ResizeObserverEntry => {
  const rect: DOMRectReadOnly = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
    ...contentRect,
  };
  return {
    target,
    contentRect: rect,
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
};

/**
 * Delivers a synthetic resize entry to every mock `ResizeObserver` instance
 * currently observing `target`, mirroring how a real observer fans a single
 * size change out to each of its observers.
 */
export const deliverResizeObserverEntry = (
  target: Element,
  contentRect: Partial<DOMRectReadOnly> = {},
) => {
  const entry = buildResizeObserverEntry(target, contentRect);
  mockResizeObserverInstances
    .filter((instance) => instance.elements.has(target))
    .forEach((instance) => instance.callback([entry], instance.observer));
};

/** Clears tracked mock `ResizeObserver` instances so they do not leak between test files. */
export const resetResizeObserverMock = () => {
  mockResizeObserverInstances.length = 0;
};

/** Whether any live mock `ResizeObserver` instance is currently observing `target`. */
export const isElementObservedByResizeObserver = (target: Element): boolean =>
  mockResizeObserverInstances.some((instance) => instance.elements.has(target));
