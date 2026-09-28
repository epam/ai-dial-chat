import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import type {
  FootprintComposer,
  FootprintTargets,
} from './halloween-footprint-targets';

/** Finite Footprints timeline, also the existing provider deadline. */
export const FOOTPRINT_MS = 12000;
/** Snapshot source fade-out completes before the first card contact. */
export const FOOTPRINT_HIDE = 0.24;
/** Return ownership after the card's rebound has settled. */
export const FOOTPRINT_RESTORE = 0.86;
/** Snapshot helper completes its source restoration four percent later. */
export const FOOTPRINT_HANDOFF = FOOTPRINT_RESTORE + 0.04;
/** Includes the borrowed copy and the original's opacity track. */
export const FOOTPRINT_ANIMATION_LIMIT = 20;
/** Maximum precomputed frames in any one track. */
export const FOOTPRINT_KEYFRAME_LIMIT = 80;

/** Separates page prints from prints attached to a card or input outline. */
export enum FootprintSurface {
  Page = 'page',
  Card = 'card',
  Composer = 'composer',
}
/** Articulated facial features of the invisible familiar. */
export enum FootprintPart {
  Eyes = 'eyes',
  Gaze = 'gaze',
  Grin = 'grin',
}
interface Point {
  x: number;
  y: number;
}
interface Print {
  point: Point;
  surface: FootprintSurface;
  contactAt: number;
  frames: Keyframe[];
}
/** Immutable geometry and tracks for one activation. */
export interface FootprintPlan {
  anchors: CelebrationSnapshotTarget[];
  card?: CelebrationSnapshotTarget;
  /** Decorative outline only; the input remains fully visible and editable. */
  ledge?: FootprintComposer;
  size: number;
  prints: Print[];
  surfaceFrames: Keyframe[];
  faceFrames: Keyframe[];
  faceParts: Record<FootprintPart, Keyframe[]>;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(n, Math.max(min, max)));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (ms: number) => ms / FOOTPRINT_MS;
const settle = 'cubic-bezier(0.22, 1, 0.36, 1)';
const smooth = 'cubic-bezier(0.45, 0, 0.55, 1)';

