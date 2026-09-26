import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { HALLOWEEN_BAT_SCENE_DURATION_MS } from '../constants/halloween';
import type { BatTargets } from './halloween-bat-targets';

export const BAT_SCENE_MS = HALLOWEEN_BAT_SCENE_DURATION_MS;
export const BAT_RESTORE = 0.8;

export enum BatPart {
  WingLeft = 'wing-left',
  WingRight = 'wing-right',
  ForearmLeft = 'forearm-left',
  ForearmRight = 'forearm-right',
  Wrap = 'wrap',
  Sleep = 'sleep',
  Eye = 'eye',
  Yawn = 'yawn',
  Gaze = 'gaze',
}

interface Point {
  x: number;
  y: number;
}

interface BatPose {
  offset: number;
  point: Point;
  rotation: number;
  opacity: number;
}

export interface BatActor {
  size: number;
  sleeper: boolean;
  /** Position of the claws, SVG point (50,66), not the centre of the artwork. */
  rest: Point;
  frames: Keyframe[];
  parts: Record<BatPart, Keyframe[]>;
}

interface BatImpact {
  time: number;
  strength: number;
  launch: number;
  helper: number;
}

export interface BatSurface {
  target: CelebrationSnapshotTarget;
  origin: string;
  entry: number;
  frames: Keyframe[];
  impacts: BatImpact[];
}

export interface BatPlan {
  active: boolean;
  width: number;
  height: number;
  composer?: CelebrationSnapshotTarget;
  perch?: CelebrationSnapshotTarget;
  actors: BatActor[];
  surfaces: BatSurface[];
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));
const distance = (from: Point, to: Point) =>
  Math.hypot(to.x - from.x, to.y - from.y);
const pointOn = (rect: DOMRect): Point => ({
  x: rect.left + rect.width / 2,
  y: rect.bottom,
});
const pose = (
  offset: number,
  point: Point,
  rotation = 0,
  opacity = 1,
): BatPose => ({
  offset,
  opacity,
  point,
  rotation,
});
const shown = (from: number, to: number): Keyframe[] => [
  { offset: 0, opacity: 0 },
  { offset: from, opacity: 0 },
  { offset: from + 0.015, opacity: 1 },
  { offset: to, opacity: 1 },
  { offset: Math.min(1, to + 0.015), opacity: 0 },
  { offset: 1, opacity: 0 },
];
const constant = (opacity: number): Keyframe[] => [
  { offset: 0, opacity },
  { offset: 1, opacity },
];

