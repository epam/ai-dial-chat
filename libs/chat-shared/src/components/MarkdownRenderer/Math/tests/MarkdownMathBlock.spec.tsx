import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownMathBlock } from '../MarkdownMathBlock';

let resizeObserverCallback: ResizeObserverCallback;

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }

  observe() {
    // No-op in JSDOM.
  }
  unobserve() {
    // No-op in JSDOM.
  }
  disconnect() {
    // No-op in JSDOM.
  }
}

/*
 * The scroll container and the KaTeX span are presentational wrappers with no
 * accessible role until the formula overflows, so the rendered tree is walked
 * directly rather than queried semantically.
 */
const renderMathBlock = () => {
  const { container } = render(
    <MarkdownMathBlock scrollRegionAriaLabel="Scrollable formula">
      <span>formula</span>
    </MarkdownMathBlock>,
  );
  // eslint-disable-next-line testing-library/no-node-access
  const scrollContainer = container.firstElementChild as HTMLElement;
  // eslint-disable-next-line testing-library/no-node-access
  const content = scrollContainer.firstElementChild as HTMLElement;

  return { scrollContainer, content };
};

/** Makes the content 400px wide inside a 200px container, scrolled to the start. */
const simulateOverflow = (
  scrollContainer: HTMLElement,
  content: HTMLElement,
) => {
  Object.defineProperties(scrollContainer, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 400 },
  });
  vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 400,
  } as DOMRect);
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MarkdownMathBlock', () => {
  it('renders the formula in a scrollable container without adding a tab stop when it fits', () => {
    const { scrollContainer } = renderMathBlock();

    act(() => resizeObserverCallback([], {} as ResizeObserver));

    expect(scrollContainer.className).toContain('overflow-x-auto');
    expect(scrollContainer.getAttribute('role')).toBeNull();
    expect(scrollContainer.getAttribute('aria-label')).toBeNull();
    expect(scrollContainer.getAttribute('tabindex')).toBeNull();
  });

  it('exposes an overflowing formula as a labelled, keyboard-reachable region', () => {
    const { scrollContainer, content } = renderMathBlock();
    simulateOverflow(scrollContainer, content);

    act(() => resizeObserverCallback([], {} as ResizeObserver));

    expect(scrollContainer.getAttribute('role')).toBe('region');
    expect(scrollContainer.getAttribute('aria-label')).toBe(
      'Scrollable formula',
    );
    expect(scrollContainer.getAttribute('tabindex')).toBe('0');
  });
});
