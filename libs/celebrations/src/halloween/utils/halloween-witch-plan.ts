import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { HALLOWEEN_WITCH_SCENE_DURATION_MS } from '../constants/halloween';
import type { WitchTargets } from './halloween-witch-targets';

/** Finite story duration, before the provider's cleanup margin. */
export const WITCH_SCENE_MS = HALLOWEEN_WITCH_SCENE_DURATION_MS;
/** Normalized instant when the original controls reappear. */
export const WITCH_RESTORE = 0.83;
/** The snapshot helper finishes restoring source opacity four percent later. */
export const WITCH_HANDOFF_END = WITCH_RESTORE + 0.04;
/** Hard budget for all scene and snapshot animations together. */
export const WITCH_ANIMATION_LIMIT = 48;
/** Hard budget for an individual precomputed track. */
export const WITCH_KEYFRAME_LIMIT = 160;

/** Articulated parts of each decorative witch. */
export enum WitchPart {
  Arm = 'arm',
  Head = 'head',
  Hat = 'hat',
  Cloak = 'cloak',
  Gaze = 'gaze',
  Broom = 'broom',
  Frog = 'frog',
  Rider = 'rider',
}

interface Point {
  x: number;
  y: number;
}
interface Pose extends Point {
  time: number;
  angle?: number;
  opacity?: number;
  easing?: WitchEasing;
}
enum WitchEasing {
  Smooth = 'cubic-bezier(0.45, 0, 0.55, 1)',
  Settle = 'cubic-bezier(0.22, 1, 0.36, 1)',
  Impulse = 'cubic-bezier(0.55, 0, 1, 0.45)',
  Linear = 'linear',
  Hold = 'steps(1, end)',
}
interface Hop {
  from: number;
  to: number;
  start: Point;
  end: Point;
  height: number;
}
interface WitchActor {
  mentor: boolean;
  size: number;
  facing: number;
  rest: Point;
  frames: Keyframe[];
  parts: Record<WitchPart, Keyframe[]>;
}
interface WitchButton {
  target: CelebrationSnapshotTarget;
  entry: number;
  frames: Keyframe[];
  frogFrames: Keyframe[];
  legFrames: Keyframe[];
  hops: Hop[];
}
interface Spell {
  frames: Keyframe[];
  mentor: boolean;
}

/** All immutable geometry/tracks for one spell lesson. */
export interface WitchPlan {
  /** Measured composer and borrowed controls to watch for changes. */
  anchors: CelebrationSnapshotTarget[];
  /** Two independently articulated characters. */
  actors: WitchActor[];
  /** Bounded button copies, empty for the broom-only story. */
  buttons: WitchButton[];
  /** Small travelling spell marks, without particles or filters. */
  spells: Spell[];
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));
const offset = (ms: number) => ms / WITCH_SCENE_MS;
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (x: number, y: number): Point => ({ x, y });
const visibility = (from: number, to: number): Keyframe[] => [
  { offset: 0, opacity: 0 },
  { offset: offset(from), opacity: 0 },
  { offset: offset(from + 180), opacity: 1 },
  { offset: offset(to - 180), opacity: 1 },
  { offset: offset(to), opacity: 0 },
  { offset: 1, opacity: 0 },
];
const rotations = (poses: [number, number, WitchEasing?][]): Keyframe[] =>
  poses.map(([time, angle, easing = WitchEasing.Smooth]) => ({
    offset: offset(time),
    transform: `rotate(${angle}deg)`,
    easing,
  }));
const travel = (poses: Pose[]): Keyframe[] =>
  poses.map(
    ({ time, x, y, angle = 0, opacity = 1, easing = WitchEasing.Smooth }) => ({
      offset: offset(time),
      transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
      opacity,
      easing,
    }),
  );

/* Sample only finite flight arcs. Linear interpolation between samples avoids
   restarting an easing curve at every point of a continuous flight. */
const flight = (
  from: Pose,
  to: Pose,
  lift: number,
  arriving: boolean,
): Pose[] =>
  Array.from({ length: 17 }, (_, index) => {
    const t = index / 16;
    const progress = arriving ? 1 - (1 - t) ** 3 : t * t;
    return {
      time: mix(from.time, to.time, t),
      x: mix(from.x, to.x, progress),
      y: mix(from.y, to.y, progress) - 4 * lift * progress * (1 - progress),
      angle: mix(from.angle ?? 0, to.angle ?? 0, progress),
      opacity: mix(from.opacity ?? 1, to.opacity ?? 1, progress),
      easing: index === 16 ? WitchEasing.Settle : WitchEasing.Linear,
    };
  });

