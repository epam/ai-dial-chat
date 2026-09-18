import type { CSSProperties } from 'react';
import {
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_SECRET_PHRASE,
  HALLOWEEN_SPIDER_COUNT,
} from '../constants/halloween';
import { HalloweenGhostVariant } from '../types/halloween';

/**
 * Collapses anything that is not a latin letter into single spaces, so
 * "Trick-or-Treat!" and "trick  or  treat" both reach the stored phrase.
 */
const normalizePhrase = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();

/**
 * Whether `text` is the Halloween easter egg's secret phrase, ignoring case,
 * punctuation, and surrounding whitespace. Deliberately an exact match on the
 * whole input: a message that merely mentions the phrase still sends normally.
 */
export const isHalloweenSecretPhrase = (text: string): boolean =>
  normalizePhrase(text) === HALLOWEEN_SECRET_PHRASE;

/** A random float in `[min, max)`. */
const between = (min: number, max: number): number =>
  min + Math.random() * (max - min);

/** One abseiling spider of a `HalloweenBurst.Spiders` celebration. */
export interface HalloweenSpiderDrop {
  /** Custom properties consumed by `.spiderDrop` in `Halloween.module.scss`. */
  style: CSSProperties;
}

/**
 * Lays out one drop. Each spider gets its own column, thread length, size,
 * pace, sway and start delay, so they arrive as a scatter rather than a
 * curtain. `--spider-depth` is both the thread's length and the distance the
 * pair travels, which is what keeps the thread anchored to the top edge for
 * the whole descent.
 *
 * Called once per burst rather than per render: the layer re-renders on every
 * ancestor state change, and re-rolling the offsets would restart each
 * spider's descent halfway down.
 */
export const buildHalloweenSpiderDrop = (): HalloweenSpiderDrop[] =>
  Array.from({ length: HALLOWEEN_SPIDER_COUNT }, (_, index) => {
    /* One spider per column, jittered inside it, so nine threads spread
       across the viewport instead of clumping wherever chance puts them. */
    const columnWidth = 92 / HALLOWEEN_SPIDER_COUNT;

    return {
      style: {
        '--spider-x': `${(4 + index * columnWidth + between(0, columnWidth * 0.6)).toFixed(1)}%`,
        '--spider-depth': `${between(18, 72).toFixed(1)}vh`,
        '--spider-scale': between(0.6, 1.25).toFixed(2),
        '--spider-sway': `${between(4, 11).toFixed(1)}deg`,
        '--spider-sway-duration': `${between(1.8, 3.2).toFixed(2)}s`,
        '--spider-duration': `${between(4.6, 6.4).toFixed(2)}s`,
        '--spider-delay': `${between(0, 1.8).toFixed(2)}s`,
      } as CSSProperties,
    };
  });

const GHOST_VARIANTS = Object.values(HalloweenGhostVariant);

/** One ghost of a `HalloweenBurst.Ghost` celebration, with its flight path. */
export interface HalloweenGhostFlight {
  variant: HalloweenGhostVariant;
  /** Custom properties consumed by `.ghost` in `Halloween.module.scss`. */
  style: CSSProperties;
}

/**
 * Lays out one flock. Every ghost gets its own entry edge, arc, size, tilt and
 * pace, so the flock reads as individuals rather than a row: it enters from
 * off-screen left or right at a random height, curves upward across the
 * viewport, and leaves past the opposite edge.
 *
 * `--ghost-rest-*` is where the ghost sits when animations are suppressed for
 * reduced motion — spread across the viewport instead of stacked at the
 * origin, which is where an un-animated element would otherwise sit.
 *
 * Distances are in `vw`/`vh` so a flight crosses the viewport at any size, and
 * the path is deliberately direction-agnostic (each ghost picks its own side),
 * so nothing here needs to flip under RTL.
 */
export const buildHalloweenGhostFlight = (): HalloweenGhostFlight[] =>
  Array.from({ length: HALLOWEEN_GHOST_COUNT }, (_, index) => {
    const isEnteringFromLeft = index % 2 === 0;
    const fromX = isEnteringFromLeft ? between(-40, -22) : between(112, 130);
    const toX = isEnteringFromLeft ? between(112, 130) : between(-40, -22);
    const fromY = between(6, 82);
    /* Clamped so a ghost that drifts up still crosses the viewport rather
       than skimming above it. */
    const toY = Math.min(Math.max(fromY + between(-34, 22), -8), 88);
    /* Pulling the midpoint above the straight line turns the flight into an
       arc — the difference between drifting and sliding. */
    const midY = (fromY + toY) / 2 - between(8, 24);
    const scale = between(0.55, 1.15);

    return {
      variant: GHOST_VARIANTS[index % GHOST_VARIANTS.length],
      style: {
        '--ghost-from-x': `${fromX.toFixed(1)}vw`,
        '--ghost-from-y': `${fromY.toFixed(1)}vh`,
        '--ghost-mid-x': `${between(42, 58).toFixed(1)}vw`,
        '--ghost-mid-y': `${midY.toFixed(1)}vh`,
        '--ghost-to-x': `${toX.toFixed(1)}vw`,
        '--ghost-to-y': `${toY.toFixed(1)}vh`,
        /* Evenly spaced columns so the reduced-motion flock does not overlap. */
        '--ghost-rest-x': `${(8 + index * (76 / HALLOWEEN_GHOST_COUNT)).toFixed(1)}vw`,
        '--ghost-rest-y': `${fromY.toFixed(1)}vh`,
        '--ghost-scale-from': scale.toFixed(2),
        '--ghost-scale-mid': (scale * between(1.05, 1.3)).toFixed(2),
        '--ghost-scale-to': (scale * between(0.7, 0.95)).toFixed(2),
        '--ghost-tilt': `${between(-14, 14).toFixed(1)}deg`,
        '--ghost-opacity': between(0.5, 0.85).toFixed(2),
        '--ghost-duration': `${between(5.2, 8).toFixed(2)}s`,
        '--ghost-delay': `${between(0, 1.6).toFixed(2)}s`,
        '--ghost-bob-duration': `${between(1.6, 2.8).toFixed(2)}s`,
      } as CSSProperties,
    };
  });
