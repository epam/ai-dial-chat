import {
  headOrigin,
  headScale,
  REINDEER_NECK,
  type ReindeerPoint as Point,
} from './reindeer-art';
import { Track } from './snowman-delivery-timeline';

export const REINDEER_HIPS: Point[] = [
  [-34, -55],
  [22, -55],
  [-30, -55],
  [27, -55],
];
const RAD = Math.PI / 180;

export const smoothStep = (value: number) => {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
};
export const rotatePoint = ([x, y]: Point, degrees: number): Point => [
  x * Math.cos(degrees * RAD) - y * Math.sin(degrees * RAD),
  x * Math.sin(degrees * RAD) + y * Math.cos(degrees * RAD),
];

/** The muzzle follows both neck and head articulation, including calf proportions. */
export const nosePoint = (
  isCalf: boolean,
  neck: number,
  head: number,
): Point => {
  const origin = headOrigin(isCalf);
  const size = headScale(isCalf);
  const nose = rotatePoint([33 * size, 5 * size], head);
  const offset = rotatePoint(
    [
      origin[0] + nose[0] - REINDEER_NECK[0],
      origin[1] + nose[1] - REINDEER_NECK[1],
    ],
    neck,
  );
  return [REINDEER_NECK[0] + offset[0], REINDEER_NECK[1] + offset[1]];
};

/** Body pivot is the hip line, so leaning does not orbit around the toes. */
export interface ReindeerPose {
  position: Point;
  size: number;
  facing: number;
  lean: number;
}
export const posePoint = (pose: ReindeerPose, point: Point): Point => {
  const offset = rotatePoint(
    [point[0] * pose.size * pose.facing, (point[1] + 55) * pose.size],
    pose.lean,
  );
  return [pose.position[0] + offset[0], pose.position[1] + offset[1]];
};

/** A planted hoof is fixed in stage space; only the swing phase advances it. */
export const walkingHoof = (
  distance: number,
  startX: number,
  facing: number,
  size: number,
  hipX: number,
  index: number,
  direction = facing,
): { point: Point; planted: boolean } => {
  const stride = 68;
  const stance = 0.6;
  const offset = [0, 0.5, 0.25, 0.75][index];
  const phase = Math.max(0, distance) / stride + offset;
  const cycle = Math.floor(phase);
  const fraction = phase - cycle;
  const swing = Math.max(0, (fraction - stance) / (1 - stance));
  return {
    point: [
      startX +
        size *
          (facing * hipX +
            direction *
              stride *
              (cycle - offset + stance / 2 + smoothStep(swing))),
      -size * 11 * Math.sin(Math.PI * swing) ** 2,
    ],
    planted: fraction < stance,
  };
};

/** Two equal 28-unit bones, with a counter-rotated sole at the contact point. */
export const solveLeg = (pose: ReindeerPose, hip: Point, hoof: Point) => {
  const offset = rotatePoint(
    [hoof[0] - pose.position[0], hoof[1] - pose.position[1]],
    -pose.lean,
  );
  const x = offset[0] / (pose.size * pose.facing) - hip[0];
  const y = offset[1] / pose.size - 55 - hip[1];
  const reach = Math.hypot(x, y);
  const distance = Math.min(55.95, reach);
  const bend = hip[0] < 0 ? -1 : 1;
  const knee =
    (bend * Math.acos(Math.max(-1, (distance * distance - 1568) / 1568))) / RAD;
  const upper = Math.atan2(-x, y) / RAD - knee / 2;
  return { upper, knee, hoof: -upper - knee - pose.lean / pose.facing, reach };
};

export interface FlightKnot {
  time: number;
  point: Point;
  velocity: Point;
}
/** Cubic Hermite segments share velocity at joins, including the launch. */
export const flightPoint = (knots: FlightKnot[], time: number): Point => {
  if (time <= knots[0].time) return knots[0].point;
  const next = knots.findIndex((knot) => knot.time > time);
  if (next < 0) return knots[knots.length - 1].point;
  const a = knots[next - 1];
  const b = knots[next];
  const dt = b.time - a.time;
  const p = (time - a.time) / dt;
  const h00 = 2 * p ** 3 - 3 * p ** 2 + 1;
  const h10 = p ** 3 - 2 * p ** 2 + p;
  const h01 = -2 * p ** 3 + 3 * p ** 2;
  const h11 = p ** 3 - p ** 2;
  return a.point.map(
    (value, axis) =>
      h00 * value +
      h10 * dt * a.velocity[axis] +
      h01 * b.point[axis] +
      h11 * dt * b.velocity[axis],
  ) as Point;
};

export interface WalkingInterval {
  start: number;
  end: number;
  facing: number;
}

