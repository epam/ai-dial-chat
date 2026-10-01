import elves from '../assets/gift-wrapping-elves.json';
import { ELF_RIG } from './gift-wrapping-rig';
import type { GiftWrappingTarget } from './gift-wrapping-targets';

/** One authored timeline, independent of the display's refresh rate. */
export const GIFT_WRAPPING_MS = 16000;
const FPS = 60;
const END = (GIFT_WRAPPING_MS / 1000) * FPS;
enum ElfCharacter {
  Master = 'master',
  Helper = 'helper',
}
type Vector = number[];
type Sample = [seconds: number, value: Vector];
type ScalarSample = [seconds: number, value: number];
interface Property {
  a: number;
  k: unknown;
}
interface Shape {
  ty: string;
  nm?: string;
  it?: Shape[];
  [key: string]: unknown;
}
interface Transform {
  a: Property;
  p: Property;
  s: Property;
  r: Property;
  o: Property;
}
interface Layer {
  ty: number;
  ind: number;
  nm: string;
  ip: number;
  op: number;
  st: number;
  sr: number;
  ks: Transform;
  shapes: Shape[];
}
interface Contour {
  v: Vector[];
  i: Vector[];
  o: Vector[];
  c: boolean;
}

/** Measured stage plus native vector data consumed by the local SVG player. */
export interface GiftWrappingComposition {
  target: GiftWrappingTarget;
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

const fixed = (k: unknown): Property => ({ a: 0, k });
const animated = (samples: Sample[], linear = false): Property => ({
  a: 1,
  k: samples.map(([time, value], index) => ({
    t: time * FPS,
    s: value,
    ...(index === samples.length - 1
      ? {}
      : {
          e: samples[index + 1][1],
          o: { x: linear ? 0 : 0.42, y: 0 },
          i: { x: linear ? 1 : 0.58, y: 1 },
        }),
  })),
});
const scalar = (samples: ScalarSample[], linear = false) =>
  animated(
    samples.map(([time, value]) => [time, [value]]),
    linear,
  );
const held = (samples: ScalarSample[]): Property => ({
  a: 1,
  k: samples.map(([time, value]) => ({ t: time * FPS, s: [value], h: 1 })),
});
const transform = (): Transform => ({
  a: fixed([0, 0]),
  p: fixed([0, 0]),
  s: fixed([100, 100]),
  r: fixed(0),
  o: fixed(100),
});
const group = (nm: string, it: Shape[]): Shape => ({
  ty: 'gr',
  nm,
  it: [...it, { ty: 'tr', ...transform() }],
});
const contour = (v: Vector[], c = false): Contour => ({
  v,
  i: v.map(() => [0, 0]),
  o: v.map(() => [0, 0]),
  c,
});
const stroke = (color: Vector, width: number): Shape => ({
  ty: 'st',
  c: fixed(color),
  o: fixed(100),
  w: fixed(width),
  lc: 2,
  lj: 2,
});
const GOLD = [0.96, 0.72, 0.28, 1];
const INK = [0.42, 0.27, 0.17, 1];
const ribbon = (nm: string, path: Property, width = 7): Shape =>
  group(nm, [
    { ty: 'sh', ks: path },
    stroke(GOLD, width),
    stroke(INK, width + 2),
  ]);
const findGroup = (shape: Shape, name: string): Shape | undefined => {
  if (shape.nm === name) return shape;
  for (const child of shape.it ?? []) {
    const found = findGroup(child, name);
    if (found) return found;
  }
  return undefined;
};
const joint = (shape: Shape, name: string, key: string, value: Property) => {
  const target = findGroup(shape, name)?.it?.find((item) => item.ty === 'tr');
  if (target) target[key] = value;
};
const trim = (start: ScalarSample[], end: ScalarSample[]): Shape => ({
  ty: 'tm',
  s: scalar(start),
  e: scalar(end),
  o: fixed(0),
  m: 1,
});
const cloneArt = (name: keyof typeof elves): Shape =>
  JSON.parse(JSON.stringify(elves[name])) as Shape;

/* Match the temporal Bezier used by the player's position/rotation properties.
   Only the deforming loose ribbon is sampled; linear interpolation between these
   samples avoids the repeated braking of the previous WAAPI pose grid. */
const ease = (progress: number) => {
  let low = 0;
  let high = 1;
  let t = progress;
  for (let iteration = 0; iteration < 18; iteration++) {
    const x =
      3 * (1 - t) ** 2 * t * 0.42 + 3 * (1 - t) * t ** 2 * 0.58 + t ** 3;
    if (x < progress) low = t;
    else high = t;
    t = (low + high) / 2;
  }
  return 3 * (1 - t) * t ** 2 + t ** 3;
};
const sampleAt = (samples: Sample[], time: number): Vector => {
  const next = samples.findIndex(([at]) => at > time);
  if (next === -1) return samples[samples.length - 1][1];
  if (next === 0) return samples[0][1];
  const [start, from] = samples[next - 1];
  const [end, to] = samples[next];
  const progress = ease((time - start) / (end - start));
  return from.map((value, index) => value + (to[index] - value) * progress);
};
const radians = (angle: number) => (angle * Math.PI) / 180;
const palmAt = (upperAngle: number, forearmAngle: number): Vector => {
  const upper = radians(upperAngle);
  const forearm = radians(upperAngle + forearmAngle);
  return [
    ELF_RIG.shoulder.x +
      ELF_RIG.upperArmLength * Math.cos(upper) +
      ELF_RIG.palm.x * Math.cos(forearm) -
      ELF_RIG.palm.y * Math.sin(forearm),
    ELF_RIG.shoulder.y +
      ELF_RIG.upperArmLength * Math.sin(upper) +
      ELF_RIG.palm.x * Math.sin(forearm) +
      ELF_RIG.palm.y * Math.cos(forearm),
  ];
};

/** Author the scene once in composer coordinates; no layout is read during playback. */
export const buildGiftWrappingComposition = (
  target: GiftWrappingTarget,
  isMobile: boolean,
): GiftWrappingComposition => {
  const { box, width, height, rtl } = target;
  const size = isMobile ? 0.68 : 0.9;
  const center = box.left + box.width / 2;
  const floor = box.top - 6;
  const direction = rtl ? -1 : 1;
  const world = (x: number, y: number): Vector => [
    center + x * direction,
    floor + y,
  ];
  const masterX = -Math.min(box.width * 0.27, 130);
  const helperX = Math.min(box.width * 0.34, 175);
  const departure = -box.width / 2 - 140;
  const masterPos: Sample[] = [
    [0, [masterX - 100, 0]],
    [1.8, [masterX, 0]],
    [5.6, [masterX, 0]],
    [6.2, [masterX + 12, -7]],
    [7.5, [masterX + 26, 0]],
    [10, [masterX + 26, 0]],
    [10.25, [masterX + 26, 4]],
    [10.65, [masterX + 16, -25]],
    [11, [masterX + 10, 0]],
    [11.35, [masterX + 10, 3]],
    [11.7, [masterX - 4, -18]],
    [12, [masterX - 12, 0]],
    [12.45, [masterX - 12, 0]],
    [12.9, [masterX - 35, -24]],
    [13.3, [masterX - 60, 0]],
    [13.55, [masterX - 60, 0]],
    [14, [masterX - 95, -20]],
    [14.4, [masterX - 115, 0]],
    [14.65, [masterX - 115, 0]],
    [15.1, [departure, -20]],
    [15.55, [departure - 25, 0]],
    [16, [departure - 25, 0]],
  ];
  const helperPos: Sample[] = [
    [0, [helperX + 90, 0]],
    [1.8, [helperX, 0]],
    [4.5, [helperX, 0]],
    [5.2, [helperX - 10, 2]],
    [5.65, [helperX - 10, 2]],
    [6.35, [helperX + 19, 0]],
    [6.65, [helperX + 22, -4]],
    [7.3, [helperX + 11, 0]],
    [9.2, [helperX + 11, 0]],
    [9.5, [helperX + 11, 2]],
    [10, [helperX + 11, 0]],
    [12.5, [helperX + 11, 0]],
    [15.8, [departure + 70, 0]],
    [16, [departure + 70, 0]],
  ];
  const helperLean: Sample[] = [
    [0, [0]],
    [4.5, [0]],
    [5.2, [14]],
    [5.65, [14]],
    [6.35, [-21]],
    [6.65, [-25]],
    [7.3, [0]],
    [16, [0]],
  ];
  const layers: Layer[] = [];
  const layer = (nm: string, shapes: Shape[], ks = transform()): Layer => {
    const result = {
      ty: 4,
      ind: layers.length + 1,
      nm,
      ip: 0,
      op: END,
      st: 0,
      sr: 1,
      ks,
      shapes,
    };
    layers.push(result);
    return result;
  };
  const placed = (x: number, y: number, scale = 1): Transform => ({
    ...transform(),
    p: fixed(world(x, y)),
    s: fixed([direction * scale * 100, scale * 100]),
  });
  const actor = (name: ElfCharacter, poses: Sample[]) => {
    const art = cloneArt(name);
    const ks = transform();
    ks.p = animated(poses.map(([time, [x, y]]) => [time, world(x, y)]));
    ks.s = fixed([
      (name === ElfCharacter.Helper ? -1 : 1) * direction * size * 100,
      size * 100,
    ]);
    ks.o = scalar([
      [0, 0],
      [0.25, 100],
      [15.3, 100],
      [16, 0],
    ]);
    const current = layer(name, [art], ks);
    return { art, current };
  };

  /* Layers are authored in back-to-front order, then reversed for Lottie. */
  if (!target.source) {
    layer(
      'fallback-parcel',
      [
        group('parcel', [
          {
            ty: 'rc',
            p: fixed([0, box.height / 2 + 6]),
            s: fixed([box.width, box.height]),
            r: fixed(12),
          },
          { ty: 'fl', c: fixed([0.1, 0.29, 0.28, 1]), o: fixed(100) },
          stroke([0.4, 0.68, 0.56, 1], 2),
        ]),
      ],
      placed(0, 0),
    );
  }
  const left = -box.width / 2 + 3;
  const right = box.width / 2 - 3;
  const bottom = box.height + 3;
  const wrapPath = contour([
    [0, 5],
    [right - 10, 5],
    [right, 15],
    [right, bottom - 10],
    [right - 10, bottom],
    [left + 10, bottom],
    [left, bottom - 10],
    [left, 15],
    [left + 10, 5],
    [0, 5],
  ]);
  const wrapping = ribbon('continuous-composer-ribbon', fixed(wrapPath), 5);
  wrapping.it?.splice(
    1,
    0,
    trim(
      [
        [0, 0],
        [5.8, 0],
        [6.35, 100],
      ],
      [
        [0, 0],
        [1.9, 0],
        [4.3, 100],
      ],
    ),
  );
  layer('composer-ribbon', [wrapping], placed(0, 0));
  const bowKs = placed(0, 4, isMobile ? 0.75 : 0.95);
  bowKs.o = scalar([
    [0, 0],
    [4.1, 0],
    [4.4, 100],
    [5.8, 100],
    [6.2, 0],
  ]);
  layer('composer-bow', [cloneArt('bow')], bowKs);

  const master = actor(ElfCharacter.Master, masterPos);
  const masterLean: Sample[] = [
    [0, [-5]],
    [1.8, [0]],
    [4.5, [0]],
    [5.1, [-7]],
    [5.6, [0]],
    [6.2, [18]],
    [7.05, [-20]],
    [7.5, [0]],
    [10, [0]],
    [10.25, [-7]],
    [11, [4]],
    [11.35, [-5]],
    [12, [0]],
    [16, [0]],
  ];
  master.current.ks.r = animated(
    masterLean.map(([time, [angle]]) => [time, [angle * direction]]),
  );
  joint(
    master.art,
    'upper-arm',
    'r',
    scalar([
      [0, 70],
      [1.8, 70],
      [2.2, -10],
      [4.3, -10],
      [4.8, 60],
      [5.8, 60],
      [6.5, -45],
      [7.6, 60],
    ]),
  );
  joint(
    master.art,
    'forearm',
    'r',
    scalar([
      [0, 30],
      [1.8, 30],
      [2.2, 50],
      [4.3, 50],
      [4.8, 100],
      [6, 100],
      [6.5, 75],
      [7.6, 100],
    ]),
  );
  joint(
    master.art,
    'head',
    'r',
    scalar([
      [0, 0],
      [4.5, 0],
      [5.1, -12],
      [5.8, 0],
      [7.6, 8],
      [8.2, 8],
      [8.7, -13],
      [9.1, -13],
      [9.6, 0],
      [11.1, -10],
      [12, 0],
    ]),
  );
  joint(
    master.art,
    'cap',
    'r',
    scalar([
      [0, -7],
      [1.8, 0],
      [5.8, 0],
      [6.35, -25],
      [7, 22],
      [7.7, -12],
      [8, 0],
      [10.65, -15],
      [11.15, 10],
      [11.5, 0],
      [11.7, -12],
      [12.15, 6],
      [12.4, 0],
    ]),
  );
  /* Separate facial drawings switch as one expression; overlapping eyes or
     mouths during a crossfade would make the small characters hard to read. */
  joint(
    master.art,
    'expression',
    'o',
    held([
      [0, 100],
      [6.1, 0],
    ]),
  );
  joint(
    master.art,
    'surprise',
    'o',
    held([
      [0, 0],
      [6.1, 100],
      [8.5, 0],
    ]),
  );
  joint(
    master.art,
    'annoyed',
    'o',
    held([
      [0, 0],
      [8.5, 100],
    ]),
  );

  /* Consecutive half-turns share endpoints. Rear turns are painted behind the
     body; front turns stay visible as broad, gently sagging ribbons. */
  const coilVertices = [
    [26, -56],
    [-26, -49],
    [26, -42],
    [-26, -35],
    [24, -28],
    [-21, -21],
    [17, -14],
    [-15, -7],
    [15, 0],
  ];
  const coilStart = 6.35;
  const halfTurn = 0.2;
  const coils = coilVertices.slice(0, -1).map((from, index) => {
    const path = contour([from, coilVertices[index + 1]]);
    const front = index % 2 === 0;
    path.o[0] = [front ? -13 : 13, front ? 8 : -8];
    path.i[1] = [front ? 13 : -13, front ? 8 : -8];
    const shape = ribbon(
      `coil-${front ? 'front' : 'rear'}-${index}`,
      fixed(path),
      7,
    );
    shape.it?.splice(1, 0, {
      ty: 'tm',
      s: fixed(0),
      e: scalar(
        [
          [0, 0],
          [coilStart + index * halfTurn, 0],
          [coilStart + (index + 1) * halfTurn, 100],
        ],
        true,
      ),
      o: fixed(0),
      m: 1,
    });
    return { path, shape, front };
  });
  const windingPoint = (time: number) => {
    const progress = Math.max(
      0,
      Math.min(coils.length, (time - coilStart) / halfTurn),
    );
    const index = Math.min(coils.length - 1, Math.floor(progress));
    const path = coils[index].path;
    const amount = progress - index;
    const pointAt = (t: number) =>
      path.v[0].map(
        (value, axis) =>
          (1 - t) ** 3 * value +
          3 * (1 - t) ** 2 * t * (value + path.o[0][axis]) +
          3 * (1 - t) * t ** 2 * (path.v[1][axis] + path.i[1][axis]) +
          t ** 3 * path.v[1][axis],
      );
    /* Lottie trims by arc length, so parameterize the free end by that same
       length instead of raw Bezier t. This is preparation work, never a frame loop. */
    const points = Array.from({ length: 51 }, (_, step) => pointAt(step / 50));
    const lengths = [0];
    for (let step = 1; step < points.length; step++)
      lengths.push(
        lengths[step - 1] +
          Math.hypot(
            points[step][0] - points[step - 1][0],
            points[step][1] - points[step - 1][1],
          ),
      );
    const wanted = lengths[50] * amount;
    const end = Math.max(
      1,
      lengths.findIndex((length) => length >= wanted),
    );
    const ratio =
      (wanted - lengths[end - 1]) / (lengths[end] - lengths[end - 1]);
    return points[end - 1].map(
      (value, axis) => value + (points[end][axis] - value) * ratio,
    );
  };
  const boundBow = cloneArt('bow');
  const boundBowTransform = boundBow.it?.find((item) => item.ty === 'tr');
  if (boundBowTransform) {
    boundBowTransform.p = fixed([0, -48]);
    boundBowTransform.s = fixed([55, 55]);
    boundBowTransform.o = scalar([
      [0, 0],
      [7.95, 0],
      [8.2, 100],
    ]);
  }
  master.current.shapes = [
    boundBow,
    ...coils.filter(({ front }) => front).map(({ shape }) => shape),
    master.art,
    ...coils.filter(({ front }) => !front).map(({ shape }) => shape),
  ];

  const helper = actor(ElfCharacter.Helper, helperPos);
  helper.current.ks.r = animated(
    helperLean.map(([time, [angle]]) => [time, [angle * direction]]),
  );
  const helperUpper: Sample[] = [
    [0, [70]],
    [1.25, [70]],
    [1.8, [-10]],
    [4.5, [-10]],
    [5.2, [0]],
    [5.65, [0]],
    [6.35, [-18]],
    [6.65, [-8]],
    [7.3, [-10]],
    [8.3, [-10]],
    [9.2, [70]],
  ];
  const helperForearm: Sample[] = [
    [0, [30]],
    [1.25, [30]],
    [1.8, [50]],
    [4.5, [50]],
    [5.2, [65]],
    [5.65, [65]],
    [6.35, [40]],
    [6.65, [45]],
    [7.3, [50]],
    [8.3, [50]],
    [9.2, [30]],
  ];
  joint(helper.art, 'upper-arm', 'r', animated(helperUpper));
  joint(helper.art, 'forearm', 'r', animated(helperForearm));
  joint(
    helper.art,
    'head',
    'r',
    scalar([
      [0, 0],
      [4.5, 0],
      [5.2, -9],
      [6.65, 12],
      [7.3, 0],
      [8.3, 0],
      [8.7, -17],
      [9.4, -17],
      [10, 7],
      [10.5, 0],
    ]),
  );
  joint(
    helper.art,
    'expression',
    'o',
    held([
      [0, 100],
      [8.6, 0],
      [9.5, 100],
    ]),
  );
  joint(
    helper.art,
    'surprise',
    'o',
    held([
      [0, 0],
      [8.6, 100],
      [9.5, 0],
    ]),
  );
  joint(
    helper.art,
    'reel',
    'r',
    scalar([
      [0, 0],
      [1.9, 0],
      [4.3, 540],
      [5.8, 540],
      [7.4, 1260],
    ]),
  );
  for (const { art, name } of [
    { art: master.art, name: ElfCharacter.Master },
    { art: helper.art, name: ElfCharacter.Helper },
  ]) {
    for (const leg of [0, 1]) {
      const steps: ScalarSample[] = [[0, 0]];
      for (let n = 1; n <= 6; n++)
        steps.push([n * 0.26, (n % 2 ? 1 : -1) * (leg ? -15 : 15)]);
      steps.push([1.8, 0]);
      if (name === ElfCharacter.Helper) {
        steps.push([12.5, 0]);
        for (let n = 1; n <= 10; n++)
          steps.push([12.5 + n * 0.29, (n % 2 ? 1 : -1) * (leg ? -16 : 16)]);
        steps.push([15.8, 0]);
      }
      joint(art, `leg-${leg}`, 'r', scalar(steps));
    }
  }

  const looseFrames = [];
  for (let n = 0; n <= 260; n++) {
    const time = 1.8 + n * 0.025;
    const [x, y] = sampleAt(helperPos, time);
    const palm = palmAt(
      sampleAt(helperUpper, time)[0],
      sampleAt(helperForearm, time)[0],
    );
    const angle = radians(sampleAt(helperLean, time)[0]);
    const grip = [
      x + size * (-palm[0] * Math.cos(angle) - palm[1] * Math.sin(angle)),
      y + size * (-palm[0] * Math.sin(angle) + palm[1] * Math.cos(angle)),
    ];
    const reel = [
      x +
        size *
          (-ELF_RIG.reel.x * Math.cos(angle) -
            ELF_RIG.reel.y * Math.sin(angle)),
      y +
        size *
          (-ELF_RIG.reel.x * Math.sin(angle) +
            ELF_RIG.reel.y * Math.cos(angle)),
    ];
    const [mx, my] = sampleAt(masterPos, time);
    const turn = radians(sampleAt(masterLean, time)[0]);
    const tip = windingPoint(time);
    const attachment = [
      mx + size * (tip[0] * Math.cos(turn) - tip[1] * Math.sin(turn)),
      my + size * (tip[0] * Math.sin(turn) + tip[1] * Math.cos(turn)),
    ];
    const handoff = ease(
      Math.max(0, Math.min(1, (time - 5.8) / (coilStart - 5.8))),
    );
    const origin = [attachment[0] * handoff, 5 + (attachment[1] - 5) * handoff];
    const path = contour([origin, grip, reel]);
    const span = grip[0] - origin[0];
    path.o[0] = [span * 0.42, time < 5.8 ? 24 : 4];
    path.i[1] = [-span * 0.28, time < 5.8 ? 12 : 2];
    path.o[1] = [15, -8];
    path.i[2] = [-12, -12];
    looseFrames.push({
      t: time * FPS,
      s: [path],
      o: { x: 0, y: 0 },
      i: { x: 1, y: 1 },
    });
  }
  const loose = ribbon(
    'ribbon-through-helper-hand',
    { a: 1, k: looseFrames },
    4,
  );
  const looseKs = placed(0, 0);
  looseKs.o = scalar([
    [0, 0],
    [1.8, 0],
    [2, 100],
    [8, 100],
    [8.3, 0],
  ]);
  layer('loose-ribbon', [loose], looseKs);

  return {
    target,
    animationData: {
      v: '5.13.0',
      fr: FPS,
      ip: 0,
      op: END,
      w: width,
      h: height,
      nm: 'New Year ribbon mishap',
      ddd: 0,
      assets: [],
      layers: layers.reverse(),
    },
  };
};
