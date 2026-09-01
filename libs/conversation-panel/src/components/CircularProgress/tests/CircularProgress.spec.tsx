import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CircularProgress } from '../CircularProgress';

const renderProgress = (
  props?: Partial<React.ComponentProps<typeof CircularProgress>>,
) =>
  render(
    <CircularProgress
      value={0}
      ariaLabel="Exporting my-chat.dial"
      {...props}
    />,
  );

/**
 * The indicator arc is the second circle; the first is the unfilled track.
 * Stroke geometry is the whole point of this component and has no semantic
 * query, so reading the SVG child directly is the only way to assert it.
 */
const getIndicator = (): SVGCircleElement => {
  const circles = screen
    .getByRole('progressbar')
    // eslint-disable-next-line testing-library/no-node-access -- see above
    .querySelectorAll<SVGCircleElement>('circle');
  return circles[1];
};

const getDashOffset = (): number =>
  Number(getIndicator().getAttribute('stroke-dashoffset'));

const getCircumference = (): number =>
  Number(getIndicator().getAttribute('stroke-dasharray'));

describe('CircularProgress', () => {
  it('leaves the arc empty at 0', () => {
    renderProgress({ value: 0 });

    expect(getDashOffset()).toBeCloseTo(getCircumference());
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '0',
    );
  });

  it('fills a quarter of the ring at 25', () => {
    renderProgress({ value: 25 });

    expect(getDashOffset()).toBeCloseTo(getCircumference() * 0.75);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '25',
    );
  });

  it('closes the ring at 100', () => {
    renderProgress({ value: 100 });

    expect(getDashOffset()).toBeCloseTo(0);
  });

  it('clamps a value outside the range', () => {
    const { rerender } = renderProgress({ value: 140 });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '100',
    );

    rerender(<CircularProgress value={-20} ariaLabel="Exporting" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '0',
    );
  });

  it('exposes the min and max a screen reader needs', () => {
    renderProgress({ value: 40 });

    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('is never anonymous', () => {
    renderProgress({ ariaLabel: 'Exporting my-chat.dial' });

    expect(
      screen.getByRole('progressbar', { name: 'Exporting my-chat.dial' }),
    ).toBeTruthy();
  });

  it('sets aria-valuetext only when the caller supplies one', () => {
    const { rerender } = renderProgress({ value: 30 });
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuetext')).toBe(
      false,
    );

    rerender(
      <CircularProgress
        value={30}
        ariaLabel="Exporting"
        ariaValueText="3 of 10 attachments"
      />,
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      '3 of 10 attachments',
    );
  });

  it('does not mirror itself under dir="rtl"', () => {
    render(
      <div dir="rtl">
        <CircularProgress value={25} ariaLabel="Exporting" />
      </div>,
    );

    const svg = screen.getByRole('progressbar');
    /* Only the shared -90deg start-at-twelve rotation; no rtl: flip variant. */
    expect(svg.getAttribute('class')).toBe('-rotate-90');
  });
});
