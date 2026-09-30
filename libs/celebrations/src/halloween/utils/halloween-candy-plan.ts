import type { CandyTargets } from './halloween-candy-targets';

/** Includes final cleanup and the last janitor leaving. */
export const CANDY_MS = 35000;
export const CANDY_DEADLINE_MS = CANDY_MS + 500;
export const CANDY_FRAME_LIMIT = 160;
export enum CandyContactKind {
  Edge = 'edge',
  Peck = 'peck',
  Sweep = 'sweep',
}
export enum CandyJanitorKind {
  Mummy = 'mummy',
  Skeleton = 'skeleton',
}
export interface CandyPoint {
  x: number;
  y: number;
}
interface Pose extends CandyPoint {
  time: number;
  angle?: number;
  opacity?: number;
}
/** Every pose is shared with artwork and collision evidence. */
export interface CandyContact extends CandyPoint {
  time: number;
  sweet: number;
  kind: CandyContactKind;
  actor?: number;
  surface?: number;
}
interface Sweet {
  frames: Keyframe[];
  floorX: number;
}
interface Bird {
  frames: Keyframe[];
  head: Keyframe[];
  wing: Keyframe[];
  facing: Keyframe[];
}
interface Janitor {
  kind: CandyJanitorKind;
  frames: Keyframe[];
  arms: Keyframe[];
  legs: Keyframe[][];
  facing: Keyframe[];
}
/** Coordinates are mirrored as a single artwork layer in RTL; no host text enters it. */
export interface CandyPlan {
  targets: CandyTargets;
  floor: number;
  radius: number;
  birdScale: number;
  janitorScale: number;
  peckAngle: number;
  sweets: Sweet[];
  birds: Bird[];
  janitors: Janitor[];
  contacts: CandyContact[];
  animationLimit: number;
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(n, max));
const offset = (time: number) => time / CANDY_MS;
const frames = (poses: Pose[]): Keyframe[] =>
  poses
    .sort((a, b) => a.time - b.time)
    .map((p) => ({
      offset: offset(p.time),
      transform: `translate(${p.x}px, ${p.y}px) rotate(${p.angle ?? 0}deg)`,
      opacity: p.opacity ?? 1,
      easing: 'linear',
    }));
const angles = (points: [number, number][]): Keyframe[] =>
  points
    .sort((a, b) => a[0] - b[0])
    .map(([time, angle]) => ({
      offset: offset(time),
      transform: `rotate(${angle}deg)`,
      easing: 'ease-in-out',
    }));
const facing = (points: [number, number][]): Keyframe[] =>
  points.map(([time, value]) => ({
    offset: offset(time),
    transform: `scaleX(${value})`,
    easing: 'steps(1, end)',
  }));
/** The drawing's beak rotates around its neck; use this for every peck. */
export const candyBeakPoint = (angle: number): CandyPoint => ({
  x: 48 + 47 * Math.cos((angle * Math.PI) / 180),
  y: 30 + 47 * Math.sin((angle * Math.PI) / 180),
});
/** Brush contact in the janitor's left-facing rest pose. */
export const CANDY_BRUSH = { x: 18, y: 174 };

