import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectCapacityMeter } from '../ProjectCapacityMeter';

const renderMeter = (usedBytes: number, maxBytes = 10_485_760) =>
  render(
    <ProjectCapacityMeter
      usedBytes={usedBytes}
      maxBytes={maxBytes}
      ariaLabel="Context capacity"
      formatLabel={(percent) => `${percent}% of capacity used`}
    />,
  );

describe('ProjectCapacityMeter', () => {
  it('renders nothing while no capacity is used', () => {
    renderMeter(0);

    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('exposes the used share as a meter with a text value', () => {
    renderMeter(1_048_576);

    const meter = screen.getByRole('meter', { name: 'Context capacity' });
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('10485760');
    expect(meter.getAttribute('aria-valuenow')).toBe('1048576');
    expect(meter.getAttribute('aria-valuetext')).toBe('10% of capacity used');
    expect(screen.getByText('10% of capacity used')).toBeTruthy();
  });

  it('reports a small but non-zero use as 1%, never 0%', () => {
    renderMeter(35_722);

    expect(screen.getByText('1% of capacity used')).toBeTruthy();
  });

  it('renders the meter as the kit ProgressBar', () => {
    renderMeter(1_048_576);

    expect(
      screen
        .getByRole('meter', { name: 'Context capacity' })
        .classList.contains('dial-kit-progress-bar'),
    ).toBe(true);
  });

  it('clamps aria-valuenow at the capacity when the files exceed it', () => {
    renderMeter(30, 20);

    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('20');
  });

  it('clamps the percentage at 100', () => {
    renderMeter(30, 20);

    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
      '100% of capacity used',
    );
  });
});
