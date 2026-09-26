import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildFlyingCharacterPaths } from '../../../utils/flying-characters';
import FlyingCharacters from '../FlyingCharacters';

/* Decorative flight positions have no accessible role; inspect geometry only. */
const flightElements = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelectorAll<HTMLElement>('[style*="--flight-start-x"]');

const Character = () => <svg role="img" aria-label="Test character" />;

const options = {
  count: 4,
  sizesPx: [40, 80],
  durationSeconds: 6,
  staggerSeconds: 0.5,
};

describe('FlyingCharacters', () => {
  it('keeps all decorative characters outside the accessibility tree', () => {
    render(
      <FlyingCharacters
        flights={buildFlyingCharacterPaths(options)}
        Character={Character}
      />,
    );

    expect(screen.queryByRole('img', { name: 'Test character' })).toBeNull();
    expect(flightElements()).toHaveLength(4);
  });

  it('preserves flight paths when its parent rerenders', () => {
    const flights = buildFlyingCharacterPaths(options);
    const { rerender } = render(
      <FlyingCharacters flights={flights} Character={Character} />,
    );
    const initial = Array.from(
      flightElements(),
      (element) => element.style.cssText,
    );

    rerender(<FlyingCharacters flights={flights} Character={Character} />);

    expect(
      Array.from(flightElements(), (element) => element.style.cssText),
    ).toEqual(initial);
  });
});

describe('buildFlyingCharacterPaths', () => {
  it('crosses both screen edges and places reduced-motion characters inside the viewport', () => {
    const paths = buildFlyingCharacterPaths(options) as Record<
      string,
      string
    >[];
    expect(new Set(paths.map((path) => path['--flight-facing'])).size).toBe(2);
    paths.forEach((path) => {
      const endpoints = [
        parseFloat(path['--flight-start-x']),
        parseFloat(path['--flight-end-x']),
      ];
      expect(Math.min(...endpoints)).toBeLessThan(0);
      expect(Math.max(...endpoints)).toBeGreaterThan(100);
      expect(parseFloat(path['--flight-rest-x'])).toBeGreaterThan(0);
      expect(parseFloat(path['--flight-rest-x'])).toBeLessThan(100);
      expect(parseFloat(path['--flight-rest-y'])).toBeGreaterThan(0);
      expect(parseFloat(path['--flight-rest-y'])).toBeLessThan(100);
    });
  });
});
