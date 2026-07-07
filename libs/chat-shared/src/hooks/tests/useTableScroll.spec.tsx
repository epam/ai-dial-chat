import { act, fireEvent, render, screen } from '@testing-library/react';
import { type FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTableScroll } from '../../../../chat-shared/src/hooks/useTableScroll';

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

const TestTableScroll: FC<{ direction?: 'ltr' | 'rtl' }> = ({
  direction = 'ltr',
}) => {
  const {
    scrollContainerRef,
    tableRef,
    hasContentBeyondStart,
    hasContentBeyondEnd,
    handleScroll,
  } = useTableScroll();

  return (
    <div
      ref={scrollContainerRef}
      role="region"
      aria-label="scroll container"
      data-has-content-beyond-start={hasContentBeyondStart}
      data-has-content-beyond-end={hasContentBeyondEnd}
      style={{ direction }}
      onScroll={handleScroll}
    >
      <table ref={tableRef}>
        <tbody>
          <tr>
            <td>Value</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const setHorizontalMeasurements = ({
  direction,
  position,
}: {
  direction: 'ltr' | 'rtl';
  position: 'start' | 'middle' | 'end';
}) => {
  const scrollContainer = screen.getByRole('region', {
    name: 'scroll container',
  });
  const table = screen.getByRole('table');

  Object.defineProperties(scrollContainer, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 400 },
  });
  vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(
    direction === 'rtl'
      ? ({
          left: position === 'start' ? -200 : position === 'middle' ? -100 : 0,
          right: position === 'start' ? 200 : position === 'middle' ? 300 : 400,
        } as DOMRect)
      : ({
          left: position === 'start' ? 0 : position === 'middle' ? -100 : -200,
          right: position === 'start' ? 400 : position === 'middle' ? 300 : 200,
        } as DOMRect),
  );

  return scrollContainer;
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useTableScroll', () => {
  it.each(['ltr', 'rtl'] as const)(
    'tracks content beyond both logical edges in %s',
    (direction) => {
      render(<TestTableScroll direction={direction} />);
      const scrollContainer = setHorizontalMeasurements({
        direction,
        position: 'start',
      });

      act(() => resizeObserverCallback([], {} as ResizeObserver));

      expect(scrollContainer.dataset.hasContentBeyondStart).toBe('false');
      expect(scrollContainer.dataset.hasContentBeyondEnd).toBe('true');

      vi.restoreAllMocks();
      setHorizontalMeasurements({ direction, position: 'middle' });
      fireEvent.scroll(scrollContainer);

      expect(scrollContainer.dataset.hasContentBeyondStart).toBe('true');
      expect(scrollContainer.dataset.hasContentBeyondEnd).toBe('true');

      vi.restoreAllMocks();
      setHorizontalMeasurements({ direction, position: 'end' });
      fireEvent.scroll(scrollContainer);

      expect(scrollContainer.dataset.hasContentBeyondStart).toBe('true');
      expect(scrollContainer.dataset.hasContentBeyondEnd).toBe('false');
    },
  );
});
