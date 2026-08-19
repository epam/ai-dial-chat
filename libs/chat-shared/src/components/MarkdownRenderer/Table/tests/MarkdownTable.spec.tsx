import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownTable } from '../MarkdownTable';

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

const renderTable = (props?: Partial<Parameters<typeof MarkdownTable>[0]>) =>
  render(
    <MarkdownTable classNames={{}} {...props}>
      <thead>
        <tr>
          <th>Name</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Alpha</td>
        </tr>
      </tbody>
    </MarkdownTable>,
  );

const makeScrollable = (hasContentBeyondEnd: boolean) => {
  const table = screen.getByRole('table');
  /*
   * The scroll container has no accessible role/name when content fits (it
   * only gains role="region" once scrollable), so it cannot be reached with
   * a semantic query — DOM traversal from the table is the only option.
   */
  // eslint-disable-next-line testing-library/no-node-access
  const scrollContainer = table.parentElement as HTMLElement;

  Object.defineProperties(scrollContainer, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 400 },
  });
  vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(
    hasContentBeyondEnd
      ? ({ left: 0, right: 400 } as DOMRect)
      : ({ left: 0, right: 200 } as DOMRect),
  );

  act(() => resizeObserverCallback([], {} as ResizeObserver));
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MarkdownTable', () => {
  it('renders without a scroll region role when content fits', () => {
    renderTable();
    makeScrollable(false);

    const table = screen.getByRole('table');
    // eslint-disable-next-line testing-library/no-node-access -- see makeScrollable above: no accessible role/name exists when content fits
    const scrollContainer = table.parentElement as HTMLElement;

    expect(scrollContainer.getAttribute('role')).toBeNull();
    expect(scrollContainer.getAttribute('tabindex')).toBeNull();
  });

  it('marks the container as a labelled, keyboard-reachable scroll region when content overflows', () => {
    renderTable({ scrollRegionAriaLabel: 'Scrollable table' });
    makeScrollable(true);

    const region = screen.getByRole('region', { name: 'Scrollable table' });
    expect(region.getAttribute('tabindex')).toBe('0');
  });
});
