import { render, screen } from '@testing-library/react';
import type { FC } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useIsTextClipped } from '../useIsTextClipped';

const VISIBLE_WIDTH = 100;

/* jsdom never lays text out, so every element reports a scrollWidth and a
   clientWidth of 0. The hook only ever compares those two numbers, so stubbing
   them on the prototype is enough to drive it through both outcomes. */
const stubWidths = (scrollWidth: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => VISIBLE_WIDTH,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  });
};

const restoreWidths = () => {
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
};

interface ProbeProps {
  isMeasuring: boolean;
  text: string;
}

const Probe: FC<ProbeProps> = ({ isMeasuring, text }) => {
  const { ref, isClipped } = useIsTextClipped<HTMLSpanElement>(
    isMeasuring,
    text,
  );

  return (
    <>
      <span ref={ref}>{text}</span>
      <output>{String(isClipped)}</output>
    </>
  );
};

const readIsClipped = () => screen.getByRole('status').textContent;

describe('useIsTextClipped', () => {
  afterEach(restoreWidths);

  it('reports nothing clipped when the text fits its box', () => {
    stubWidths(VISIBLE_WIDTH);
    render(<Probe isMeasuring text="Short" />);

    expect(readIsClipped()).toBe('false');
  });

  it('reports nothing clipped when the overflow is sub-pixel rounding', () => {
    stubWidths(VISIBLE_WIDTH + 0.5);
    render(<Probe isMeasuring text="Short" />);

    expect(readIsClipped()).toBe('false');
  });

  it('reports clipped text when the content overruns its box', () => {
    stubWidths(VISIBLE_WIDTH * 3);
    render(<Probe isMeasuring text="A much longer announcement" />);

    expect(readIsClipped()).toBe('true');
  });

  /* The caller turns measuring off precisely because it has stopped clipping
     the text; re-measuring there would report "nothing hidden" and retract the
     control the reader just used. */
  it('keeps the last clipped reading once measuring is switched off', () => {
    stubWidths(VISIBLE_WIDTH * 3);
    const { rerender } = render(
      <Probe isMeasuring text="A much longer announcement" />,
    );

    stubWidths(VISIBLE_WIDTH);
    rerender(<Probe isMeasuring={false} text="A much longer announcement" />);

    expect(readIsClipped()).toBe('true');
  });

  it('re-measures when the text changes without the box resizing', () => {
    stubWidths(VISIBLE_WIDTH);
    const { rerender } = render(<Probe isMeasuring text="Short" />);
    expect(readIsClipped()).toBe('false');

    stubWidths(VISIBLE_WIDTH * 3);
    rerender(<Probe isMeasuring text="A much longer announcement" />);

    expect(readIsClipped()).toBe('true');
  });
});
