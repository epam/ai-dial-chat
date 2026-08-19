import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopicsLine, TopicTag } from '../TopicTag';

describe('TopicTag', () => {
  it('renders the label text', () => {
    render(<TopicTag label="Free" />);
    expect(screen.getByText('Free')).toBeTruthy();
  });
});

/*
 * jsdom doesn't run a real layout engine, so offsetLeft/offsetWidth/
 * clientWidth are always 0. TopicsLine measures these synchronously in a
 * useLayoutEffect on mount, so the stub has to be in place on the
 * HTMLElement prototype *before* the component renders (there's no
 * external "measurement callback" to invoke manually the way a
 * ResizeObserver-driven hook would have).
 */
let widthConfig: { container: number; child: number; gap: number } | null =
  null;
let originalDescriptors: Record<string, PropertyDescriptor | undefined>;

beforeEach(() => {
  originalDescriptors = {
    clientWidth: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    ),
    offsetWidth: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    ),
    offsetLeft: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetLeft',
    ),
  };

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return widthConfig?.container ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return widthConfig?.child ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    /*
     * Not a test assertion — this getter stands in for the browser layout
     * engine jsdom lacks, so it has to walk the DOM directly to compute a
     * synthetic offsetLeft.
     */
    get(this: HTMLElement) {
      // eslint-disable-next-line testing-library/no-node-access
      if (!widthConfig || !this.parentElement) return 0;
      // eslint-disable-next-line testing-library/no-node-access
      const index = Array.from(this.parentElement.children).indexOf(this);
      return index * (widthConfig.child + widthConfig.gap);
    },
  });
});

afterEach(() => {
  widthConfig = null;
  (['clientWidth', 'offsetWidth', 'offsetLeft'] as const).forEach((prop) => {
    const original = originalDescriptors[prop];
    if (original) {
      Object.defineProperty(HTMLElement.prototype, prop, original);
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[
        prop
      ];
    }
  });
});

describe('TopicsLine', () => {
  it('renders every tag on one line when they all fit', () => {
    widthConfig = { container: 400, child: 60, gap: 8 };
    render(<TopicsLine topics={['Alpha', 'Beta']} />);

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.queryByLabelText(/and \d+ more topics/)).toBeNull();
  });

  it('collapses overflowing tags into a "+N" badge instead of wrapping', () => {
    // Container only fits ~2 tags at 60px each with an 8px gap.
    widthConfig = { container: 140, child: 60, gap: 8 };
    render(<TopicsLine topics={['Alpha', 'Beta', 'Gamma', 'Delta']} />);

    expect(screen.getByText('+3')).toBeTruthy();
    expect(screen.getByLabelText('and 3 more topics')).toBeTruthy();
    expect(screen.queryByText('Gamma')).toBeNull();
  });

  it('uses a custom overflowAriaLabel when provided', () => {
    // Fits Alpha (right edge 60) and Beta (right edge 128) but not Gamma
    // (right edge 196) — one visible tag, two collapsed into the badge.
    widthConfig = { container: 150, child: 60, gap: 8 };
    render(
      <TopicsLine
        topics={['Alpha', 'Beta', 'Gamma']}
        overflowAriaLabel={(count) => `${count} hidden`}
      />,
    );

    expect(screen.getByLabelText('2 hidden')).toBeTruthy();
  });

  it('renders nothing when there are no topics', () => {
    widthConfig = { container: 400, child: 60, gap: 8 };
    const { container } = render(<TopicsLine topics={[]} />);
    expect(container.firstElementChild?.children.length).toBe(0);
  });

  it('never wraps to a second row (single-line container classes)', () => {
    widthConfig = { container: 400, child: 60, gap: 8 };
    const { container } = render(<TopicsLine topics={['Alpha']} />);
    // Root is an unlabelled layout div; asserting its class list is a
    // CSS-level check with no semantic query available.
    // eslint-disable-next-line testing-library/no-node-access
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('flex-nowrap');
    expect(root.className).toContain('overflow-hidden');
  });
});
