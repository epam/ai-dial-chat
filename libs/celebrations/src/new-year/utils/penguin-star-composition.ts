import {
  fixed,
  flipperArt,
  identity,
  leftFootArt,
  crumpledPaperArt,
  penguinArt,
  potArt,
  rightFootArt,
  snowArt,
  starArt,
  treeArt,
  type StarProperty,
  type StarShape,
  type StarTransform,
} from './penguin-star-art';
import type { PenguinStarTargets } from './penguin-star-targets';

/** Side entrance, borrowed interface fragment, paper star and fir decoration. */
export const PENGUIN_STAR_MS = 20000;
const FPS = 60;
const TREE_X = 0;
const NEAR_TREE_X = -65;
const TREE_HEIGHT = 140;
const TREE_CROWN_Y = -TREE_HEIGHT - 8;
type Point = [number, number];
type Sample = [seconds: number, position: Point];
type Scalar = [seconds: number, value: number];
interface Layer {
  ty: number;
  ind: number;
  nm: string;
  parent?: number;
  ip: number;
  op: number;
  st: number;
  sr: number;
  ks: StarTransform;
  shapes: StarShape[];
}

/** Local Lottie data and the measured elements it depends on. */
export interface PenguinStarComposition {
  /** Read-only source elements watched throughout playback. */
  targets: PenguinStarTargets;
  /** Measured destination for the borrowed control's reversible DOM motion. */
  capturePoint: Point;
  /** Serializable native vector composition. */
  animationData: {
    v: string;
    fr: number;
    ip: number;
    op: number;
    w: number;
    h: number;
    nm: string;
    ddd: number;
    assets: never[];
    layers: Layer[];
  };
}

const animated = (
  samples: [number, number[]][],
  linear = false,
): StarProperty => ({
  a: 1,
  k: samples.map(([seconds, s], index) => ({
    t: seconds * FPS,
    s,
    ...(index === samples.length - 1
      ? {}
      : {
          e: samples[index + 1][1],
          o: { x: linear ? 0 : 0.42, y: 0 },
          i: { x: linear ? 1 : 0.58, y: 1 },
        }),
  })),
});
const scalar = (samples: Scalar[], linear = false): StarProperty =>
  animated(
    samples.map(([t, n]) => [t, [n]]),
    linear,
  );
const add = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
const rotate = ([x, y]: Point, angle: number): Point => {
  const radians = (angle * Math.PI) / 180;
  return [
    x * Math.cos(radians) - y * Math.sin(radians),
    x * Math.sin(radians) + y * Math.cos(radians),
  ];
};
const groupTransform = (
  shapes: StarShape[],
  name: string,
): StarShape | undefined => {
  for (const shape of shapes) {
    if (shape.nm === name) return shape.it?.find((item) => item.ty === 'tr');
    const nested = shape.it && groupTransform(shape.it, name);
    if (nested) return nested;
  }
  return undefined;
};
const walk = (
  from: Point,
  to: Point,
  start: number,
  end: number,
  steps: number,
): Sample[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const phase = index / steps;
    const progress = phase * phase * (3 - 2 * phase);
    const bob = index === 0 || index === steps ? 0 : index % 2 ? -3 : 0;
    return [
      start + (end - start) * progress,
      [
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress + bob,
      ],
    ];
  });

