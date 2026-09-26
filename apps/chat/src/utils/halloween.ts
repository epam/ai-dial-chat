import type { CSSProperties } from 'react';
import {
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_BAT_COUNT,
  HALLOWEEN_WITCH_COUNT,
  HALLOWEEN_WISP_COUNT,
  HALLOWEEN_SPIDER_COUNT,
} from '../constants/halloween';
import { HalloweenGhostVariant } from '../types/halloween';
import { buildFlyingCharacterPaths } from './flying-characters';

/** Public class hooks of the composer and starter list that scenes anchor to. */
export interface HalloweenAnchorClasses {
  composer: string;
  starterList?: string;
}

let anchorClasses: Promise<HalloweenAnchorClasses> | undefined;

/**
 * Loads the anchor classes once. A StrictMode rehearsal, the real mount and
 * later scenes share one pending import instead of racing duplicate ones.
 */
export const loadHalloweenAnchorClasses =
  (): Promise<HalloweenAnchorClasses> => {
    anchorClasses ??= (async () => {
      const [composer, starters] = await Promise.allSettled([
        import('@epam/ai-dial-conversation-input'),
        import('@epam/ai-dial-starter-buttons'),
      ]);
      return {
        composer:
          composer.status === 'fulfilled'
            ? composer.value.CONVERSATION_INPUT_CLASS.wrapper
            : '',
        starterList:
          starters.status === 'fulfilled'
            ? starters.value.STARTER_BUTTONS_CLASS.list
            : undefined,
      };
    })();
    return anchorClasses;
  };

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

/** A point in viewport pixels. */
interface Point {
  x: number;
  y: number;
}

interface SpiderFleeInput {
  /** Where the spider sits when undisturbed, in viewport pixels. */
  perch: Point;
  /** The pointer, in viewport pixels. */
  pointer: Point;
  /** The spider's current displacement from its perch. */
  offset: Point;
  /** How close the pointer gets before the spider bolts. */
  fleeRadius: number;
  /** How far the spider bolts per nudge. */
  fleeStep: number;
  /** How far the spider may stray from its perch. */
  maxOffset: number;
}

/**
 * The spider's next displacement from its perch, or `null` when the pointer
 * is far enough away that it has no reason to move.
 *
 * It bolts straight along the line away from the pointer, which is what makes
 * a chase work: the cursor pushes and the spider gives ground. Clamping the
 * result to `maxOffset` is a circle, not a box, so a spider herded against
 * the boundary keeps whatever part of the push runs along it and slides round
 * instead of stopping dead. A push aimed exactly at the centre has no such
 * component and does hold it against the leash, which is the one way to
 * corner it.
 *
 * A pointer exactly on the spider has no direction to flee along, so it
 * breaks the tie diagonally rather than dividing by zero.
 */
export const nextHalloweenSpiderOffset = ({
  perch,
  pointer,
  offset,
  fleeRadius,
  fleeStep,
  maxOffset,
}: SpiderFleeInput): Point | null => {
  const position = { x: perch.x + offset.x, y: perch.y + offset.y };
  const awayX = position.x - pointer.x;
  const awayY = position.y - pointer.y;
  const distance = Math.hypot(awayX, awayY);
  if (distance > fleeRadius) return null;

  const isTie = distance < 1;
  const stepX = isTie ? fleeStep * Math.SQRT1_2 : (awayX / distance) * fleeStep;
  const stepY = isTie ? fleeStep * Math.SQRT1_2 : (awayY / distance) * fleeStep;

  const nextX = offset.x + stepX;
  const nextY = offset.y + stepY;
  const strayed = Math.hypot(nextX, nextY);
  if (strayed <= maxOffset) return { x: nextX, y: nextY };

  return {
    x: (nextX / strayed) * maxOffset,
    y: (nextY / strayed) * maxOffset,
  };
};

/** Where an idle drop has the spider: thread paid out and pendulum angle. */
export interface HalloweenSpiderDanglePose {
  depth: number;
  angle: number;
}

const smoothstep = (from: number, to: number, value: number): number => {
  const progress = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return progress * progress * (3 - 2 * progress);
};

/**
 * The pose `progress` (0–1) of the way through an idle drop: the spider pays
 * out its thread, swings a little as it stops, hangs, and climbs back up.
 * Evaluated rather than read back from the page, so an interrupted drop can
 * reel in from exactly where it is.
 */
export const getHalloweenSpiderDanglePose = (
  depth: number,
  progress: number,
): HalloweenSpiderDanglePose => {
  const paidOut =
    smoothstep(0, 0.27, progress) * (1 - smoothstep(0.62, 1, progress));
  const swinging =
    smoothstep(0.2, 0.3, progress) * (1 - smoothstep(0.5, 0.64, progress));
  return {
    depth: depth * paidOut,
    angle: Math.sin((progress - 0.2) * Math.PI * 7) * 7 * swinging,
  };
};

/** Pendulum transform: rotate about the anchor, then hang down the thread. */
export const getHalloweenSpiderDangleTransform = ({
  depth,
  angle,
}: HalloweenSpiderDanglePose): string =>
  `rotate(${angle.toFixed(2)}deg) translateY(${depth.toFixed(2)}px)`;

/** Keyframes for the spider and its thread, which share one timeline. */
export const buildHalloweenSpiderDangle = (
  depth: number,
): { dangle: Keyframe[]; thread: Keyframe[] } => {
  const steps = 48;
  const poses = Array.from({ length: steps + 1 }, (_, index) => ({
    offset: index / steps,
    pose: getHalloweenSpiderDanglePose(depth, index / steps),
  }));
  return {
    dangle: poses.map(({ offset, pose }) => ({
      offset,
      transform: getHalloweenSpiderDangleTransform(pose),
    })),
    thread: poses.map(({ offset, pose }) => ({
      offset,
      transform: `scaleY(${pose.depth.toFixed(2)})`,
    })),
  };
};

/** A random value in a `[min, max)` range tuple. */
export const pickHalloweenRange = ([min, max]: readonly [number, number]) =>
  between(min, max);

export const buildHalloweenBatFlight = (): CSSProperties[] =>
  buildFlyingCharacterPaths({
    count: HALLOWEEN_BAT_COUNT,
    sizesPx: [30, 35, 40, 45],
    durationSeconds: 5.8,
    staggerSeconds: 0.18,
  }).map(
    (style, index) =>
      ({
        ...style,
        '--wing-duration': `${0.24 + (index % 4) * 0.04}s`,
      }) as CSSProperties,
  );

export const buildHalloweenWitchFlight = (): CSSProperties[] =>
  buildFlyingCharacterPaths({
    count: HALLOWEEN_WITCH_COUNT,
    sizesPx: [76, 88, 100],
    durationSeconds: 7.5,
    staggerSeconds: 0.62,
  });

/** Dim little lights rise from separate columns, leaving the UI readable. */
export const buildHalloweenWisps = (): CSSProperties[] =>
  Array.from(
    { length: HALLOWEEN_WISP_COUNT },
    (_, index) =>
      ({
        '--wisp-x': `${5 + (index / HALLOWEEN_WISP_COUNT) * 90}vw`,
        '--wisp-rest-y': `${18 + (index % 6) * 11}vh`,
        '--wisp-delay': `${(index * 0.16).toFixed(2)}s`,
        '--wisp-drift': `${index % 2 === 0 ? 32 : -32}px`,
        '--wisp-color': ['#e8bd70', '#b6a0ff', '#83d6bb'][index % 3],
      }) as CSSProperties,
  );