/** Deterministic finite choreography; all geometry work precedes playback. */
export const buildCandyPlan = (
  targets: CandyTargets,
  mobile: boolean,
): CandyPlan => {
  const { width, height, rtl } = targets;
  const floor = Math.max(100, height - 22),
    radius = mobile ? 9 : 11;
  const birdScale = mobile ? 0.64 : 0.8,
    janitorScale = mobile ? 0.5 : 0.76;
  const peckAngle =
    (Math.asin(clamp((90 - radius / birdScale - 30) / 47, -1, 1)) * 180) /
    Math.PI;
  const beak = candyBeakPoint(peckAngle);
  const count = mobile ? 12 : 18,
    flock = mobile ? 4 : 6;
  const contacts: CandyContact[] = [];
  const surfaces = targets.surfaces
    .map((target, index) => ({
      index,
      left: rtl ? width - target.rect.right : target.rect.left,
      right: rtl ? width - target.rect.left : target.rect.right,
      top: target.rect.top,
      bottom: target.rect.bottom,
    }))
    .sort((a, b) => a.top - b.top);
  const positions = Array.from(
    { length: count },
    (_, i) => width * (0.26 + (0.46 * i) / (count - 1)),
  );
  const settled = [...positions];
  const sweetPoses: Pose[][] = [];
  const arc = (
    poses: Pose[],
    from: CandyPoint,
    to: CandyPoint,
    start: number,
    end: number,
    lift: number,
    turn = 0,
  ) => {
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      poses.push({
        time: mix(start, end, t),
        x: mix(from.x, to.x, t),
        y: mix(from.y, to.y, t) - 4 * lift * t * (1 - t),
        angle: turn * Math.sin(Math.PI * t),
      });
    }
  };
  for (let i = 0; i < count; i++) {
    const target = surfaces[i % Math.max(1, surfaces.length)];
    let x = target
      ? mix(
          target.left + radius * 2,
          target.right - radius * 2,
          0.2 + (i % 5) * 0.15,
        )
      : mix(24, width - 24, (i + 0.5) / count);
    let y = -30,
      time = 250 + (i % 6) * 100;
    const higher = surfaces.filter(
      (surface) => surface.top < (target?.top ?? 0),
    );
    const bypassY = Math.max(
      -30,
      ...higher.map((surface) => surface.bottom + radius + 1),
    );
    const bypass =
      target &&
      higher.some((surface) => x >= surface.left && x <= surface.right) &&
      bypassY <= target.top - radius;
    const targetX = x;
    if (bypass)
      x =
        i % 2 === 0
          ? Math.min(...higher.map((surface) => surface.left)) - radius - 2
          : Math.max(...higher.map((surface) => surface.right)) + radius + 2;
    const poses: Pose[] = [
      { time: 0, x, y, opacity: 0 },
      { time, x, y, opacity: 1 },
    ];
    for (const surface of surfaces) {
      /* Rain assigned to a lower card clears the wider composer before turning in. */
      if (bypass && surface === target) {
        arc(
          poses,
          { x, y },
          { x, y: bypassY },
          time,
          time + 600,
          (bypassY - y) / 4,
        );
        y = bypassY;
        time += 600;
      }
      if (
        surface.top < y + radius ||
        (!(bypass && surface === target) &&
          (x < surface.left + radius || x > surface.right - radius))
      )
        continue;
      const hitY = surface.top - radius;
      arc(
        poses,
        { x, y },
        { x: bypass && surface === target ? targetX : x, y: hitY },
        time,
        time + 600,
        Math.max(0, (hitY - y) / 4),
      );
      if (bypass && surface === target) x = targetX;
      time += 600;
      y = hitY;
      contacts.push({
        time,
        x,
        y,
        sweet: i,
        kind: CandyContactKind.Edge,
        surface: surface.index,
      });
      const exitLeft = i % 2 === 0;
      const nextX = exitLeft
        ? surface.left - radius - 2
        : surface.right + radius + 2;
      arc(
        poses,
        { x, y },
        { x: nextX, y },
        time,
        time + 400,
        Math.min(
          65,
          surface.top - 25,
          bypass && surface === target ? hitY - bypassY : Infinity,
        ),
        exitLeft ? -80 : 80,
      );
      x = nextX;
      time += 400;
    }
    /* Descend outside the measured edges before moving across the lower stage. */
    const clearY = Math.min(
      floor - radius,
      Math.max(y, ...surfaces.map((s) => s.bottom + radius + 8)),
    );
    if (clearY > y) {
      arc(
        poses,
        { x, y },
        { x, y: clearY },
        time,
        time + 350,
        (clearY - y) / 4,
      );
      time += 350;
      y = clearY;
    }
    arc(
      poses,
      { x, y },
      { x: positions[i], y: floor - radius },
      time,
      4200 + (i % 4) * 90,
      Math.max(0, (floor - radius - y) / 4),
      i % 2 ? 50 : -50,
    );
    const landed = 4200 + (i % 4) * 90;
    arc(
      poses,
      { x: positions[i], y: floor - radius },
      { x: positions[i], y: floor - radius },
      landed,
      landed + 420,
      12,
    );
    sweetPoses.push(poses);
  }
  /* The mummy's first push leaves candy for the flock's second meal. */
  const brushStart = positions[count - 1] + 18,
    brushEnd = width * 0.65;
  const firstSweepStart = 10900,
    firstSweepEnd = 12600;
  const firstX = (t: number) =>
    mix(
      brushStart,
      brushEnd,
      clamp((t - firstSweepStart) / (firstSweepEnd - firstSweepStart), 0, 1),
    );
  positions.forEach((x, i) => {
    if (x < brushEnd) return;
    const time = mix(
      firstSweepStart,
      firstSweepEnd,
      (brushStart - x) / (brushStart - brushEnd),
    );
    contacts.push({
      time,
      x,
      y: floor - radius,
      sweet: i,
      actor: 0,
      kind: CandyContactKind.Sweep,
    });
    sweetPoses[i].push(
      { time, x, y: floor - radius },
      {
        time: firstSweepEnd + 100,
        x: brushEnd - (i % 3) * radius * 0.45,
        y: floor - radius,
      },
    );
    settled[i] = brushEnd - (i % 3) * radius * 0.45;
  });
  const birds: Bird[] = [];
  for (let i = 0; i < flock; i++) {
    const food = i * 3;
    const x = positions[food] - beak.x * birdScale,
      laterX = settled[food] - beak.x * birdScale;
    const y = floor - 90 * birdScale,
      stagger = i * 110;
    const chaseArrival = {
      x: width * 0.62 - (i % 3) * birdScale * 55,
      y: y - 55 - Math.floor(i / 3) * 50,
    };
    const chaseEnd = {
      x: width - birdScale * (110 + (i % 3) * 65),
      y: y - 40 - Math.floor(i / 3) * 55,
    };
    const poses: Pose[] = [
      { time: 0, x: -120 - i * 40, y: y - 170, opacity: 0 },
    ];
    if (i < 2) {
      poses.push({ time: 4800 + stagger, x: -100, y: y - 140, opacity: 1 });
      arc(
        poses,
        { x: -100, y: y - 140 },
        { x, y },
        4800 + stagger,
        5900 + stagger,
        45,
      );
      poses.push(
        { time: 12600 + stagger, x, y },
        { time: 12800 + stagger, x, y: y - 7 },
      );
      arc(
        poses,
        { x, y: y - 7 },
        { x: -130 - i * 60, y: y - 180 },
        12800 + stagger,
        14000 + stagger,
        45,
      );
      poses.push({ time: 14400, x: -160 - i * 60, y: y - 180, opacity: 0 });
    }
    poses.push({
      time: 15000 + stagger,
      x: -160 - i * 60,
      y: y - 150,
      opacity: 1,
    });
    arc(
      poses,
      { x: -160 - i * 60, y: y - 150 },
      chaseArrival,
      15000 + stagger,
      17600 + stagger,
      70,
    );
    poses.push({
      time: 18700 + stagger,
      ...chaseEnd,
    });
    arc(
      poses,
      chaseEnd,
      { x: laterX, y },
      18700 + stagger,
      20400 + stagger,
      38,
    );
    poses.push(
      { time: 27600 + stagger, x: laterX, y },
      { time: 27800 + stagger, x: laterX, y: y - 8 },
    );
    arc(
      poses,
      { x: laterX, y: y - 8 },
      { x: -160 - i * 65, y: y - 180 - i * 12 },
      27800 + stagger,
      30300 + stagger,
      75,
    );
    poses.push(
      { time: 32000, x: -180 - i * 65, y: y - 180, opacity: 0 },
      { time: CANDY_MS, x: -180, y, opacity: 0 },
    );
    const head: [number, number][] = [
      [0, 0],
      [CANDY_MS, 0],
    ];
    const peck = (time: number, foodX: number) => {
      head.push(
        [time - 180, 0],
        [time, peckAngle],
        [time + 95, peckAngle],
        [time + 330, 0],
      );
      contacts.push({
        time,
        x: foodX,
        y: floor - radius,
        sweet: food,
        actor: i,
        kind: CandyContactKind.Peck,
      });
      sweetPoses[food].push(
        { time, x: foodX, y: floor - radius },
        { time: time + 100, x: foodX + 2, y: floor - radius - 1, angle: 9 },
        { time: time + 300, x: foodX, y: floor - radius },
      );
    };
    if (i < 2)
      [6800, 7750, 8700].forEach((t) => peck(t + stagger, positions[food]));
    [21700, 22800, 24000].forEach((t) => peck(t + stagger, settled[food]));
    const wing: [number, number][] = [
      [0, -76],
      [CANDY_MS, -76],
    ];
    const flutter = (start: number, end: number) => {
      wing.push([start, -76]);
      const cycles = Math.ceil((end - start) / 300);
      for (let n = 0; n < cycles; n++) {
        wing.push(
          [mix(start, end, (n + 0.25) / cycles), 20],
          [mix(start, end, (n + 0.75) / cycles), -65],
        );
      }
      wing.push([end, -76]);
    };
    if (i < 2) {
      flutter(4800 + stagger, 5900 + stagger);
      flutter(12800 + stagger, 14000 + stagger);
    }
    flutter(15000 + stagger, 20400 + stagger);
    flutter(27800 + stagger, 30300 + stagger);
    birds.push({
      frames: frames(poses),
      head: angles(head),
      wing: angles(wing),
      facing: facing([
        [0, 1],
        [12600, -1],
        [14500, 1],
        [18700 + stagger, -1],
        [20400 + stagger, 1],
        [27600 + stagger, -1],
        [CANDY_MS, -1],
      ]),
    });
  }
  const janitors: Janitor[] = [];
  const janitorY = floor - CANDY_BRUSH.y * janitorScale;
  const brushOffset = CANDY_BRUSH.x * janitorScale;
  const finalStart = 28400,
    finalEnd = 32600;
  const finalBrushStart = width * (mobile ? 0.66 : 0.74),
    finalBrushEnd = -70;
  const sweepAt = (x: number) =>
    mix(
      finalStart,
      finalEnd,
      (finalBrushStart - x) / (finalBrushStart - finalBrushEnd),
    );
  settled.forEach((x, i) => {
    const time = sweepAt(x);
    contacts.push({
      time,
      x,
      y: floor - radius,
      sweet: i,
      actor: 0,
      kind: CandyContactKind.Sweep,
    });
    sweetPoses[i].push(
      { time, x, y: floor - radius },
      {
        time: Math.min(33300, time + 1000),
        x: -35 - i * 3,
        y: floor - radius,
        angle: -45,
      },
      { time: 34000, x: -100, y: floor - radius, opacity: 0 },
      { time: CANDY_MS, x: -100, y: floor - radius, opacity: 0 },
    );
  });
  for (let i = 0; i < 3; i++) {
    const gap = i * (mobile ? 30 : 94),
      start = 24000 + i * 220;
    const poses: Pose[] = [
      { time: 0, x: width + 180, y: janitorY, opacity: 0 },
    ];
    if (i === 0)
      poses.push(
        { time: 9000, x: width + 80, y: janitorY, opacity: 1 },
        { time: 10500, x: brushStart - brushOffset, y: janitorY },
        {
          time: firstSweepStart,
          x: firstX(firstSweepStart) - brushOffset,
          y: janitorY,
        },
        {
          time: firstSweepEnd,
          x: firstX(firstSweepEnd) - brushOffset,
          y: janitorY,
        },
        { time: 13700, x: brushEnd - brushOffset, y: janitorY },
        { time: 15800, x: brushEnd - brushOffset, y: janitorY },
        { time: 16800, x: width * 0.69, y: janitorY },
        { time: 19400, x: width + 180, y: janitorY },
        { time: 20000, x: width + 180, y: janitorY, opacity: 0 },
      );
    poses.push(
      { time: start, x: width + 180 + gap, y: janitorY, opacity: 1 },
      { time: 26600, x: finalBrushStart - brushOffset + gap, y: janitorY },
      { time: finalStart, x: finalBrushStart - brushOffset + gap, y: janitorY },
      { time: finalEnd, x: finalBrushEnd - brushOffset + gap, y: janitorY },
      { time: 34700, x: -250 - i * 80, y: janitorY },
      { time: CANDY_MS, x: -250 - i * 80, y: janitorY, opacity: 0 },
    );
    const arms: [number, number][] = [
      [0, 0],
      [CANDY_MS, 0],
    ];
    if (i === 0)
      arms.push(
        [10400, 16],
        [10900, 0],
        [12600, 0],
        [12800, 65],
        [13400, 5],
        [14300, 0],
        [16400, 65],
        [19000, 65],
        [20000, 0],
      );
    arms.push(
      [start, 12],
      [26000 + i * 100, 12],
      [26600, 0],
      [27400, 0],
      [27700, 58],
      [28100, 0],
      [32600, 0],
      [33300, 10],
      [34700, 0],
    );
    const legs: [number, number][][] = [
      [
        [0, 0],
        [CANDY_MS, 0],
      ],
      [
        [0, 0],
        [CANDY_MS, 0],
      ],
    ];
    const walk = (begin: number, end: number, pace: number) => {
      const cycles = Math.ceil((end - begin) / pace);
      for (let leg = 0; leg < 2; leg++) {
        legs[leg].push([begin, 0]);
        for (let n = 0; n < cycles; n++)
          legs[leg].push(
            [mix(begin, end, (n + 0.25) / cycles), (leg ? -1 : 1) * 13],
            [mix(begin, end, (n + 0.75) / cycles), (leg ? 1 : -1) * 13],
          );
        legs[leg].push([end, 0]);
      }
    };
    if (i === 0) {
      walk(9000, 10500, 500);
      walk(10900, 12600, 650);
      walk(16400, 19400, 320);
    }
    walk(start, 26600, 600);
    walk(finalStart, 34700, 600);
    janitors.push({
      kind: i === 0 ? CandyJanitorKind.Mummy : CandyJanitorKind.Skeleton,
      frames: frames(poses),
      arms: angles(arms),
      legs: legs.map(angles),
      facing: facing(
        i === 0
          ? [
              [0, 1],
              [16500, -1],
              [20000, 1],
              [CANDY_MS, 1],
            ]
          : [
              [0, 1],
              [CANDY_MS, 1],
            ],
      ),
    });
  }
  return {
    targets,
    floor,
    radius,
    birdScale,
    janitorScale,
    peckAngle,
    sweets: sweetPoses.map((p, i) => ({
      frames: frames(p),
      floorX: settled[i],
    })),
    birds,
    janitors,
    contacts,
    animationLimit: mobile ? 60 : 80,
  };
};
