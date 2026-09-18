import { describe, expect, it } from 'vitest';
import {
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_TREAT_COUNT,
} from '../../constants/halloween';
import { HalloweenGhostVariant } from '../../types/halloween';
import {
  buildHalloweenGhostFlight,
  buildHalloweenTreats,
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

describe('buildHalloweenTreats', () => {
  it('lays out the configured number of glyphs', () => {
    expect(buildHalloweenTreats()).toHaveLength(HALLOWEEN_TREAT_COUNT);
  });

  it('cycles through every glyph', () => {
    const glyphs = new Set(buildHalloweenTreats().map((treat) => treat.glyph));
    expect(glyphs.size).toBeGreaterThan(1);
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
