import {
  bodyArt,
  ellipse,
  fixed,
  group,
  headArt,
  headOrigin,
  headScale,
  identity,
  legArt,
  neckArt,
  path,
  positioned,
  REINDEER_PALETTE as P,
  REINDEER_NECK,
  scarfArt,
  sleighArt,
  tailArt,
  type ReindeerPoint as Point,
  type ReindeerProperty,
  type ReindeerShape,
  type ReindeerTransform,
} from './reindeer-art';
import {
  buildDeerMotion,
  flightPoint,
  nosePoint,
  posePoint,
  REINDEER_HIPS,
  smoothStep,
  type FlightKnot,
} from './reindeer-physics';
import type { ReindeerTargets } from './reindeer-targets';
import { EASE, EASE_OUT, Track, type Vec } from './snowman-delivery-timeline';

export const REINDEER_TAKEOFF_MS = 23000;
export const REINDEER_BEATS = {
  caught: 3.6,
  pull: 4.6,
  pullEnd: 6.1,
  strongPull: 8.6,
  strongEnd: 10.1,
  discover: 10.8,
  approach: 12.3,
  failedNudge: 12.9,
  grip: 14.2,
  release: 14.7,
  restored: 15.8,
  launch: 16.2,
  flight: 17.4,
  exit: 22.4,
} as const;
const B = REINDEER_BEATS;
const FPS = 60;
const END = REINDEER_TAKEOFF_MS / 1000;
const CALF = 0.68;
/* Subpixel precision is ample at scene scale and avoids encoding floating
   point noise in hundreds of authored keys. Probes retain full precision. */
const rounded = (value: number) => Math.round(value * 100) / 100;

interface Layer {
  ty: number;
  ind: number;
  nm: string;
  ip: number;
  op: number;
  st: number;
  sr: number;
  ks: ReindeerTransform;
  shapes: ReindeerShape[];
}

/** Local vector composition and the only external prop's synchronized keyframes. */
export interface ReindeerComposition {
  targets: ReindeerTargets;
  animationData: {
    v: string;
    fr: number;
    ip: number;
    op: number;
    w: number;
    h: number;
    nm: string;
    ddd: number;
    assets: unknown[];
    layers: Layer[];
  };
  wordFrames: Keyframe[];
  particleCount: number;
  probe: (seconds: number) => {
    nose: Point;
    loop: Point;
    catchPoint: Point;
    displacement: number;
    adult: Point;
    calf: Point;
    sleigh: Point;
    hooves: { point: Point; planted: boolean; reach: number }[];
  };
}