/** Bake support and joint motion once; playback needs no solver or DOM reads. */
export const buildDeerMotion = (
  root: Track,
  lean: Track,
  facing: Track,
  size: number,
  walks: WalkingInterval[],
  launch: number,
  isCalf = false,
) => {
  const compression = (t: number) => {
    const walk = walks.find(({ start, end }) => t >= start && t < end);
    if (walk) {
      const distance =
        Math.abs(root.value(t)[0] - root.value(walk.start)[0]) / size;
      const weight =
        smoothStep((t - walk.start) / 0.15) * smoothStep((walk.end - t) / 0.18);
      return (
        3 +
        weight *
          (4 + (isCalf ? 1.2 : 0.7) * Math.cos((distance / 68) * Math.PI * 4))
      );
    }
    return (
      (3 + Math.abs(lean.at(t)) * 0.8) * (1 - smoothStep((t - launch) / 0.35))
    );
  };
  const poseAt = (t: number): ReindeerPose => ({
    position: [
      root.value(t)[0],
      root.value(t)[1] + size * (compression(t) - 55),
    ],
    size,
    facing: facing.at(t),
    lean: lean.at(t),
  });
  const hoofAt = (
    t: number,
    index: number,
  ): { point: Point; planted: boolean } => {
    const hip = REINDEER_HIPS[index];
    const walk = walks.find(({ start, end }) => t >= start && t <= end);
    if (walk) {
      const startX = root.value(walk.start)[0];
      const direction =
        Math.sign(root.value(walk.end)[0] - startX) || walk.facing;
      const step = walkingHoof(
        Math.abs(root.value(t)[0] - startX) / size,
        startX,
        walk.facing,
        size,
        hip[0],
        index,
        direction,
      );
      if (walk.start > 0 && t < walk.start + 0.15) {
        const p = smoothStep((t - walk.start) / 0.15);
        const initial = startX + walk.facing * size * hip[0];
        return {
          point: [initial + (step.point[0] - initial) * p, step.point[1] * p],
          planted: false,
        };
      }
      return step;
    }
    const previous = walks.filter(({ end }) => end < t).at(-1) ?? walks[0];
    const stop = root.value(previous.end);
    const turn = Math.abs(facing.at(t)) < 0.999;
    const target: Point = [stop[0] + facing.at(t) * size * hip[0], stop[1]];
    const p = smoothStep((t - previous.end - index * 0.035) / 0.28);
    if (p < 1) {
      const last = hoofAt(previous.end, index).point;
      return {
        point: [
          last[0] + (target[0] - last[0]) * p,
          last[1] * (1 - p) - 7 * size * Math.sin(Math.PI * p) ** 2,
        ],
        planted: false,
      };
    }
    /* After a resisted pull, each hoof takes a small recovery step in turn. */
    if (t > 10.1 && previous.end < 10) {
      const recovery = smoothStep((t - 10.1 - index * 0.07) / 0.25);
      target[0] += (root.value(10.1)[0] - stop[0]) * recovery;
      target[1] -= 6 * size * Math.sin(Math.PI * recovery) ** 2;
      if (recovery < 1) return { point: target, planted: false };
    }
    return { point: target, planted: !turn && t <= launch };
  };
  /* A directed push, fold and relaxed glide; no walking cycle after takeoff. */
  const flightLegs = REINDEER_HIPS.map((hip, index) => {
    const isHind = hip[0] < 0;
    const delay = (index < 2 ? 0.06 : 0) + (isCalf ? 0.08 : 0);
    const at = (t: number) => launch + t + delay;
    const upper = new Track([0])
      .set(at(0.16), isHind ? 8 : -18)
      .set(at(0.62), isHind ? 54 : -62)
      .set(at(1.15), isHind ? 36 : -38)
      .set(at(1.8), isHind ? 28 : -26)
      .hold(20.4)
      .set(21.3, isHind ? 37 : -38);
    const knee = new Track([0])
      .set(at(0.16), isHind ? -12 : 14)
      .set(at(0.62), isHind ? -104 : 112)
      .set(at(1.15), isHind ? -72 : 78)
      .set(at(1.8), isHind ? -54 : 62)
      .hold(20.4)
      .set(21.3, isHind ? -70 : 82);
    return { upper, knee };
  });
  const legAt = (t: number, index: number) => {
    const ground = solveLeg(
      poseAt(Math.min(t, launch)),
      REINDEER_HIPS[index],
      hoofAt(Math.min(t, launch), index).point,
    );
    if (t <= launch) return ground;
    const p = smoothStep((t - launch) / 0.2);
    const upper = flightLegs[index].upper.at(t);
    const knee = flightLegs[index].knee.at(t);
    return {
      ...ground,
      upper: ground.upper + (upper - ground.upper) * p,
      knee: ground.knee + (knee - ground.knee) * p,
      hoof: ground.hoof + (-16 - ground.hoof) * p,
    };
  };
  const kinks = [
    0,
    3.6,
    4.2,
    4.6,
    6.1,
    7.1,
    8.6,
    10.1,
    10.8,
    11.1,
    12.3,
    14.95,
    15.25,
    16.1,
    launch,
    launch + 0.45,
    ...flightLegs.flatMap(({ upper }) => upper.keys.map(({ t }) => t)),
    22.4,
    23,
    ...facing.keys.map(({ t }) => t),
    ...walks.flatMap(({ start, end }) => [start, end, end + 0.45]),
  ];
  const position = new Track().sample(
    0,
    23,
    0.04,
    (t) => poseAt(t).position,
    kinks,
  );
  for (const { start, end } of walks)
    position.sample(start, end, 0.02, (t) => poseAt(t).position);
  position.prune(0.25);
  const legs = REINDEER_HIPS.map((_, index) => {
    const cache = new Map<number, ReturnType<typeof legAt>>();
    const at = (t: number) => {
      if (!cache.has(t)) cache.set(t, legAt(t, index));
      return cache.get(t)!;
    };
    const bake = (axis: 'upper' | 'knee' | 'hoof') => {
      const track = new Track().sample(
        0,
        23,
        0.06,
        (t) => [at(t)[axis]],
        kinks,
      );
      for (const { start, end } of walks)
        track.sample(start, end, start === 0 ? 0.02 : 0.01, (t) => [
          at(t)[axis],
        ]);
      return track.prune(1.5);
    };
    return { upper: bake('upper'), knee: bake('knee'), hoof: bake('hoof') };
  });
  return { position, legs, poseAt, hoofAt, legAt };
};
