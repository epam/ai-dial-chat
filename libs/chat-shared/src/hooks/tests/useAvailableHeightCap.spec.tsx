import { render, screen } from '@testing-library/react';
import { type FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESIZABLE_FIELD_MAX_HEIGHT_CSS_VARIABLE } from '../../constants/resizable-fields';
import {
  useAvailableHeightCap,
  type UseAvailableHeightCapOptions,
} from '../useAvailableHeightCap';

let resizeObserverCallback: ResizeObserverCallback | undefined;

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

const CAPPED_FIELD_LABEL = 'capped field';
const SCROLL_CONTAINER_LABEL = 'scroll container';

const TestAvailableHeightCap: FC<{
  options?: UseAvailableHeightCapOptions;
}> = ({ options }) => {
  const capRef = useAvailableHeightCap<HTMLDivElement>(options);

  return (
    <div
      role="region"
      aria-label={SCROLL_CONTAINER_LABEL}
      style={{ overflowY: 'auto' }}
    >
      <div ref={capRef} role="group" aria-label={CAPPED_FIELD_LABEL} />
    </div>
  );
};

/**
 * JSDOM reports every box as 0×0, so both the container geometry and the
 * element's position have to be stubbed for the measurement to mean anything.
 */
const stubGeometry = ({
  containerClientHeight,
  containerScrollTop = 0,
  containerTop = 0,
  elementTop,
}: {
  containerClientHeight: number;
  containerScrollTop?: number;
  containerTop?: number;
  elementTop: number;
}) => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute('aria-label') === SCROLL_CONTAINER_LABEL
        ? containerClientHeight
        : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'scrollTop', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute('aria-label') === SCROLL_CONTAINER_LABEL
        ? containerScrollTop
        : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const top =
        this.getAttribute('aria-label') === SCROLL_CONTAINER_LABEL
          ? containerTop
          : elementTop;

      return { top } as DOMRect;
    },
  );
};

const getCappedField = (): HTMLElement =>
  screen.getByRole('group', { name: CAPPED_FIELD_LABEL });

const readCap = (): string =>
  getCappedField().style.getPropertyValue(
    RESIZABLE_FIELD_MAX_HEIGHT_CSS_VARIABLE,
  );

describe('useAvailableHeightCap', () => {
  beforeEach(() => {
    resizeObserverCallback = undefined;
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('caps the field at the space left below it in the scroll container', () => {
    stubGeometry({ containerClientHeight: 900, elementTop: 400 });

    render(<TestAvailableHeightCap />);

    /* 900 visible − 400 taken by the fields above − the 16px default gap. */
    expect(readCap()).toBe('484px');
  });

  it('ignores how far the form happens to be scrolled', () => {
    stubGeometry({
      containerClientHeight: 900,
      containerScrollTop: 250,
      elementTop: 150,
    });

    render(<TestAvailableHeightCap />);

    /* The element sits 150 + 250 = 400 into the content, as in the case above. */
    expect(readCap()).toBe('484px');
  });

  it('measures the element relative to the container, not the viewport', () => {
    stubGeometry({
      containerClientHeight: 900,
      containerTop: 120,
      elementTop: 400,
    });

    render(<TestAvailableHeightCap />);

    expect(readCap()).toBe('604px');
  });

  it('falls back to the minimum height for a field below the fold', () => {
    stubGeometry({ containerClientHeight: 400, elementTop: 380 });

    render(<TestAvailableHeightCap />);

    expect(readCap()).toBe('200px');
  });

  it('honours the bottom gap and minimum height passed by the caller', () => {
    stubGeometry({ containerClientHeight: 900, elementTop: 400 });

    render(
      <TestAvailableHeightCap options={{ bottomGap: 40, minHeight: 500 }} />,
    );

    /* 900 − 400 − 40 = 460, below the caller's own floor of 500. */
    expect(readCap()).toBe('500px');
  });

  it('re-measures when the scroll container resizes', () => {
    stubGeometry({ containerClientHeight: 900, elementTop: 400 });

    render(<TestAvailableHeightCap />);

    expect(readCap()).toBe('484px');

    vi.restoreAllMocks();
    stubGeometry({ containerClientHeight: 600, elementTop: 400 });
    resizeObserverCallback?.([], {} as ResizeObserver);

    expect(readCap()).toBe('200px');
  });

  it('re-measures before a drag starts, when content above may have moved it', () => {
    stubGeometry({ containerClientHeight: 900, elementTop: 400 });

    render(<TestAvailableHeightCap />);

    expect(readCap()).toBe('484px');

    vi.restoreAllMocks();
    stubGeometry({ containerClientHeight: 900, elementTop: 600 });
    getCappedField().dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true }),
    );

    expect(readCap()).toBe('284px');
  });
});
