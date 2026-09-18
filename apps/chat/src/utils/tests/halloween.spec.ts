import { describe, expect, it } from 'vitest';
import {
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_SPIDER_COUNT,
} from '../../constants/halloween';
import { HalloweenGhostVariant } from '../../types/halloween';
import {
  buildHalloweenGhostFlight,
  buildHalloweenSpiderDrop,
  isHalloweenSecretPhrase,
} from '../halloween';

describe('isHalloweenSecretPhrase', () => {
  it('matches the phrase regardless of case, punctuation, and padding', () => {
    expect(isHalloweenSecretPhrase('trick or treat')).toBe(true);
    expect(isHalloweenSecretPhrase('  Trick Or Treat!  ')).toBe(true);
    expect(isHalloweenSecretPhrase('trick-or-treat')).toBe(true);
    expect(isHalloweenSecretPhrase('TRICK   OR   TREAT???')).toBe(true);
  });

  it('does not match a message that merely contains the phrase', () => {
    expect(
      isHalloweenSecretPhrase('what does trick or treat mean in Belarus?'),
    ).toBe(false);
    expect(isHalloweenSecretPhrase('trick or treats')).toBe(false);
  });

  it('does not match unrelated or empty input', () => {
    expect(isHalloweenSecretPhrase('')).toBe(false);
    expect(isHalloweenSecretPhrase('   ')).toBe(false);
    expect(isHalloweenSecretPhrase('treat or trick')).toBe(false);
  });
});

describe('buildHalloweenSpiderDrop', () => {
  const readVar = (drop: { style: object }, name: string) =>
    (drop.style as Record<string, string>)[name];

  it('lays out the configured number of spiders', () => {
    expect(buildHalloweenSpiderDrop()).toHaveLength(HALLOWEEN_SPIDER_COUNT);
  });

  it('gives every spider its own column, left to right', () => {
    const columns = buildHalloweenSpiderDrop().map((drop) =>
      Number.parseFloat(readVar(drop, '--spider-x')),
    );

    expect(new Set(columns).size).toBe(HALLOWEEN_SPIDER_COUNT);
    columns.slice(1).forEach((column, index) => {
      expect(column).toBeGreaterThan(columns[index]);
    });
    /* Inside the viewport: a thread anchored off-screen never shows. */
    columns.forEach((column) => {
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThan(100);
    });
  });

  it('varies thread length, size and pace between spiders', () => {
    const drop = buildHalloweenSpiderDrop();

    (
      ['--spider-depth', '--spider-scale', '--spider-duration'] as const
    ).forEach((name) => {
      const values = new Set(drop.map((spider) => readVar(spider, name)));
      expect(values.size).toBeGreaterThan(1);
    });
  });
});

describe('buildHalloweenGhostFlight', () => {
  it('lays out the configured number of ghosts', () => {
    expect(buildHalloweenGhostFlight()).toHaveLength(HALLOWEEN_GHOST_COUNT);
  });

  it('mixes the silhouettes so neighbours differ', () => {
    const flight = buildHalloweenGhostFlight();

    expect(new Set(flight.map((ghost) => ghost.variant)).size).toBe(
      Math.min(
        HALLOWEEN_GHOST_COUNT,
        Object.keys(HalloweenGhostVariant).length,
      ),
    );
    flight.slice(1).forEach((ghost, index) => {
      expect(ghost.variant).not.toBe(flight[index].variant);
    });
  });

  it('alternates the entry edge so ghosts cross in both directions', () => {
    const flight = buildHalloweenGhostFlight();
    const entersFromLeft = flight.map((ghost) =>
      String(
        (ghost.style as Record<string, string>)['--ghost-from-x'],
      ).startsWith('-'),
    );

    expect(entersFromLeft).toContain(true);
    expect(entersFromLeft).toContain(false);
  });

  it('starts and ends every flight off-screen', () => {
    const readVw = (value: string) => Number.parseFloat(value);

    buildHalloweenGhostFlight().forEach((ghost) => {
      const style = ghost.style as Record<string, string>;
      const from = readVw(style['--ghost-from-x']);
      const to = readVw(style['--ghost-to-x']);

      expect(from < 0 || from > 100).toBe(true);
      expect(to < 0 || to > 100).toBe(true);
      /* Entry and exit on opposite sides — otherwise the ghost turns around
         instead of crossing. */
      expect(Math.sign(from) === Math.sign(to) && from > 0 && to > 0).toBe(
        false,
      );
    });
  });

  it('gives every ghost its own path', () => {
    const flight = buildHalloweenGhostFlight();
    const paths = flight.map((ghost) => JSON.stringify(ghost.style));

    expect(new Set(paths).size).toBe(HALLOWEEN_GHOST_COUNT);
  });
});