/** Compose the actors and star handoffs on one Lottie clock. */
export const buildPenguinStarComposition = (
  targets: PenguinStarTargets,
  isMobile: boolean,
): PenguinStarComposition => {
  const size = isMobile ? 0.68 : 0.9;
  const dir = targets.rtl ? -1 : 1;
  const floor = targets.box.top + 2 * size;
  const world = ([x, y]: Point): Point => [
    targets.center + dir * size * x,
    floor + size * y,
  ];
  const local = ([x, y]: Point): Point => [
    (x - targets.center) / (dir * size),
    (y - floor) / size,
  ];
  const throwX = local([targets.throwCenter, floor])[0];
  const sideX = targets.rtl
    ? Math.min(
        targets.width + 60 * size,
        targets.box.left + targets.box.width + 60 * size,
      )
    : Math.max(-60 * size, targets.box.left - 60 * size);
  const entrance: Point = local([sideX, floor]);
  const throwHome: Point = [throwX, 0];
  const nearTree: Point = [NEAR_TREE_X, 0];
  const arrival = walk(entrance, throwHome, 0, 4, 12);
  const departure = walk(nearTree, entrance, 16, 20, 12);
  const poses: Sample[] = [
    ...arrival,
    [5.1, [throwX, -3]],
    [6.7, [throwX, 2]],
    [7.6, throwHome],
    [8.5, [throwX, -12]],
    [9.05, throwHome],
    [10.7, throwHome],
    [11.8, throwHome],
    ...walk(throwHome, nearTree, 11.8, 13.5, 8).slice(1),
    [14.8, nearTree],
    [15.1, [NEAR_TREE_X, 4]],
    [15.7, [NEAR_TREE_X, -3]],
    [16, nearTree],
    ...departure.slice(1),
  ];
  const grip = (position: Point, angle: number): Point =>
    add(add(position, [20, -47]), rotate([28, 0], angle));
  const capturePoint = world(grip([throwX, 2], -35 * dir));

  const layers: Layer[] = [];
  const transform = (
    position: Point,
    scaleX = dir * size * 100,
  ): StarTransform => ({
    ...identity(),
    p: fixed(world(position)),
    s: fixed([scaleX, size * 100]),
  });
  const layer = (
    name: string,
    shapes: StarShape[],
    ks: StarTransform,
    ip = 0,
    op = 20,
  ): Layer => {
    const result: Layer = {
      ty: 4,
      ind: layers.length + 1,
      nm: name,
      ip: ip * FPS,
      op: op * FPS,
      st: 0,
      sr: 1,
      ks,
      shapes,
    };
    layers.push(result);
    return result;
  };
  const fade = () =>
    scalar([
      [0, 0],
      [0.4, 100],
      [19.6, 100],
      [20, 0],
    ]);
  const stageFade = () =>
    scalar([
      [0, 100],
      [19.4, 100],
      [20, 0],
    ]);
  if (!targets.source) {
    const snowKs = transform(local([targets.width / 2, floor + 4 * size]));
    snowKs.o = stageFade();
    layer(
      'snow-stage',
      snowArt(Math.min(targets.width - 32, 560) / size, 13),
      snowKs,
    );
  }

  const treeKs = transform([TREE_X, 0]);
  treeKs.r = scalar([
    [0, 0],
    [10.7, 0],
    [10.9, 6 * dir],
    [11.15, -3 * dir],
    [11.55, 0],
    [11.8, 0],
    [13.5, -10 * dir],
    [13.8, -10 * dir],
    [15, 0],
    [20, 0],
  ]);
  treeKs.o = stageFade();
  const tree = layer('fir-tree', treeArt(TREE_HEIGHT), treeKs);
  const potKs = transform([TREE_X, 0]);
  potKs.o = stageFade();
  layer('fir-pot', potArt(), potKs);

  const bodyKs = transform(poses[0][1]);
  bodyKs.p = animated(
    poses.map(([t, position]) => [t, world(position)]),
    true,
  );
  bodyKs.r = scalar([
    [0, 0],
    [2.4, 3 * dir],
    [4, 0],
    [5.1, -7 * dir],
    [6.7, 8 * dir],
    [7.6, 0],
    [8.5, -9 * dir],
    [9.05, 0],
    [10.7, 0],
    [11.8, 0],
    [12.7, 3 * dir],
    [13.5, 0],
    [15.1, 7 * dir],
    [15.7, -2 * dir],
    [16, 0],
    [20, 0],
  ]);
  bodyKs.o = fade();
  const penguinShapes = penguinArt();
  const head = groupTransform(penguinShapes, 'head-rig');
  if (head) {
    head.p = animated([
      [0, [0, -72]],
      [14.8, [0, -72]],
      [15.1, [0, -65]],
      [15.7, [0, -72]],
      [20, [0, -72]],
    ]);
    head.r = scalar([
      [0, 0],
      [5.1, -10 * dir],
      [6.8, 7 * dir],
      [7.6, 0],
      [10.7, 0],
      [11.05, -9 * dir],
      [11.45, 5 * dir],
      [11.7, 0],
      [12.1, 0],
      [12.7, -3 * dir],
      [13.5, 0],
      [20, 0],
    ]);
  }
  const glasses = groupTransform(penguinShapes, 'sunglasses');
  if (glasses) {
    glasses.r = scalar([
      [0, 0],
      [5.1, -4],
      [6.8, 6],
      [7.6, 0],
      [8.5, -6],
      [10.7, 0],
      [11.7, 0],
      [12.7, -4],
      [15, 0],
      [20, 0],
    ]);
  }
  layer('penguin', penguinShapes, bodyKs);

  const foot = (name: string, side: -1 | 1, shapes: StarShape[]) => {
    const ks = transform(poses[0][1]);
    ks.p = animated(
      poses.map(([t, position]) => {
        const moving = t <= 4 || t >= 16;
        const phase = Math.sin(t * Math.PI * 5 + (side === 1 ? Math.PI : 0));
        return [
          t,
          world(
            add(position, [
              side * 16 + (moving ? phase * 5 : 0),
              moving ? -Math.max(0, phase) * 4 : 0,
            ]),
          ),
        ];
      }),
      true,
    );
    ks.o = fade();
    layer(name, shapes, ks);
  };
  foot('penguin-left-foot', -1, leftFootArt());
  foot('penguin-right-foot', 1, rightFootArt());

  const flipperKs = transform(add(poses[0][1], [20, -47]));
  flipperKs.p = animated(
    poses.map(([t, position]) => [t, world(add(position, [20, -47]))]),
    true,
  );
  flipperKs.r = scalar([
    [0, 60 * dir],
    [4.2, 60 * dir],
    [5.1, -50 * dir],
    [6.7, -35 * dir],
    [7.3, 20 * dir],
    [7.6, 60 * dir],
    [8.5, -70 * dir],
    [9.05, 60 * dir],
    [14.8, 60 * dir],
    [15.1, 30 * dir],
    [16, 60 * dir],
    [20, 60 * dir],
  ]);
  flipperKs.o = fade();
  const flipper = layer('penguin-flipper', flipperArt(), flipperKs);

  const carriedStar = (name: string, start: number, end: number) => {
    const star = layer(
      name,
      starArt(),
      {
        ...identity(),
        p: fixed([28, 0]),
        ...(name === 'star-in-flipper'
          ? {
              s: animated([
                [7.6, [26, 26]],
                [7.92, [110, 110]],
                [8.25, [100, 100]],
              ]),
            }
          : {}),
      },
      start,
      end,
    );
    star.parent = flipper.ind;
  };
  const paper = layer(
    'crumpled-interface',
    crumpledPaperArt(),
    {
      ...identity(),
      p: fixed([28, 0]),
      r: scalar([
        [6.7, 0],
        [7.4, 460 * dir],
        [7.6, 540 * dir],
      ]),
      s: animated([
        [6.7, [100, 100]],
        [7.4, [76, 76]],
        [7.6, [26, 26]],
      ]),
    },
    6.7,
    7.6,
  );
  paper.parent = flipper.ind;
  carriedStar('star-in-flipper', 7.6, 8.5);

  const freeStarKs = transform(grip([throwX, -12], -70), size * 100);
  const freeStarPath: Sample[] = [
    [8.5, grip([throwX, -12], -70)],
    [9.2, [throwX * 0.64, TREE_CROWN_Y - 180]],
    [9.85, [throwX * 0.25, TREE_CROWN_Y - 145]],
    [10.7, [TREE_X, TREE_CROWN_Y]],
  ];
  freeStarKs.p = animated(
    freeStarPath.map(([t, position]) => [t, world(position)]),
  );
  freeStarKs.r = scalar([
    [8.5, 0],
    [9.2, 220 * dir],
    [10.7, 360 * dir],
  ]);
  layer('thrown-star', starArt(), freeStarKs, 8.5, 10.7);

  const crownStar = layer(
    'star-on-fir',
    starArt(),
    {
      ...identity(),
      p: fixed([0, TREE_CROWN_Y]),
    },
    10.7,
    20,
  );
  crownStar.parent = tree.ind;

  return {
    targets,
    capturePoint,
    animationData: {
      v: '5.13.0',
      fr: FPS,
      ip: 0,
      op: (PENGUIN_STAR_MS / 1000) * FPS,
      w: targets.width,
      h: targets.height,
      nm: 'Penguin and the last star',
      ddd: 0,
      assets: [],
      layers: layers.reverse(),
    },
  };
};