const PUPIL_CAST_ANGLE = -62;
const BROOM_CAST_ANGLE = 32;
const MENTOR_CAST_ANGLE = -55;
/* Artwork coordinates: the arm pivots at (98,82), the hand is (140,94),
   and the actor's world origin is SVG (90,120). Casting poses hold still. */
const handPoint = (
  origin: Point,
  size: number,
  facing: number,
  angle: number,
) => {
  const radians = (angle * Math.PI) / 180;
  return point(
    origin.x +
      (facing * (8 + 42 * Math.cos(radians) - 12 * Math.sin(radians)) * size) /
        180,
    origin.y +
      ((-38 + 42 * Math.sin(radians) + 12 * Math.cos(radians)) * size) / 180,
  );
};
const broomPoint = (origin: Point, size: number) =>
  point(origin.x + (size * 80) / 180, origin.y);

const buttonPlan = (
  target: CelebrationSnapshotTarget,
  index: number,
  targets: WitchTargets,
  stageY: number,
): WitchButton => {
  const { rect } = target;
  const origin = point(rect.left + rect.width / 2, rect.top + rect.height / 2);
  const margin = rect.width / 2 + 22;
  const center = targets.composer
    ? targets.composer.rect.left + targets.composer.rect.width / 2
    : targets.width / 2;
  const landing = point(
    clamp(center + (index ? 85 : -25), margin, targets.width - margin),
    clamp(stageY + 90 + index * 62, 120, targets.height - rect.height / 2 - 40),
  );
  const other = point(
    clamp(landing.x + (index ? -90 : 75), margin, targets.width - margin),
    landing.y,
  );
  const ledge = point(
    clamp(center + (index ? -60 : 50), margin, targets.width - margin),
    clamp(stageY - rect.height / 2 + 10, 100, targets.height - 80),
  );
  const delay = index * 320;
  const hops: Hop[] = [
    {
      from: 6500 + delay,
      to: 7550 + delay,
      start: point(origin.x, origin.y - 22),
      end: landing,
      height: 62,
    },
    {
      from: 8300 + delay,
      to: 9350 + delay,
      start: landing,
      end: other,
      height: 56,
    },
    {
      from: 10500 + delay,
      to: 11700 + delay,
      start: other,
      end: ledge,
      height: 80,
    },
    {
      from: 12800 + delay,
      to: 13500 + delay,
      start: ledge,
      end: ledge,
      height: 28,
    },
    {
      from: 15200 + delay / 2,
      to: 16400,
      start: ledge,
      end: origin,
      height: 45,
    },
  ];
  const entry = 4500 + index * 900;
  const frames: Keyframe[] = [];
  const legs: Keyframe[] = [{ offset: 0, transform: 'scaleY(1)' }];
  const add = (
    time: number,
    p: Point,
    sx = 1,
    sy = 1,
    opacity = 1,
    easing = WitchEasing.Linear,
  ) =>
    frames.push({
      offset: offset(time),
      opacity,
      transform: `translate(${p.x - origin.x}px, ${p.y - origin.y}px) scale(${sx}, ${sy})`,
      easing,
    });
  /* Cover the source before its fade-out; return ownership only after fade-in.
     A crossfade of two translucent copies otherwise dims the original label. */
  add(0, origin, 1, 1, 0, WitchEasing.Hold);
  add(entry - WITCH_SCENE_MS * 0.01, origin);
  add(entry, origin, 1, 1, 1, WitchEasing.Settle);
  add(entry + 650, point(origin.x, origin.y - 22));
  for (const hop of hops) {
    add(hop.from - 180, hop.start, 1, 1, 1, WitchEasing.Impulse);
    add(hop.from, hop.start, 1.06, 0.88);
    legs.push(
      { offset: offset(hop.from - 180), transform: 'scaleY(1)' },
      { offset: offset(hop.from), transform: 'scaleY(0.65)' },
    );
    const returning = hop === hops.at(-1);
    for (let step = 1; step <= 14; step++) {
      const t = step / 14;
      const position = point(
        mix(hop.start.x, hop.end.x, returning ? ease(t) : t),
        mix(hop.start.y, hop.end.y, t) - 4 * hop.height * t * (1 - t),
      );
      add(
        mix(hop.from, hop.to, t),
        position,
        step === 14 ? 1.07 : mix(0.97, 1, Math.sin(Math.PI * t)),
        step === 14 ? 0.88 : mix(1.06, 1, Math.sin(Math.PI * t)),
        1,
        step === 14 ? WitchEasing.Settle : WitchEasing.Linear,
      );
    }
    add(hop.to + 90, hop.end, 0.99, 1.02, 1, WitchEasing.Settle);
    add(hop.to + 190, hop.end);
    legs.push(
      { offset: offset(hop.from + 130), transform: 'scaleY(1.35)' },
      { offset: offset(hop.to), transform: 'scaleY(0.65)' },
      { offset: offset(hop.to + 90), transform: 'scaleY(1.06)' },
      { offset: offset(hop.to + 190), transform: 'scaleY(1)' },
    );
  }
  add(WITCH_RESTORE * WITCH_SCENE_MS, origin, 1, 1, 1, WitchEasing.Hold);
  add(WITCH_HANDOFF_END * WITCH_SCENE_MS, origin, 1, 1, 0);
  add(20000, origin, 1, 1, 0);
  legs.push({ offset: 1, transform: 'scaleY(1)' });
  return {
    target,
    entry: offset(entry),
    frames,
    frogFrames: visibility(5900 + delay, 16600),
    legFrames: legs,
    hops,
  };
};