/** Precompute alternating pressure marks, surface weight and the last disappearing grin. */
export const buildFootprintPlan = (
  targets: FootprintTargets,
  isMobile: boolean,
): FootprintPlan => {
  const { width, height, card, composer } = targets;
  const count = isMobile ? 3 : 5;
  const size = isMobile ? 23 : 27;
  const ledge =
    !card &&
    composer &&
    composer.rect.width >= 144 &&
    composer.rect.height >= 32 &&
    composer.rect.top >= 100
      ? composer
      : undefined;
  const ledgeDirection =
    ledge && ledge.rect.left + ledge.rect.width / 2 < width / 2 ? -1 : 1;
  const span = Math.min(144, (ledge?.rect.width ?? 168) - 24);
  const contactSurface = card
    ? FootprintSurface.Card
    : ledge
      ? FootprintSurface.Composer
      : FootprintSurface.Page;
  const stage =
    card?.rect ??
    (ledge
      ? {
          left:
            ledge.rect.left +
            (ledgeDirection > 0 ? 12 : ledge.rect.width - span - 12),
          top: ledge.rect.top,
          width: span,
          height: 44,
        }
      : {
          left: clamp(width / 2 - 72, 24, width - 168),
          top: clamp(
            composer ? composer.rect.top - 96 : height * 0.5,
            140,
            height - 150,
          ),
          width: Math.min(144, Math.max(72, width - 48)),
          height: 44,
        });
  const direction = ledge
    ? ledgeDirection
    : stage.left + stage.width / 2 >= width / 2
      ? 1
      : -1;
  const firstX = direction > 0 ? 18 : stage.width - 18;
  const lastX = stage.width - firstX;
  const end = { x: stage.left + firstX - direction * 28, y: stage.top - 20 };
  const startX = clamp(end.x - direction * count * 28, 20, width - 20);
  const start = {
    x: startX,
    y: clamp(
      end.y - Math.sqrt(Math.max(0, (count * 28) ** 2 - (end.x - startX) ** 2)),
      28,
      height - 40,
    ),
  };
  const heading = Math.atan2(end.y - start.y, end.x - start.x);
  const prints: Print[] = [];
  const stamp = (
    point: Point,
    angle: number,
    time: number,
    index: number,
    surface: FootprintSurface,
    endTime = time + 2300,
  ) => {
    const mirror = index % 2 ? -1 : 1;
    const transform = (scale: number, pressure = 1) =>
      `rotate(${angle}deg) scale(${mirror * scale}, ${scale * pressure})`;
    prints.push({
      point,
      surface,
      contactAt: time,
      frames: [
        { offset: 0, opacity: 0, transform: transform(0.72) },
        {
          offset: at(time),
          opacity: 0,
          transform: transform(0.72),
          easing: settle,
        },
        {
          offset: at(time + 100),
          opacity: 0.92,
          transform: transform(1.05, 0.91),
          easing: settle,
        },
        { offset: at(time + 230), opacity: 0.85, transform: transform(1) },
        {
          offset: at(endTime - 420),
          opacity: 0.72,
          transform: transform(1),
          easing: smooth,
        },
        { offset: at(endTime), opacity: 0, transform: transform(1) },
        { offset: 1, opacity: 0, transform: transform(1) },
      ],
    });
  };
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1),
      side = i % 2 ? 5 : -5;
    stamp(
      {
        x: mix(start.x, end.x, t) - Math.sin(heading) * side,
        y: mix(start.y, end.y, t) + Math.cos(heading) * side,
      },
      (heading * 180) / Math.PI + 90,
      350 + t * 2100,
      i,
      FootprintSurface.Page,
    );
  }
  const surfaceFrames: Keyframe[] = [];
  const surfacePose = (
    time: number,
    y: number,
    angle: number,
    opacity = 1,
    easing = settle,
  ) =>
    surfaceFrames.push({
      offset: at(time),
      transform: ledge
        ? `translateY(${y * 0.5}px)`
        : `translateY(${y}px) rotate(${angle}deg)`,
      opacity,
      easing,
    });
  surfacePose(0, 0, 0, 0, 'steps(1, end)');
  surfacePose((FOOTPRINT_HIDE - 0.01) * FOOTPRINT_MS, 0, 0);
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1),
      time = 3200 + t * 2000;
    const local = { x: mix(firstX, lastX, t), y: i % 2 ? 3 : -3 };
    stamp(
      card
        ? local
        : ledge
          ? { x: stage.left - ledge.rect.left + local.x, y: local.y }
          : { x: stage.left + local.x, y: stage.top + local.y },
      direction * 90,
      time,
      count + i,
      contactSurface,
      time + 2100,
    );
    surfacePose(time, 0, 0);
    surfacePose(time + 130, 3, (t - 0.5) * 4);
    surfacePose(time + 350, 0, 0);
  }
  surfacePose(5900, 0, 0, 1, smooth);
  surfacePose(6450, 6, direction * 0.7);
  surfacePose(6900, 4.5, direction * 0.3);
  surfacePose(7350, 5, 0);
  surfacePose(9050, 5, 0, 1, smooth);
  surfacePose(9280, 8, direction);
  surfacePose(9450, -4, -direction);
  surfacePose(9700, 2, direction * 0.5);
  surfacePose(9950, -0.7, -direction * 0.2);
  surfacePose(10180, 0, 0);
  surfacePose(FOOTPRINT_RESTORE * FOOTPRINT_MS, 0, 0, 1, 'steps(1, end)');
  surfacePose(FOOTPRINT_HANDOFF * FOOTPRINT_MS, 0, 0, 0);
  surfacePose(FOOTPRINT_MS, 0, 0, 0);

  const landingInset = ledge ? 30 : 18;
  const landNearStart = ledge ? direction < 0 : direction > 0;
  const landing = {
    x: clamp(
      composer
        ? composer.rect.left +
            (landNearStart ? landingInset : composer.rect.width - landingInset)
        : stage.left + stage.width + direction * 42,
      62,
      width - 62,
    ),
    y: clamp(composer?.rect.top ?? stage.top + 95, 110, height - 40),
  };
  stamp(
    { x: landing.x - 13, y: landing.y - 2 },
    direction * 70,
    10250,
    0,
    FootprintSurface.Page,
    11500,
  );
  stamp(
    { x: landing.x + 13, y: landing.y + 2 },
    direction * 90,
    10600,
    1,
    FootprintSurface.Page,
    11820,
  );
  const headStage = ledge?.rect ?? stage;
  const rest = {
    /* The head peers over the open side; stacked cards and their text stay clear. */
    x: clamp(
      direction > 0
        ? headStage.left - 54
        : headStage.left + headStage.width + 54,
      62,
      width - 62,
    ),
    y: stage.top - 61,
  };
  const faceFrames: Keyframe[] = [];
  const face = (
    time: number,
    point: Point,
    opacity: number,
    angle = 0,
    easing = smooth,
  ) =>
    faceFrames.push({
      offset: at(time),
      transform: `translate(${point.x}px, ${point.y}px) rotate(${angle}deg)`,
      opacity,
      easing,
    });
  face(0, rest, 0);
  face(6000, rest, 0);
  face(6550, { ...rest, y: rest.y + 6 }, 1);
  face(7000, { ...rest, y: rest.y + 4.5 }, 1);
  face(7350, { ...rest, y: rest.y + 5 }, 1);
  face(9050, { ...rest, y: rest.y + 5 }, 1);
  const crouch = { ...rest, y: rest.y + 8 };
  face(9280, crouch, 1);
  const destination = {
    x: clamp(landing.x - direction * 64, 62, width - 62),
    y: landing.y - 61,
  };
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    face(
      mix(9430, 10250, t),
      {
        x: mix(rest.x, destination.x, t),
        y: mix(crouch.y, destination.y, t) - 4 * 42 * t * (1 - t),
      },
      1,
      -direction * Math.sin(Math.PI * t) * 7,
      'linear',
    );
  }
  face(10350, { ...destination, y: destination.y + 3 }, 1);
  face(10550, destination, 1);
  face(11600, destination, 1);
  face(11920, destination, 0);
  face(12000, destination, 0);
  const opacity = (points: [number, number][]) =>
    points.map(([time, value]) => ({
      offset: at(time),
      opacity: value,
      easing: smooth,
    }));
  return {
    anchors: [...(composer ? [composer] : []), ...(card ? [card] : [])],
    card,
    ledge,
    size,
    prints,
    surfaceFrames: card || ledge ? surfaceFrames : [],
    faceFrames,
    faceParts: {
      [FootprintPart.Eyes]: opacity([
        [0, 1],
        [7100, 1],
        [7180, 0],
        [7320, 1],
        [8500, 1],
        [8580, 0],
        [8720, 1],
        [10800, 1],
        [11300, 0],
        [12000, 0],
      ]),
      [FootprintPart.Gaze]: [
        [0, 0],
        [6500, 0],
        [6750, -4],
        [7600, -4],
        [8000, 4],
        [8650, 4],
        [9050, 0],
        [12000, 0],
      ].map(([time, x]) => ({
        offset: at(time),
        transform: `translateX(${x}px)`,
        easing: smooth,
      })),
      [FootprintPart.Grin]: opacity([
        [0, 0],
        [7450, 0],
        [8100, 1],
        [11700, 1],
        [11920, 0],
        [12000, 0],
      ]),
    },
  };
};
