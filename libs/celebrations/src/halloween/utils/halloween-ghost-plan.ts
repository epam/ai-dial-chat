import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { HalloweenGhostVariant } from '../types/halloween';
import type { GhostTargets } from './halloween-ghost-targets';

export const GHOST_SCENE_MS = 12000;
export const GHOST_RESTORE = 0.9;
export const GHOST_PUMPKIN_REACTION = 0.51;

interface Point {
  x: number;
  y: number;
}

export interface GhostHome {
  target: CelebrationSnapshotTarget;
  center: Point;
  entry: number;
  frames: Keyframe[];
  eyesFrames: Keyframe[];
  lookFrames: Keyframe[];
}

export interface GhostActor {
  variant: HalloweenGhostVariant;
  size: number;
  leader: boolean;
  home: number;
  rest: Point;
  frames: Keyframe[];
  clothFrames: Keyframe[];
  frightFrames: Keyframe[];
}

export interface GhostPlan {
  active: boolean;
  width: number;
  height: number;
  pumpkin?: CelebrationSnapshotTarget;
  homes: GhostHome[];
  actors: GhostActor[];
  leaderHome: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const center = (rect: DOMRect): Point => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});
const pose = (
  offset: number,
  { x, y }: Point,
  opacity = 1,
  scaleX = 1,
  scaleY = scaleX,
  rotation = 0,
): Keyframe => ({
  offset,
  transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`,
  opacity,
});

const appearance = (enter: number, leave: number): Keyframe[] => [
  { offset: 0, opacity: 0 },
  { offset: enter, opacity: 0 },
  { offset: enter + 0.025, opacity: 1 },
  { offset: leave, opacity: 1 },
  { offset: leave + 0.025, opacity: 0 },
  { offset: 1, opacity: 0 },
];

/** One immutable story: each home and ghost share measured physical coordinates. */
export const buildGhostPlan = (
  targets: GhostTargets,
  isMobile: boolean,
  random: () => number = Math.random,
): GhostPlan => {
  const { width, height, pumpkin } = targets;
  const selected = targets.homes.slice(0, isMobile ? 3 : 5);
  const leaderHome = selected.length - 1;
  const active = !!pumpkin && selected.length > 0;
  if (!pumpkin || selected.length === 0)
    return {
      active,
      width,
      height,
      pumpkin,
      homes: [],
      actors: [],
      leaderHome: -1,
    };
  const pumpkinPoint = pumpkin
    ? center(pumpkin.rect)
    : { x: width / 2, y: height / 2 };
  const homes: GhostHome[] = selected.map((target, index) => {
    const point = center(target.rect);
    const leader = index === leaderHome;
    const entry = leader ? 0.635 : 0.205 + index * 0.018;
    const tilt = (index % 2 ? -1 : 1) * (2 + random() * 2);
    const lift = Math.min(14, Math.max(0, target.rect.top - 8));
    const shift = clamp(
      (index % 2 ? 1 : -1) * 5,
      8 - target.rect.left,
      width - target.rect.right - 8,
    );
    const idle = 'translate(0px, 0px) rotate(0deg)';
    const floated = `translate(${shift}px, ${-lift}px) rotate(${tilt}deg)`;
    const frames: Keyframe[] = [
      { offset: 0, opacity: 0, transform: idle },
      { offset: entry - 0.01, opacity: 0, transform: idle },
      { offset: entry, opacity: 1, transform: idle },
      { offset: entry + 0.03, opacity: 1, transform: floated },
    ];
    if (!leader) {
      frames.push(
        {
          offset: 0.37,
          opacity: 1,
          transform: `translate(${-shift}px, ${-lift * 0.7}px) rotate(${-tilt}deg)`,
        },
        { offset: 0.46, opacity: 1, transform: floated },
        {
          offset: GHOST_PUMPKIN_REACTION + 0.02,
          opacity: 1,
          transform: floated,
        },
        {
          offset: 0.575,
          opacity: 1,
          transform: `translate(0px, ${-lift - 5}px) rotate(0deg)`,
        },
      );
    }
    frames.push(
      { offset: 0.695, opacity: 1, transform: idle },
      { offset: GHOST_RESTORE, opacity: 1, transform: idle },
      { offset: GHOST_RESTORE + 0.04, opacity: 0, transform: idle },
      { offset: 1, opacity: 0, transform: idle },
    );
    const lookX = clamp((pumpkinPoint.x - point.x) / 60, -3, 3);
    const lookY = clamp((pumpkinPoint.y - point.y) / 80, -2, 2);
    return {
      target,
      center: point,
      entry,
      frames,
      eyesFrames: appearance(entry + 0.02, 0.69),
      lookFrames: [
        { offset: 0, transform: 'translate(0px, 0px)' },
        { offset: 0.3, transform: 'translate(-3px, 0px)' },
        { offset: 0.4, transform: 'translate(3px, 1px)' },
        { offset: GHOST_PUMPKIN_REACTION, transform: 'translate(0px, 0px)' },
        { offset: 0.55, transform: `translate(${lookX}px, ${lookY}px)` },
        { offset: 1, transform: `translate(${lookX}px, ${lookY}px)` },
      ],
    };
  });
  const variants = Object.values(HalloweenGhostVariant);
  const actors = homes.map((home, index): GhostActor => {
    const leader = index === leaderHome;
    const size = (isMobile ? 53 : 65) + (leader ? 16 : random() * 11);
    const h = (size * 88) / 64;
    const rest = {
      x: clamp(home.center.x, size / 2 + 8, width - size / 2 - 8),
      y: clamp(home.target.rect.top - h * 0.42, h / 2 + 8, height - h / 2 - 8),
    };
    const swallowed = { x: home.center.x, y: home.center.y - h * 0.34 };
    const peek = { x: home.center.x, y: home.target.rect.top + h * 0.14 };
    const delay = index * 0.012;
    const depart = 0.79 + delay;
    const side = index % 4;
    const end =
      side === 0
        ? { x: -size * 2, y: height * (0.12 + random() * 0.66) }
        : side === 1
          ? { x: width + size * 2, y: height * (0.12 + random() * 0.66) }
          : side === 2
            ? { x: width * (0.14 + random() * 0.7), y: -h * 2 }
            : { x: width * (0.14 + random() * 0.7), y: height + h * 2 };
    const exitMiddle = {
      x: (rest.x + end.x) / 2,
      y: (rest.y + end.y) / 2 - 22,
    };
    const start = {
      x: index % 2 ? width + size : -size,
      y: height * (0.2 + random() * 0.55),
    };
    const approach = {
      x: rest.x,
      y: clamp(rest.y - 25, h / 2, height - h / 2),
    };
    let frames: Keyframe[];
    let clothFrames: Keyframe[];
    const visible = 'inset(0% 0% 0% 0%)';
    const gone = 'inset(100% 0% 0% 0%)';
    if (leader) {
      const fromLeft = pumpkinPoint.x > width / 2;
      const direction = fromLeft ? -1 : 1;
      const encounter = {
        x: clamp(
          pumpkinPoint.x + direction * (pumpkin.rect.width / 2 + size * 0.6),
          size / 2 + 5,
          width - size / 2 - 5,
        ),
        y: clamp(pumpkinPoint.y - h * 0.28, h / 2 + 8, height - h / 2 - 8),
      };
      const retreat = {
        x: clamp(
          encounter.x + direction * size * 0.7,
          size / 2,
          width - size / 2,
        ),
        y: Math.max(h / 2, encounter.y - h * 0.5),
      };
      frames = [
        pose(0, start, 0),
        pose(0.045, start, 0),
        pose(0.18, approach, 0.9, 0.9, 1.1, -10),
        pose(0.31, encounter, 1, 1, 1, 9),
        pose(0.375, { ...encounter, y: encounter.y - 10 }, 1, 0.86, 1.12, -5),
        pose(0.425, encounter, 1, 1.27, 1.16, 0),
        pose(GHOST_PUMPKIN_REACTION, encounter, 1, 1.2, 1.1),
        pose(0.55, retreat, 1, 0.65, 0.74, direction * -18),
        pose(0.605, approach, 1, 0.82, 1.13, -12),
        pose(0.635, swallowed, 1, 0.45, 1.08),
        pose(0.658, swallowed, 1, 0.38, 1.08),
        pose(0.687, swallowed, 1, 0.32, 0.95, 5),
        pose(0.701, swallowed, 0, 0.25, 0.9),
        pose(0.719, peek, 0, 0.75),
        pose(0.745, peek, 1, 0.85),
        pose(depart, rest, 1, 0.9, 1.08),
      ];
      clothFrames = [
        { offset: 0, clipPath: visible },
        { offset: 0.613, clipPath: visible },
        { offset: 0.648, clipPath: 'inset(69% 0% 0% 0%)' },
        { offset: 0.685, clipPath: 'inset(73% 0% 0% 0%)' },
        { offset: 0.701, clipPath: gone },
        { offset: 0.719, clipPath: 'inset(0% 0% 52% 0%)' },
        { offset: 0.754, clipPath: 'inset(0% 0% 42% 0%)' },
        { offset: depart, clipPath: visible },
        { offset: 1, clipPath: visible },
      ];
    } else {
      frames = [
        pose(0, start, 0),
        pose(0.02 + delay, start, 0),
        pose(0.11 + delay, approach, 0.9, 0.9, 1.05, (index % 2 ? 1 : -1) * 12),
        pose(home.entry - 0.025, rest, 1),
        pose(home.entry + 0.02, swallowed, 1, 0.48, 1.1),
        pose(home.entry + 0.048, swallowed, 0, 0.3, 0.9),
        pose(0.692 + delay, peek, 0, 0.8),
        pose(0.725 + delay, peek, 1, 0.9),
        pose(depart, rest, 1, 0.9, 1.08),
      ];
      clothFrames = [
        { offset: 0, clipPath: visible },
        { offset: home.entry - 0.02, clipPath: visible },
        { offset: home.entry + 0.048, clipPath: gone },
        { offset: 0.68, clipPath: gone },
        { offset: 0.692 + delay, clipPath: 'inset(0% 0% 58% 0%)' },
        { offset: 0.735 + delay, clipPath: 'inset(0% 0% 42% 0%)' },
        { offset: depart, clipPath: visible },
        { offset: 1, clipPath: visible },
      ];
    }
    frames.push(
      pose(depart + 0.07, exitMiddle, 0.9, 0.8, 1.12, side % 2 ? 18 : -18),
      pose(0.977, end, 0, 0.6, 0.9, side % 2 ? 28 : -28),
      pose(1, end, 0),
    );
    return {
      variant: variants[index % variants.length],
      size,
      leader,
      home: index,
      rest,
      frames,
      clothFrames,
      frightFrames: [
        { offset: 0, opacity: 0 },
        { offset: leader ? GHOST_PUMPKIN_REACTION : 0.69, opacity: 0 },
        { offset: leader ? 0.545 : 0.71, opacity: 1 },
        { offset: 1, opacity: 1 },
      ],
    };
  });
  return { active, width, height, pumpkin, homes, actors, leaderHome };
};