/** Precompute a complete lesson, including a broom-only fallback and exact returns. */
export const buildWitchPlan = (
  targets: WitchTargets,
  isMobile: boolean,
): WitchPlan => {
  const { width, height, composer } = targets;
  const size = Math.min(isMobile ? 112 : 146, width * 0.32, height * 0.27);
  const center = composer
    ? composer.rect.left + composer.rect.width / 2
    : width / 2;
  const stageY = clamp(
    composer ? composer.rect.top - 8 : height * 0.48,
    size + 28,
    height - 155,
  );
  const pupil = point(
    clamp(center - size * 0.85, size * 0.6, width - size * 0.6),
    stageY,
  );
  const teacher = point(
    clamp(center + size * 0.85, size * 0.6, width - size * 0.6),
    stageY - 24,
  );
  const buttons = targets.buttons
    .slice(0, isMobile ? 1 : 2)
    .map((target, index) => buttonPlan(target, index, targets, stageY));
  const chase = buttons[0]?.hops[2];
  const herd = chase
    ? point(
        chase.start.x -
          buttons[0].target.rect.width / 2 -
          (size * 80) / 180 -
          5,
        chase.start.y + buttons[0].target.rect.height / 2,
      )
    : point(pupil.x + 16, pupil.y + 42);
  herd.x = clamp(herd.x, size * 0.55, width - size * 0.55);
  const actors = [false, true].map((mentor): WitchActor => {
    const rest = mentor ? teacher : pupil;
    const facing = mentor ? -1 : 1;
    const parts: Record<WitchPart, Keyframe[]> = {
      [WitchPart.Arm]: rotations(
        mentor
          ? [
              [0, 0],
              [14000, 0, WitchEasing.Settle],
              [14350, 10, WitchEasing.Settle],
              [14600, MENTOR_CAST_ANGLE],
              [14800, MENTOR_CAST_ANGLE],
              [15600, -48, WitchEasing.Settle],
              [16400, 0],
              [20000, 0],
            ]
          : [
              [0, 0],
              [3200, 0],
              [3540, 20, WitchEasing.Impulse],
              [3900, PUPIL_CAST_ANGLE],
              [4120, PUPIL_CAST_ANGLE, WitchEasing.Settle],
              [4500, -42],
              [4700, 12, WitchEasing.Impulse],
              [4900, PUPIL_CAST_ANGLE],
              [5050, PUPIL_CAST_ANGLE, WitchEasing.Settle],
              [5450, -42],
              [5950, 0],
              [9600, 0],
              [10200, 25],
              [10500, 25, WitchEasing.Settle],
              [11100, -15],
              [11700, -70, WitchEasing.Impulse],
              [12100, BROOM_CAST_ANGLE],
              [12300, BROOM_CAST_ANGLE, WitchEasing.Settle],
              [12600, 12],
              [12820, 12, WitchEasing.Impulse],
              [13000, -65, WitchEasing.Settle],
              [13600, -20],
              [14800, 0],
              [17600, 0],
              [18050, 0, WitchEasing.Impulse],
              [18250, -95, WitchEasing.Settle],
              [18650, -75],
              [19300, 0],
              [20000, 0],
            ],
      ),
      [WitchPart.Head]: rotations(
        mentor
          ? [
              [0, 0],
              [5700, 0],
              [6400, -6],
              [10500, -6],
              [11500, 6],
              [13000, 6],
              [14000, 18],
              [14700, 18],
              [15800, 0],
              [20000, 0],
            ]
          : [
              [0, 0],
              [1900, -12],
              [2300, 6],
              [3000, 0],
              [4800, -18],
              [5800, -18],
              [6700, 15],
              [9500, 8],
              [12000, 8],
              [12700, 28],
              [13100, 35],
              [13800, 20],
              [15400, 20],
              [16300, 30],
              [17700, 20],
              [18200, 20, WitchEasing.Impulse],
              [18350, -15, WitchEasing.Settle],
              [19000, 0],
              [20000, 0],
            ],
      ),
      [WitchPart.Hat]: rotations([
        [0, -10],
        [mentor ? 2700 : 1950, -10],
        [mentor ? 2940 : 2260, mentor ? 4 : 12, WitchEasing.Settle],
        [mentor ? 3170 : 2710, -3, WitchEasing.Settle],
        [3350, 0],
        [6000, 0],
        [6770, mentor ? 0 : -12, WitchEasing.Settle],
        [7060, mentor ? 0 : 4, WitchEasing.Settle],
        [7500, 0],
        [12850, 0],
        [13200, mentor ? 0 : -17, WitchEasing.Settle],
        [13720, mentor ? 0 : 6, WitchEasing.Settle],
        [14900, 0],
        [17600, 0],
        [18260, 0],
        [18460, mentor ? 0 : -25, WitchEasing.Settle],
        [18820, 4, WitchEasing.Settle],
        [19500, 0],
        [20000, -8],
      ]),
      [WitchPart.Cloak]: rotations([
        [0, -14],
        [mentor ? 2700 : 2100, -14],
        [mentor ? 3060 : 2390, mentor ? 4 : 9, WitchEasing.Settle],
        [mentor ? 3300 : 2850, -3, WitchEasing.Settle],
        [3500, 0],
        [9800, 0],
        [10580, mentor ? 0 : -13, WitchEasing.Settle],
        [11250, mentor ? 0 : 4, WitchEasing.Settle],
        [12000, 0],
        [12950, 0],
        [13350, mentor ? 0 : -12, WitchEasing.Settle],
        [14200, mentor ? 0 : 4, WitchEasing.Settle],
        [15200, 0],
        [17700, 0],
        [18380, mentor ? -4 : -13],
        [18950, mentor ? -8 : 4],
        [20000, -18],
      ]),
      [WitchPart.Gaze]: [0, 4800, 6300, 13800, 16000, 20000].map((time, i) => ({
        offset: offset(time),
        transform: `translateX(${mentor ? (i > 2 ? -1 : 1) : [1, -2, 2, 2, -2, 1][i]}px)`,
      })),
      [WitchPart.Broom]: rotations(
        mentor
          ? [
              [0, 0],
              [20000, 0],
            ]
          : [
              [0, 0],
              [5000, 0],
              [5250, buttons.length ? 0 : -10, WitchEasing.Settle],
              [5500, buttons.length ? 0 : 5, WitchEasing.Settle],
              [5900, 0],
              [9600, 0],
              [9950, 12, WitchEasing.Impulse],
              [10300, 0],
              [10500, 0, WitchEasing.Settle],
              [10800, -12, WitchEasing.Settle],
              [11400, 5],
              [11900, 0],
              [12720, 0, WitchEasing.Impulse],
              [12920, -18, WitchEasing.Settle],
              [13280, 10, WitchEasing.Settle],
              [13700, -8, WitchEasing.Settle],
              [14300, 3, WitchEasing.Settle],
              [15300, 0],
              [17800, 0, WitchEasing.Impulse],
              [18020, -15, WitchEasing.Settle],
              [18350, 8, WitchEasing.Settle],
              [18750, -3, WitchEasing.Settle],
              [19200, 0],
              [20000, 0],
            ],
      ),
      [WitchPart.Frog]: mentor
        ? [{ opacity: 0 }, { opacity: 0 }]
        : visibility(buttons.length ? 12600 : 4500, 19000),
      [WitchPart.Rider]: mentor
        ? [{ transform: 'translateY(0px)' }, { transform: 'translateY(0px)' }]
        : [
            0, 12780, 13040, 13400, 13880, 14600, 15300, 17900, 18180, 18550,
            19000, 20000,
          ].map((time, i) => ({
            offset: offset(time),
            transform: `translateY(${[0, 0, -9, 5, -11, 3, 0, 0, -15, 4, 0, 0][i]}px)`,
            easing: 'ease-in-out',
          })),
    };
    const poses: Pose[] = mentor
      ? [
          { time: 0, x: width + size, y: rest.y - 50, opacity: 0 },
          ...flight(
            { time: 500, x: width + size, y: rest.y - 50, angle: -5 },
            { time: 2800, ...rest },
            size * 0.2,
            true,
          ),
          ...flight(
            { time: 17600, ...rest },
            { time: 19900, x: -size, y: rest.y - 90, angle: -8, opacity: 0 },
            size * 0.35,
            false,
          ),
          { time: 20000, x: -size, y: rest.y - 90, opacity: 0 },
        ]
      : [
          { time: 0, x: -size, y: rest.y - 40, opacity: 0 },
          ...flight(
            { time: 300, x: -size, y: rest.y - 40, angle: -8 },
            { time: 2100, x: rest.x + 42, y: rest.y - 10, angle: 12 },
            size * 0.48,
            true,
          ),
          {
            time: 2490,
            x: rest.x - 5,
            y: rest.y + 3,
            angle: -4,
            easing: WitchEasing.Settle,
          },
          { time: 2950, ...rest },
          { time: 9200, ...rest },
          {
            time: 9660,
            x: rest.x - 10,
            y: rest.y - 6,
            angle: -6,
            easing: WitchEasing.Impulse,
          },
          { time: 10300, ...herd },
          { time: 10500, ...herd, easing: WitchEasing.Settle },
          { time: 11400, ...herd, angle: -8 },
          { time: 11900, ...herd },
          { time: 12780, ...herd, easing: WitchEasing.Impulse },
          {
            time: 13000,
            x: herd.x,
            y: herd.y - 28,
            angle: -12,
            easing: WitchEasing.Settle,
          },
          {
            time: 13420,
            x: herd.x + 8,
            y: herd.y + 4,
            angle: 7,
            easing: WitchEasing.Settle,
          },
          { time: 13900, x: herd.x + 6, y: herd.y - 9, angle: -3 },
          { time: 15100, ...rest },
          { time: 17800, ...rest, easing: WitchEasing.Impulse },
          {
            time: 18050,
            x: rest.x + 14,
            y: rest.y - 24,
            angle: -10,
            easing: WitchEasing.Settle,
          },
          {
            time: 18450,
            x: rest.x + 28,
            y: rest.y + 3,
            angle: 6,
            easing: WitchEasing.Settle,
          },
          ...flight(
            { time: 18800, x: rest.x + 32, y: rest.y, angle: 0 },
            {
              time: 19900,
              x: width + size,
              y: rest.y - 85,
              angle: -5,
              opacity: 0,
            },
            size * 0.42,
            false,
          ),
          { time: 20000, x: width + size, y: rest.y - 85, opacity: 0 },
        ];
    return { mentor, size, facing, rest, frames: travel(poses), parts };
  });
  const spell = (
    start: Point,
    end: Point,
    time: number,
    mentor: boolean,
  ): Spell => ({
    mentor,
    frames: travel([
      { time: 0, ...start, opacity: 0 },
      { time, ...start, opacity: 0 },
      { time: time + 80, ...start, easing: WitchEasing.Impulse },
      { time: time + 500, ...end },
      { time: time + 700, ...end, opacity: 0 },
      { time: 20000, ...end, opacity: 0 },
    ]),
  });
  const pupilHand = handPoint(pupil, size, 1, PUPIL_CAST_ANGLE);
  const teacherHand = handPoint(teacher, size, -1, MENTOR_CAST_ANGLE);
  const spells = buttons.map(({ target }, index) =>
    spell(
      pupilHand,
      point(target.rect.left + target.rect.width / 2, target.rect.top),
      4000 + index * 900,
      false,
    ),
  );
  if (!buttons.length)
    spells.push(spell(pupilHand, broomPoint(pupil, size), 4000, false));
  spells.push(
    spell(
      handPoint(herd, size, 1, BROOM_CAST_ANGLE),
      broomPoint(herd, size),
      12100,
      false,
    ),
  );
  spells.push(spell(teacherHand, point(center, stageY), 14600, true));
  return {
    actors,
    buttons,
    spells,
    anchors: [
      ...(composer ? [composer] : []),
      ...buttons.map(({ target }) => target),
    ],
  };
};
