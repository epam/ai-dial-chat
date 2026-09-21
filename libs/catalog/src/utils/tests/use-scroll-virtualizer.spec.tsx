import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollVirtualizer } from '../use-scroll-virtualizer';

const renderProbe = vi.fn();
const observers = new Set<{
  callback: () => void;
  elements: Set<Element>;
}>();
let width = 1100;
let viewportHeight = 600;
let scrollOffset = 0;

const Probe = () => {
  const { containerRef, columnCount, startRow, endRow, totalHeight } =
    useScrollVirtualizer(1000);
  useEffect(() => {
    renderProbe();
  });
  return (
    <div role="region" aria-label="Results" style={{ overflowY: 'auto' }}>
      <div ref={containerRef} role="grid" aria-label="Cards">
        <output aria-label="Columns">{columnCount}</output>
        <output aria-label="Rows">{`${startRow}:${endRow}`}</output>
        <output aria-label="Height">{totalHeight}</output>
      </div>
    </div>
  );
};

const resize = (element: Element) => {
  act(() => {
    for (const observer of observers) {
      if (observer.elements.has(element)) observer.callback();
    }
  });
};

describe('useScrollVirtualizer', () => {
  beforeEach(() => {
    width = 1100;
    viewportHeight = 600;
    scrollOffset = 0;
    renderProbe.mockClear();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      () => width,
    );
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
      () => viewportHeight,
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return {
          top:
            this.getAttribute('aria-label') === 'Results' ? 0 : -scrollOffset,
        } as DOMRect;
      },
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        elements = new Set<Element>();
        constructor(public callback: () => void) {
          observers.add(this);
        }
        observe(element: Element) {
          this.elements.add(element);
        }
        disconnect() {
          observers.delete(this);
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    observers.clear();
  });

  it('preserves the measured layout while hidden and reuses it when shown', () => {
    render(<Probe />);
    const grid = screen.getByRole('grid', { name: 'Cards' });
    const scroller = screen.getByRole('region', { name: 'Results' });
    expect(screen.getByLabelText('Columns').textContent).toBe('3');
    const rows = screen.getByLabelText('Rows').textContent;
    const height = screen.getByLabelText('Height').textContent;
    const renders = renderProbe.mock.calls.length;

    width = 0;
    resize(grid);
    fireEvent.scroll(scroller);
    expect(screen.getByLabelText('Columns').textContent).toBe('3');
    expect(screen.getByLabelText('Rows').textContent).toBe(rows);
    expect(screen.getByLabelText('Height').textContent).toBe(height);
    expect(renderProbe).toHaveBeenCalledTimes(renders);

    width = 1100;
    resize(grid);
    expect(renderProbe).toHaveBeenCalledTimes(renders);
  });

  it('does not rerender cards for scroll events inside the same row window', () => {
    render(<Probe />);
    const scroller = screen.getByRole('region', { name: 'Results' });
    const renders = renderProbe.mock.calls.length;
    scrollOffset = 30;
    fireEvent.scroll(scroller);
    scrollOffset = 60;
    fireEvent.scroll(scroller);
    expect(renderProbe).toHaveBeenCalledTimes(renders);

    scrollOffset = 2680;
    fireEvent.scroll(scroller);
    expect(screen.getByLabelText('Rows').textContent).toBe('7:16');
  });

  it('recalculates columns when revealed at a different width', () => {
    render(<Probe />);
    const grid = screen.getByRole('grid', { name: 'Cards' });
    width = 0;
    resize(grid);
    width = 360;
    resize(grid);
    expect(screen.getByLabelText('Columns').textContent).toBe('1');

    width = 900;
    resize(grid);
    expect(screen.getByLabelText('Columns').textContent).toBe('2');
  });

  it('updates the visible window when only the scroll viewport height changes', () => {
    render(<Probe />);
    expect(screen.getByLabelText('Rows').textContent).toBe('0:9');
    viewportHeight = 1200;
    resize(screen.getByRole('region', { name: 'Results' }));
    expect(screen.getByLabelText('Rows').textContent).toBe('0:11');
  });

  it('keeps the initial estimate when mounted hidden until real dimensions exist', () => {
    width = 0;
    render(<Probe />);
    const renders = renderProbe.mock.calls.length;
    const columns = screen.getByLabelText('Columns').textContent;
    resize(screen.getByRole('grid', { name: 'Cards' }));
    expect(renderProbe).toHaveBeenCalledTimes(renders);
    expect(screen.getByLabelText('Columns').textContent).toBe(columns);

    width = 1100;
    resize(screen.getByRole('grid', { name: 'Cards' }));
    expect(screen.getByLabelText('Columns').textContent).toBe('3');
    expect(screen.getByLabelText('Rows').textContent).toBe('0:9');
  });
});