/** Each key owns its start value; the next start is the segment endpoint. */
const property = (track: Track): ReindeerProperty => {
  if (!track.isAnimated)
    return fixed(track.keys[0]?.v.length === 1 ? track.at(0) : track.value(0));
  return {
    a: 1,
    k: track.keys.map((key, i) => {
      /* Tenths of a degree stay well below a pixel at this scale; positions
         retain hundredths. Avoid spending payload on invisible angle digits. */
      const values = key.v.map((value) =>
        key.v.length === 1 ? Math.round(value * 10) / 10 : rounded(value),
      );
      const next = track.keys[i + 1];
      if (!next) return { t: rounded(key.t * FPS), s: values };
      if (key.ease === 'hold')
        return { t: rounded(key.t * FPS), s: values, h: 1 };
      const ease = key.ease === 'linear' ? [0, 0, 1, 1] : key.ease;
      return {
        t: rounded(key.t * FPS),
        s: values,
        o: { x: ease[0], y: ease[1] },
        i: { x: ease[2], y: ease[3] },
      };
    }),
  };
};
const point = (v: Vec): Point => [v[0], v[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const rotate = ([x, y]: Point, deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};
const easeCss = (track: Track, t: number) => {
  const ease = track.keys.find((key) => key.t === t)?.ease ?? EASE;
  if (ease === 'hold') return 'step-end';
  if (ease === 'linear') return 'linear';
  return `cubic-bezier(${ease.join(',')})`;
};

/** All geometry is precomputed; Lottie and the word copy consume a single clock. */
export const buildReindeerComposition = (
  targets: ReindeerTargets,
  isMobile: boolean,
): ReindeerComposition => {
  const { origin, scale: s, dir } = targets;
  const world = ([x, y]: Point): Point => [
    origin[0] + dir * s * x,
    origin[1] + s * y,
  ];
  const caught: Point = [
    (targets.catchPoint[0] - origin[0]) / (dir * s),
    (targets.catchPoint[1] - origin[1]) / s,
  ];
  /* Enter from the measured leading edge. The wide desktop stage must not
     compress the walk to the same hundred pixels as a phone. */
  const entryEdge = dir === 1 ? targets.rim.left : targets.rim.right;
  const exitEdge = dir === 1 ? targets.bounds.right : targets.bounds.left;
  const entryX = (entryEdge - origin[0]) / (dir * s) - 90;
  const farX = (exitEdge - origin[0]) / (dir * s);
  const cruiseX = Math.max(124, farX - 100);
  const cruiseY = Math.min(
    -80,
    (Math.max(
      /* Leave a clear band above the antlers for the scene announcement. */
      190 * s + 144,
      Math.min(targets.height * 0.27, origin[1] - 140 * s),
    ) -
      origin[1]) /
      s,
  );
  const exitX = farX + 330;
  const displacement = new Track([0])
    .hold(B.pull)
    .set(B.pullEnd, 12)
    .set(7.1, 1)
    .hold(B.strongPull)
    .set(B.strongEnd, 32)
    .hold(B.release)
    .set(15.05, -2, EASE_OUT)
    .set(15.35, 0.8)
    .set(15.65, 0)
    .hold(END);
  const wordRadius = targets.word ? (targets.word.rect.height / 2 - 2) / s : 0;
  const fullTilt = (32 * 0.4 * Math.PI) / 180;
  /* The second pull lifts the caught word to the calf's nose while its hooves
     remain on the input rim. Rotation and translation share the same grip. */
  const neutralNose = nosePoint(true, 0, 0);
  const wordLift = targets.word
    ? CALF * (neutralNose[1] + 3) -
      caught[1] -
      wordRadius * (Math.cos(fullTilt) - 1)
    : 0;
  const catchAt = (t: number): Point => {
    const dx = displacement.at(t);
    if (!targets.word) return add(caught, [dx, 0]);
    const radius = wordRadius;
    const angle = (dx * 0.4 * Math.PI) / 180;
    return add(caught, [
      dx - radius * Math.sin(angle),
      (wordLift * dx) / 32 + radius * (Math.cos(angle) - 1),
    ]);
  };
  const adult = new Track([entryX, 0])
    .set(0, [entryX, 0], [0.18, 0.08, 0.65, 1])
    .set(B.caught, [110, 0])
    .hold(B.pull)
    .set(B.pullEnd, [115, 0])
    .set(7.1, [111, 0])
    .hold(B.strongPull)
    .set(B.strongEnd, [124, 0])
    .hold(B.launch);
  const calf = new Track([entryX - 110, 0])
    .set(0, [entryX - 110, 0], [0.18, 0.08, 0.65, 1])
    .set(B.caught, [0, 0])
    .hold(B.pull)
    .set(B.pullEnd, [3, 0])
    .set(7.1, [0, 0])
    .hold(B.strongPull)
    .set(B.strongEnd, [9, 0])
    .hold(B.discover);
  const noseOffset = neutralNose;
  const contactRoot: Point = [
    catchAt(B.grip)[0] + CALF * noseOffset[0],
    catchAt(B.grip)[1] - CALF * (noseOffset[1] + 3),
  ];
  calf
    .hold(11.1)
    .set(B.approach, contactRoot)
    .hold(15.25)
    .set(16.25, [14, 0])
    .hold(16.4);
  const sled = new Track([entryX - 220, 0])
    .set(0, [entryX - 220, 0], [0.18, 0.08, 0.65, 1])
    .set(B.caught, [-110, 0])
    .hold(B.pull + 0.12)
    .set(B.pullEnd + 0.12, [-105, 0])
    .set(7.3, [-109, 0])
    .hold(B.strongPull + 0.12)
    .set(B.strongEnd + 0.12, [-96, 0])
    .hold(16.55);
  /* Shared tangents carry momentum through the climb and into the exit.
     Followers take up tension later, then smoothly recover their spacing. */
  const flight: FlightKnot[] = [
    { time: B.launch, point: [124, 0], velocity: [0, 0] },
    {
      time: 17.2,
      point: [124 + (cruiseX - 124) * 0.06, cruiseY * 0.24],
      velocity: [(cruiseX - 124) * 0.13, cruiseY * 0.36],
    },
    {
      time: 18.6,
      point: [124 + (cruiseX - 124) * 0.34, cruiseY * 0.8],
      velocity: [(cruiseX - 124) * 0.25, cruiseY * 0.22],
    },
    {
      time: 20.5,
      point: [cruiseX, cruiseY],
      velocity: [Math.max(20, (cruiseX - 124) * 0.4), -18],
    },
    {
      time: B.exit,
      point: [exitX, cruiseY - 70],
      velocity: [(exitX - cruiseX) * 0.8, -55],
    },
  ];
  const fly = (root: Track, delay: number, offset: Point) => {
    const airborne = new Track()
      .sample(
        B.launch + delay,
        B.exit,
        0.04,
        (t) => {
          const time = t - delay * (1 - smoothStep((t - 19) / (B.exit - 19)));
          const p = flightPoint(flight, time);
          return [
            p[0] + offset[0],
            p[1] + offset[1] * smoothStep((t - B.launch - delay) / 1.8),
          ];
        },
        flight.map(({ time }) => time + delay).filter((t) => t < B.exit),
      )
      .prune(0.035);
    for (const key of airborne.keys) root.set(key.t, key.v, key.ease);
  };
  fly(adult, 0, [0, 0]);
  fly(calf, 0.2, [-110, 9]);
  fly(sled, 0.35, [-220, 20]);
  const adultLean = new Track([0])
    .hold(B.pull - 0.4)
    .set(B.pull, 8)
    .set(B.pullEnd, -5)
    .set(7.1, 0)
    .set(B.strongPull, 12)
    .set(B.strongEnd, -9)
    .set(11, 0)
    .hold(15.4)
    .set(B.launch, 14, EASE_OUT)
    .set(16.7, -16)
    .set(17.4, -8)
    .set(19, -3);
  const adultHead = new Track([0])
    .set(3.8, -8)
    .set(B.pull, 6)
    .set(B.pullEnd, -4)
    .set(7, -23)
    .set(8.2, 0)
    .set(B.strongPull, 12)
    .set(B.strongEnd, 4)
    .set(11, -16)
    .set(12, 0)
    .set(15.7, 12)
    .set(16.7, -19)
    .set(18.2, -7)
    .set(19, -2);
  const adultNeck = new Track([0])
    .hold(3.75)
    .set(4.2, -8)
    .set(B.pull, 5)
    .set(B.pullEnd, -8)
    .hold(6.45)
    .set(7.1, -14)
    .hold(7.6)
    .set(8.1, 0)
    .set(B.strongPull, 12)
    .set(B.strongEnd, -12)
    .hold(10.4)
    .set(11.1, -5)
    .hold(14.7)
    .set(15.15, 8)
    .set(15.6, -4)
    .set(B.launch, 9)
    .set(16.9, -12)
    .set(18, -4)
    .set(19, 0);
  const calfNeck = new Track([0])
    .hold(4)
    .set(4.7, 5)
    .set(6.2, -8)
    .hold(6.6)
    .set(7.2, 0)
    .hold(9.9)
    .set(10.45, -11)
    .set(B.discover, 5)
    .set(11.3, 0)
    .hold(B.approach)
    .set(B.failedNudge, 5)
    .set(13.35, -4)
    .set(13.8, 0)
    .hold(B.grip)
    .set(B.release, -8)
    .hold(15.1)
    .set(15.55, -12)
    .set(16.1, 4)
    .set(17, -10)
    .set(18.5, 0);
  const calfHead = new Track([0])
    .set(7, -10)
    .set(B.discover, 12)
    .set(B.approach, 0)
    .set(B.failedNudge, 16)
    .set(13.35, 0)
    .hold(B.grip)
    .set(B.release, -22)
    .set(15.15, -22)
    .set(16, 0)
    .set(17, -12)
    .set(18.6, -4)
    .set(20, -10);
  const calfFacing = new Track([1])
    /* Switch the silhouette during a blink; never squash the drawing to turn. */
    .hold(10.945, 'hold')
    .set(10.955, -1)
    .hold(15.095, 'hold')
    .set(15.105, 1);
  const calfLean = new Track([0])
    .hold(15.8)
    .set(16.4, 10)
    .set(17, -13)
    .set(17.8, -6)
    .set(19.3, -2);
  const adultMotion = buildDeerMotion(
    adult,
    adultLean,
    new Track([1]),
    1,
    [{ start: 0, end: B.caught, facing: 1 }],
    B.launch,
  );
  const calfMotion = buildDeerMotion(
    calf,
    calfLean,
    calfFacing,
    CALF,
    [
      { start: 0, end: B.caught, facing: 1 },
      { start: 11.1, end: B.approach, facing: -1 },
      { start: 15.25, end: 16.25, facing: 1 },
    ],
    16.4,
    true,
  );
  const noseAt = (t: number): Point =>
    posePoint(
      calfMotion.poseAt(t),
      nosePoint(true, calfNeck.at(t), calfHead.at(t)),
    );
  const sledPitch = new Track([0])
    .hold(16.55)
    .set(17.3, -14)
    .set(17.85, -5)
    .set(18.4, -9)
    .set(19.1, -5)
    .hold(20.4)
    .set(21.5, -12)
    .set(B.exit, -9);
  const sledPoint = (t: number, at: Point): Point =>
    add(point(sled.value(t)), rotate(at, sledPitch.at(t)));
  const loopAt = (t: number): Point => {
    if (t < B.grip) return catchAt(t);
    if (t <= B.release) return noseAt(t);
    const end = sledPoint(t, [-8, -59]);
    const p = Math.min(1, (t - B.release) / 0.7);
    const start = noseAt(B.release);
    return [
      start[0] + (end[0] - start[0]) * p,
      start[1] + (end[1] - start[1]) * p + 15 * Math.sin(p * Math.PI),
    ];
  };
  const layers: Layer[] = [];
  const stageTransform = (): ReindeerTransform => ({
    ...identity(),
    p: fixed(origin),
    s: fixed([dir * s * 100, s * 100]),
  });
  const addLayer = (
    nm: string,
    shapes: ReindeerShape[],
    ks = stageTransform(),
    ip = 0,
    op = END,
  ) => {
    layers.push({
      ty: 4,
      ind: layers.length + 1,
      nm,
      ip: ip * FPS,
      op: op * FPS,
      st: 0,
      sr: 1,
      ks,
      shapes,
    });
  };
  const scenery = stageTransform();
  scenery.o = property(new Track([0]).set(0.5, 100).hold(21.8).set(END, 0));
  addLayer(
    'snow-path',
    [
      group(
        'snow',
        [
          path(
            [
              [(entryEdge - origin[0]) / (dir * s), 3],
              [
                ((dir === 1 ? targets.rim.right : targets.rim.left) -
                  origin[0]) /
                  (dir * s),
                3,
              ],
            ],
            false,
          ),
        ],
        undefined,
        P.ice,
        7,
      ),
      group(
        'snow-cap',
        [
          path(
            [
              [(entryEdge - origin[0]) / (dir * s), 0],
              [
                ((dir === 1 ? targets.rim.right : targets.rim.left) -
                  origin[0]) /
                  (dir * s),
                0,
              ],
            ],
            false,
          ),
        ],
        undefined,
        P.snow,
        4,
      ),
    ],
    scenery,
  );
  const iceTransform = stageTransform();
  const icePosition = new Track();
  for (const key of displacement.keys)
    icePosition.set(key.t, world([key.v[0], 0]), key.ease);
  iceTransform.p = property(icePosition);
  iceTransform.o = scenery.o;
  if (!targets.word)
    addLayer(
      'ice-catch',
      [
        group(
          'ice-highlight',
          [
            path(
              [
                [caught[0] - 5, caught[1] + 18],
                [caught[0], caught[1]],
              ],
              false,
            ),
          ],
          undefined,
          P.white,
          2,
        ),
        group(
          'ice',
          [
            path(
              [
                [caught[0] - 12, 0],
                [caught[0] - 8, caught[1] + 7],
                [caught[0], caught[1] - 2],
                [caught[0] + 10, caught[1] + 10],
                [caught[0] + 14, 0],
              ],
              true,
              0.08,
            ),
          ],
          P.ice,
        ),
      ],
      iceTransform,
    );

  /* A small fixed set of points is morphed, never DOM geometry. Coupled shapes
     share all root keys so the reins cannot detach at a phase boundary. */
  const times = [
    ...new Set([
      0,
      B.caught,
      B.pull,
      B.pullEnd,
      7.1,
      B.strongPull,
      B.strongEnd,
      B.discover,
      B.approach,
      B.failedNudge,
      13.35,
      B.grip,
      B.release,
      15.05,
      15.15,
      15.35,
      15.65,
      16.05,
      B.launch,
      16.35,
      16.45,
      16.7,
      17.1,
      17.2,
      B.flight,
      18,
      20.5,
      B.exit,
      END,
      ...adultMotion.position.keys.map(({ t }) => t),
      ...calfMotion.position.keys.map(({ t }) => t),
      ...calfFacing.keys.map(({ t }) => t),
      ...Array.from({ length: 70 }, (_, i) => +(3.5 + i * 0.28).toFixed(3)),
    ]),
  ].sort((a, b) => a - b);
  const animatedLine = (
    name: string,
    pointsAt: (t: number) => Point[],
    color: string,
    width: number,
    end = END,
  ) => {
    const samples = new Track()
      .sample(0, end, 0.08, (t) => pointsAt(t).flat(), times)
      .prune(0.65);
    const data = samples.keys.map(({ v }) => {
      const vertices = Array.from({ length: v.length / 2 }, (_, i) => [
        v[i * 2],
        v[i * 2 + 1],
      ]);
      return {
        v: vertices.map((vertex) => vertex.map(rounded)),
        i: vertices.map(() => [0, 0]),
        o: vertices.map(() => [0, 0]),
        c: false,
      };
    });
    return group(
      name,
      [
        {
          ty: 'sh',
          ks: {
            a: 1,
            k: samples.keys.map(({ t }, i) => ({
              t: rounded(t * FPS),
              s: [data[i]],
              ...(i + 1 < samples.keys.length
                ? {
                    o: { x: 0, y: 0 },
                    i: { x: 1, y: 1 },
                  }
                : {}),
            })),
          },
        },
      ],
      undefined,
      color,
      width,
    );
  };
  const ribbonSlack = new Track([18])
    .hold(4.2)
    .set(B.pull, 3)
    .hold(B.pullEnd)
    .set(7.1, 18)
    .hold(8.1)
    .set(B.strongPull, 2)
    .hold(B.release)
    .set(15.05, 13)
    .set(15.5, 5);
  const ribbon = animatedLine(
    'gift-ribbon',
    (t) => {
      const a = sledPoint(t, [-8, -63]);
      const b = loopAt(t);
      const slack = ribbonSlack.at(t);
      return [
        a,
        [(2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3 + slack],
        [(a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3 + slack],
        b,
      ];
    },
    P.gold,
    2.8,
    15.5,
  );
  addLayer('caught-ribbon', [ribbon], stageTransform(), B.caught - 0.15, 15.5);
  const loopTrack = new Track()
    .sample(B.caught, 15.5, 0.18, loopAt, times)
    .prune(0.15);
  addLayer(
    'ribbon-loop',
    [
      {
        ...group('loop', [ellipse([0, 0], [17, 12])], undefined, P.gold, 2.8, {
          ...identity(),
          p: property(loopTrack),
        }),
        cl: 'reindeer-loop',
      },
    ],
    stageTransform(),
    B.caught,
    15.5,
  );
  addLayer('reins', [
    animatedLine(
      'harness-line',
      (t) => {
        const a = sledPoint(t, [44, -23]);
        const c = posePoint(calfMotion.poseAt(t), [18, -65]);
        const b = posePoint(adultMotion.poseAt(t), [15, -65]);
        const sag = (from: Point, to: Point, length: number): Point => [
          (from[0] + to[0]) / 2,
          (from[1] + to[1]) / 2 +
            Math.max(
              2,
              Math.min(
                16,
                (length - Math.hypot(to[0] - from[0], to[1] - from[1])) * 0.3,
              ),
            ),
        ];
        return [a, sag(a, c, 88), c, sag(c, b, 118), b];
      },
      P.gold,
      1.5,
    ),
  ]);
  addLayer('gift-sleigh', [
    group('sleigh-rig', sleighArt(), undefined, undefined, 1, {
      ...identity(),
      p: property(sled),
      r: property(sledPitch),
    }),
  ]);

  const drawDeer = (isCalf: boolean, lean: Track, head: Track) => {
    const motion = isCalf ? calfMotion : adultMotion;
    const size = isCalf ? CALF : 1;
    const facing = isCalf ? calfFacing : new Track([1]);
    const groupScale = new Track();
    for (const key of facing.keys)
      groupScale.set(key.t, [key.v[0] * size * 100, size * 100], key.ease);
    const eye = new Track([100, 100]);
    if (isCalf) {
      eye
        .hold(6.65)
        .set(6.75, [100, 8])
        .set(6.9, [100, 100])
        .hold(10.75)
        .set(10.93, [100, 8])
        .set(11.1, [100, 110])
        .hold(12.65)
        .set(12.9, [100, 65])
        .set(13.4, [100, 100])
        .hold(14.95)
        .set(15.1, [100, 8])
        .set(15.25, [100, 100])
        .hold(16.4)
        .set(16.8, [110, 125])
        .hold(17.3)
        .set(18.3, [100, 100]);
    } else {
      eye
        .hold(4.4)
        .set(4.65, [100, 55])
        .set(6.2, [100, 55])
        .set(6.6, [100, 100])
        .hold(8.3)
        .set(8.65, [100, 12])
        .hold(10)
        .set(10.4, [100, 110])
        .hold(15.55)
        .set(16.1, [100, 30])
        .set(16.7, [100, 115])
        .set(18.5, [100, 90]);
    }
    const brow = new Track([0])
      .set(7, isCalf ? -12 : -20)
      .set(8, 0)
      .set(10.7, -18)
      .set(12, 0)
      .set(16.7, -25)
      .set(19, isCalf ? -8 : 12);
    const gaze = new Track([0, 0])
      .hold(3.7)
      .set(4.1, [1, 1])
      .hold(6.1)
      .set(6.6, [-2, 0])
      .hold(7.5)
      .set(8.15, [1, 1])
      .hold(10.1)
      .set(10.5, isCalf ? [-2, 2] : [-2, 0])
      .hold(11.1)
      .set(11.55, [2, 1])
      .hold(14.7)
      .set(15.25, [-1, -1])
      .set(16.1, [1, 0])
      .set(16.9, [1, -2])
      .set(18.5, [1, 0]);
    const ear = new Track([0])
      .hold(3.6)
      .set(4.1, isCalf ? -14 : 8)
      .set(4.8, 12)
      .hold(6.1)
      .set(6.5, -20)
      .set(6.85, -8)
      .hold(8.1)
      .set(8.65, 22)
      .hold(10.1)
      .set(10.5, isCalf ? -28 : -16)
      .set(10.8, -10)
      .hold(14.65)
      .set(15.1, -22)
      .set(15.5, 0)
      .set(16.9, 28)
      .set(17.65, 12)
      .set(18.3, 16);
    const parts: ReindeerShape[] = [];
    const legs = REINDEER_HIPS.map((hip, index) => {
      const { upper, knee, hoof } = motion.legs[index];
      return group(
        `leg-${index}`,
        legArt(index < 2, property(knee), property(hoof), hip[0] < 0),
        undefined,
        undefined,
        1,
        { ...positioned(hip), r: property(upper) },
      );
    });
    /* Shape groups are painted back-to-front by the SVG player. */
    const headGroup = group(
      'head-rig',
      headArt(
        isCalf,
        property(eye),
        property(brow),
        property(gaze),
        property(ear),
      ),
      undefined,
      undefined,
      1,
      {
        ...positioned(headOrigin(isCalf), headScale(isCalf)),
        r: property(head),
      },
    );
    const neckParts = [headGroup];
    if (isCalf)
      neckParts.push(
        group('scarf', scarfArt(), undefined, undefined, 1, {
          ...identity([34, -91]),
          r: property(
            new Track([0])
              .set(4, 8)
              .set(10, -8)
              .set(15, 4)
              .set(17, 42)
              .set(18, 24)
              .set(20, 38),
          ),
        }),
      );
    neckParts.push(...neckArt(isCalf));
    parts.push(
      legs[3],
      legs[2],
      group('neck-rig', neckParts, undefined, undefined, 1, {
        ...identity(REINDEER_NECK),
        r: property(isCalf ? calfNeck : adultNeck),
      }),
      ...bodyArt(isCalf),
      legs[1],
      legs[0],
      group('tail-rig', tailArt(), undefined, undefined, 1, {
        ...identity([-43, -67]),
        r: property(
          new Track([0])
            .set(4, -8)
            .set(8, 10)
            .set(10, -10)
            .set(15, 0)
            .set(17, 28)
            .set(19, 12),
        ),
      }),
    );
    const ks = {
      ...identity([0, -55]),
      p: property(motion.position),
      s: property(groupScale),
      r: property(lean),
    };
    const visibility = stageTransform();
    /* Departure is physical travel beyond the clip, not disappearing bodies. */
    addLayer(
      isCalf ? 'calf' : 'adult',
      [group('deer-rig', parts, undefined, undefined, 1, ks)],
      visibility,
    );
  };
  drawDeer(false, adultLean, adultHead);
  drawDeer(true, calfLean, calfHead);
  /* Deposit snow at past sleigh positions. It drifts downward instead of
     following the cast, so the airborne route remains readable behind it. */
  const particleCount = isMobile ? 16 : 24;
  const wake: ReindeerShape[] = [];
  for (let i = 0; i < particleCount; i++) {
    const start = 16.8 + (i * 5.2) / (particleCount - 1);
    const end = Math.min(END, start + 2.8);
    const at = sledPoint(start, [-58, (i % 3) * 5 - 4]);
    wake.push(
      group(
        `wake-${i}`,
        [
          ellipse([0, 0], [10 + (i % 3) * 2, 8]),
          ellipse([-10, 6], [5, 5]),
          ellipse([5, -6], [4, 4]),
        ],
        i % 3 === 0 ? P.ice : P.snow,
        undefined,
        1,
        {
          ...identity(),
          p: property(new Track(at).hold(start).set(end, add(at, [-9, 18]))),
          o: property(
            new Track([0])
              .hold(start - 0.01, 'hold')
              .set(start, 95)
              .hold(start + 0.6)
              .set(end, 0),
          ),
        },
      ),
    );
  }
  addLayer('snow-wake', wake, stageTransform(), 16.7);
  const wordFrames: Keyframe[] = displacement.keys.map(({ t, v }) => ({
    offset: t / END,
    transform: `translate(${dir * s * v[0]}px,${(s * wordLift * v[0]) / 32}px) rotate(${dir * v[0] * 0.4}deg)`,
    easing: easeCss(displacement, t),
  }));
  return {
    targets,
    animationData: {
      v: '5.13.0',
      fr: FPS,
      ip: 0,
      op: END * FPS,
      w: targets.width,
      h: targets.height,
      nm: 'Reindeer, release the brake!',
      ddd: 0,
      assets: [],
      layers: layers.reverse(),
    },
    wordFrames,
    particleCount,
    probe: (t) => ({
      nose: world(noseAt(t)),
      loop: world(loopAt(t)),
      catchPoint: world(catchAt(t)),
      displacement: displacement.at(t) * s,
      adult: world(point(adult.value(t))),
      calf: world(point(calf.value(t))),
      sleigh: world(point(sled.value(t))),
      hooves: [adultMotion, calfMotion].flatMap((motion) =>
        REINDEER_HIPS.map((_, index) => ({
          point: world(motion.hoofAt(t, index).point),
          planted: motion.hoofAt(t, index).planted,
          reach: motion.legAt(t, index).reach,
        })),
      ),
    }),
  };
};