const smooth = (from: number, to: number, time: number) => {
  const t = clamp((time - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/* Continuous tangents carry momentum through flight knots. Dwells and turns
   settle to zero velocity instead of restarting easing at every orbit sample. */
const smoothFlight = (poses: BatPose[]): Keyframe[] => {
  const knots = poses.map(({ offset, point, rotation, opacity }) => ({
    time: offset,
    values: [point.x, point.y, rotation],
    opacity,
  }));
  const velocity = (index: number, axis: number) => {
    if (index === 0 || index === knots.length - 1) return 0;
    const before = knots[index - 1];
    const current = knots[index];
    const after = knots[index + 1];
    const incoming =
      (current.values[axis] - before.values[axis]) /
      (current.time - before.time);
    const outgoing =
      (after.values[axis] - current.values[axis]) / (after.time - current.time);
    return incoming * outgoing > 0
      ? (2 * incoming * outgoing) / (incoming + outgoing)
      : 0;
  };
  const result: Keyframe[] = [];
  knots.slice(0, -1).forEach((start, index) => {
    const end = knots[index + 1];
    const span = end.time - start.time;
    const moving = start.values.some(
      (value, axis) => value !== end.values[axis],
    );
    const steps = moving
      ? Math.max(2, Math.ceil((span * BAT_SCENE_MS) / 90))
      : 1;
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const values = start.values.map(
        (value, axis) =>
          (2 * t3 - 3 * t2 + 1) * value +
          (t3 - 2 * t2 + t) * span * velocity(index, axis) +
          (-2 * t3 + 3 * t2) * end.values[axis] +
          (t3 - t2) * span * velocity(index + 1, axis),
      );
      result.push({
        offset: start.time + t * span,
        opacity:
          start.opacity + (end.opacity - start.opacity) * smooth(0, 1, t),
        transform: `translate(${values[0]}px, ${values[1]}px) rotate(${values[2]}deg)`,
        easing: 'linear',
      });
    }
  });
  const last = knots[knots.length - 1];
  result.push({
    offset: last.time,
    opacity: last.opacity,
    transform: `translate(${last.values[0]}px, ${last.values[1]}px) rotate(${last.values[2]}deg)`,
    easing: 'linear',
  });
  return result;
};

interface WingBeat {
  start: number;
  length: number;
  effort: number;
}

const wingBeats = (sleeper: boolean): WingBeat[] => {
  const beats: WingBeat[] = [];
  let elapsed = 0;
  while (elapsed < BAT_SCENE_MS) {
    const t = elapsed / BAT_SCENE_MS;
    const gentle = !sleeper ? smooth(0.22, 0.27, t) - smooth(0.4, 0.445, t) : 0;
    const strong = !sleeper ? smooth(0.45, 0.5, t) - smooth(0.61, 0.68, t) : 0;
    const period = 1000 / (2.15 - gentle * 0.55 + strong * 0.65);
    beats.push({
      start: t,
      length: period / BAT_SCENE_MS,
      effort: 0.95 - gentle * 0.15 + strong * 0.45,
    });
    elapsed += period;
  }
  return beats;
};

const wingFrames = (
  sleeper: boolean,
  side: number,
  forearm = false,
): Keyframe[] => {
  const frames: Keyframe[] = [];
  for (const beat of wingBeats(sleeper)) {
    const phases = forearm ? [0, 0.4, 0.72] : [0, 0.4];
    for (const phase of phases) {
      const offset = beat.start + beat.length * phase;
      if (offset >= 1) continue;
      const folded = sleeper
        ? smooth(0.13, 0.175, offset) - smooth(0.915, 0.95, offset)
        : 0;
      const downstroke = phase === 0.4;
      const recovering = phase === 0.72;
      frames.push({
        offset,
        opacity: forearm ? 1 : 1 - folded,
        transform: forearm
          ? `rotate(${side * (downstroke ? 0 : recovering ? 28 : 12)}deg) scaleX(${downstroke ? 1 : recovering ? 0.8 : 0.94})`
          : `rotate(${side * (downstroke ? -29 : 27) * beat.effort}deg) scaleY(${downstroke ? 1 : 0.94})`,
        easing: downstroke
          ? 'cubic-bezier(0.42, 0, 0.58, 1)'
          : 'cubic-bezier(0.32, 0, 0.62, 1)',
      });
    }
  }
  frames.push({ ...frames[frames.length - 1], offset: 1 });
  return frames;
};

const parts = (sleeper: boolean, side = 1): BatActor['parts'] => ({
  [BatPart.WingLeft]: wingFrames(sleeper, 1),
  [BatPart.WingRight]: wingFrames(sleeper, -1),
  [BatPart.ForearmLeft]: wingFrames(sleeper, 1, true),
  [BatPart.ForearmRight]: wingFrames(sleeper, -1, true),
  [BatPart.Wrap]: sleeper
    ? [
        { offset: 0, opacity: 0, transform: 'scale(0.75)' },
        { offset: 0.13, opacity: 0, transform: 'scale(0.75)' },
        { offset: 0.165, opacity: 1, transform: 'scale(1)' },
        { offset: 0.39, opacity: 1, transform: 'scale(1)' },
        { offset: 0.43, opacity: 1, transform: 'scale(0.87, 1.08)' },
        { offset: 0.8, opacity: 1, transform: 'scale(0.87, 1.08)' },
        { offset: 0.85, opacity: 1, transform: 'scale(1)' },
        { offset: 0.92, opacity: 1, transform: 'scale(1)' },
        { offset: 0.94, opacity: 0, transform: 'scale(1.15, 0.8)' },
        { offset: 1, opacity: 0, transform: 'scale(1)' },
      ]
    : constant(0),
  [BatPart.Sleep]: sleeper ? shown(0.145, 0.8) : constant(0),
  [BatPart.Eye]: sleeper
    ? [
        { offset: 0, opacity: 1 },
        { offset: 0.13, opacity: 1 },
        { offset: 0.16, opacity: 0 },
        { offset: 0.8, opacity: 0 },
        { offset: 0.815, opacity: 1 },
        { offset: 1, opacity: 1 },
      ]
    : constant(1),
  [BatPart.Yawn]: sleeper ? shown(0.82, 0.855) : constant(0),
  [BatPart.Gaze]: [
    { offset: 0, transform: 'translate(0px, 0px)' },
    { offset: 0.405, transform: 'translate(0px, 0px)' },
    { offset: 0.43, transform: `translate(${side * 2}px, -1px)` },
    { offset: 0.455, transform: `translate(${side * 2}px, -1px)` },
    { offset: 0.48, transform: 'translate(0px, 0px)' },
    { offset: 0.81, transform: 'translate(0px, 0px)' },
    { offset: 0.84, transform: `translate(${side * -2}px, 0px)` },
    { offset: 1, transform: 'translate(0px, 0px)' },
  ],
});

/** Build a finite story once; page reactions follow the helpers' power strokes. */
export const buildBatPlan = (
  targets: BatTargets,
  isMobile: boolean,
  random: () => number = Math.random,
): BatPlan => {
  const { width, height, composer } = targets;
  const size = isMobile ? 80 : 102;
  const active =
    !!composer &&
    width >= 300 &&
    height - composer.rect.bottom >= size * 0.85 + 14;
  const plan: BatPlan = {
    active,
    width,
    height,
    composer,
    actors: [],
    surfaces: [],
  };
  if (!active || !composer) return plan;
  const rest = {
    x: clamp(
      composer.rect.left + composer.rect.width * (0.48 + random() * 0.04),
      125,
      width - 125,
    ),
    y: composer.rect.bottom,
  };
  const helperSize = size * 0.86;
  const spread = isMobile ? 91 : 129;
  const stations = [-1, 1].map((side) => ({
    x: clamp(
      rest.x + side * spread,
      helperSize / 2 + 8,
      width - helperSize / 2 - 8,
    ),
    y: rest.y + size * 0.57,
  }));
  const wingPoints = stations.map((station) => ({
    x: station.x,
    y: station.y - helperSize * 0.27,
  }));
  const perchPoint = targets.perch && pointOn(targets.perch.rect);
  const usablePerch =
    perchPoint &&
    distance(rest, perchPoint) <= (isMobile ? 155 : 220) &&
    height - perchPoint.y >= size * 0.7;
  plan.perch = usablePerch ? targets.perch : undefined;
  const finalGrip =
    usablePerch && perchPoint
      ? perchPoint
      : {
          x: clamp(
            rest.x + size * 0.5,
            composer.rect.left + 24,
            composer.rect.right - 24,
          ),
          y: rest.y,
        };
  const sleeperFrames = [
    pose(0, { x: -size, y: rest.y - size * 0.8 }, 10, 0),
    pose(0.035, { x: rest.x - size * 1.5, y: rest.y - size * 0.45 }, 18),
    pose(0.095, { x: rest.x - size * 0.2, y: rest.y + size * 0.28 }, 125),
    pose(0.13, rest, 180),
    pose(0.39, rest, 180),
    pose(0.425, rest, 184),
    pose(0.46, rest, 180),
    pose(0.8, rest, 180),
    pose(0.855, rest, 180),
  ];
  /* Small alternating steps keep the claws on the edge while the body crawls. */
  for (let i = 1; i <= 6; i++) {
    const progress = i / 6;
    sleeperFrames.push(
      pose(
        0.855 + progress * 0.055,
        {
          x: rest.x + (finalGrip.x - rest.x) * progress,
          y: rest.y + (finalGrip.y - rest.y) * progress,
        },
        180 + (i === 6 ? 0 : i % 2 ? 3 : -3),
      ),
    );
  }
  sleeperFrames.push(
    pose(0.928, finalGrip, 180),
    pose(
      0.95,
      { x: finalGrip.x + size * 0.35, y: finalGrip.y + size * 0.4 },
      340,
    ),
    pose(0.975, { x: width + size * 0.2, y: height * 0.35 }, 370),
    pose(0.995, { x: width + size, y: height * 0.22 }, 360, 0),
    pose(1, { x: width + size, y: height * 0.22 }, 360, 0),
  );
  plan.actors.push({
    size,
    sleeper: true,
    rest,
    frames: smoothFlight(sleeperFrames),
    parts: parts(true),
  });
  stations.forEach((station, index) => {
    const side = index ? 1 : -1;
    const start = { x: index ? width + size : -size, y: rest.y - size * 1.4 };
    const frames = [
      pose(0, start, side * -15, 0),
      pose(0.13 + index * 0.015, start, side * -15, 0),
      pose(0.22 + index * 0.015, station),
    ];
    /* The body lifts slightly after the power stroke and settles on recovery. */
    for (const beat of wingBeats(false)) {
      for (const [phase, lift] of [
        [0, 1.1],
        [0.4, -1.4],
        [0.72, 0.65],
      ]) {
        const offset = beat.start + beat.length * phase;
        if (offset <= 0.24 || offset >= 0.625) continue;
        const glance =
          smooth(0.405, 0.435, offset) * (1 - smooth(0.435, 0.46, offset));
        frames.push(
          pose(
            offset,
            { x: station.x, y: station.y + lift * beat.effort },
            side * 6 * glance,
          ),
        );
      }
    }
    frames.push(pose(0.625, station));
    const center = { x: rest.x, y: rest.y + size * 0.48 };
    for (let i = 0; i <= 14; i++) {
      const progress = i / 14;
      const angle = (index ? 0 : Math.PI) + progress * Math.PI * 1.6;
      const radius = spread * (0.86 - progress * 0.22);
      frames.push(
        pose(
          0.65 + progress * 0.085,
          {
            x: center.x + Math.cos(angle) * radius,
            y: clamp(
              center.y + Math.sin(angle) * radius * 0.42,
              size * 0.7,
              height - 16,
            ),
          },
          side * -15 + progress * 230,
        ),
      );
    }
    const end = index
      ? { x: width + size, y: height + size }
      : { x: -size, y: -size };
    frames.push(
      pose(0.825 + index * 0.012, end, 270 + side * 20, 0),
      pose(1, end, 270 + side * 20, 0),
    );
    plan.actors.push({
      size: helperSize,
      sleeper: false,
      rest: station,
      frames: smoothFlight(frames),
      parts: parts(false, -side),
    });
  });

  const downstrokes = wingBeats(false).map(
    ({ start, length }) => start + length * 0.4,
  );
  const pulses = [
    { launch: 0.265, strength: 1 },
    { launch: 0.352, strength: 1 },
    { launch: 0.472, strength: 2.3 },
    { launch: 0.555, strength: 2.3 },
  ].map(({ launch, strength }) => ({
    launch: downstrokes.find((time) => time >= launch) ?? launch,
    strength,
  }));
  for (const target of targets.surfaces.slice(0, isMobile ? 3 : 5)) {
    const to = {
      x: target.rect.left + target.rect.width / 2,
      y: target.rect.top + target.rect.height / 2,
    };
    const helper =
      distance(wingPoints[0], to) < distance(wingPoints[1], to) ? 1 : 2;
    const source = wingPoints[helper - 1];
    if (distance(source, to) > (isMobile ? 370 : 560)) continue;
    const impacts = pulses.map(({ launch, strength }) => ({
      time: launch + 0.025 + distance(source, to) / 12500,
      launch,
      helper,
      strength,
    }));
    const entry = impacts[0].time;
    const sign = source.x < to.x ? 1 : -1;
    const origin = source.x < to.x ? '0% 50%' : '100% 50%';
    const frames: Keyframe[] = [
      { offset: 0, opacity: 0, transform: 'rotate(0deg) translateY(0px)' },
      {
        offset: entry - 0.01,
        opacity: 0,
        transform: 'rotate(0deg) translateY(0px)',
      },
      { offset: entry, opacity: 1, transform: 'rotate(0deg) translateY(0px)' },
    ];
    const margin = Math.min(target.rect.top, height - target.rect.bottom);
    const maxAngle = Math.min(
      9,
      Math.max(0.8, (margin / target.rect.width) * 35),
    );
    impacts.forEach(({ time, strength }, index) => {
      const next = impacts[index + 1];
      const settle = next ? Math.min(0.073, (next.time - time) * 0.9) : 0.073;
      for (let i = 0; i <= 20; i++) {
        const phase = i / 20;
        const wave =
          Math.sin(phase * Math.PI * 2) *
          Math.sin(phase * Math.PI) *
          (1 - phase);
        frames.push({
          offset: time + phase * settle,
          opacity: 1,
          transform: `rotate(${((sign * maxAngle * strength) / 2.3) * wave}deg) translateY(${(-Math.min(5, margin * 0.2) * wave * strength) / 2.3}px)`,
          easing: 'linear',
        });
      }
    });
    frames.push(
      {
        offset: BAT_RESTORE,
        opacity: 1,
        transform: 'rotate(0deg) translateY(0px)',
      },
      {
        offset: BAT_RESTORE + 0.04,
        opacity: 0,
        transform: 'rotate(0deg) translateY(0px)',
      },
      { offset: 1, opacity: 0, transform: 'rotate(0deg) translateY(0px)' },
    );
    plan.surfaces.push({ target, origin, entry, frames, impacts });
  }
  return plan;
};
