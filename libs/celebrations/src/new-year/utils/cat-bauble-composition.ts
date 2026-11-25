import { CatBaubleMode } from '../types/new-year';
import {
  CAT_FIR,
  CAT_RIG,
  catArt,
  firArt,
  reachingLegArt,
  TANGERINE_RADIUS,
  tangerineArt,
} from './cat-bauble-art';
import { CAT_LYING_SQUASH, type CatBaubleTargets } from './cat-bauble-targets';
import {
  fixed,
  group,
  identity,
  type SnowmanProperty,
  type SnowmanShape,
  type SnowmanTransform,
} from './snowman-delivery-art';
import type { Point } from './snowman-delivery-rig';
import {
  type Bezier,
  bezierProgress,
  EASE,
  EASE_IN,
  EASE_OUT,
  type Ease,
  Track,
  type Vec,
} from './snowman-delivery-timeline';

/** One authored timeline: the miss, the swat into the fir, the ornament, the carry home, the nap and the exit. */
export const CAT_BAUBLE_MS = 23000;
const FPS = 60;
const END = CAT_BAUBLE_MS / 1000;

/** Beat times in seconds. */
export const CAT_BAUBLE_BEATS = {
  enterEnd: 2.6,
  lookUp: 3.0,
  crouch: 3.15,
  wiggle: 3.4,
  pounce: 4.0,
  swingAway: 4.1,
  apex: 4.22,
  landFront: 4.44,
  landBack: 4.6,
  groom: 4.9,
  groomEnd: 6.0,
  lookBack: 6.1,
  turnBack: 6.4,
  atToy: 8.0,
  turnToFir: 8.08,
  lie: 8.3,
  reach: 8.6,
  hook: 8.9,
  flick: 9.0,
  flicked: 9.4,
  stand: 9.55,
  toSwat: 9.7,
  atSwat: 10.0,
  swatWind: 10.12,
  swat: 10.3,
  impact: 11.3,
  hung: 11.75,
  firLean: 12.25,
  firBack: 12.6,
  firStill: 13.2,
  sit: 13.3,
  admireEnd: 15.0,
  atRear: 15.4,
  rear: 15.65,
  bite: 15.85,
  down: 16.25,
  turnHome: 16.4,
  atHome: 18.3,
  lower: 18.5,
  slotted: 19.0,
  restore: 19.1,
  curl: 19.3,
  curlEnd: 20.4,
  stretch: 20.5,
  stretchEnd: 21.2,
  exit: 21.35,
  exitEnd: 22.8,
} as const;

/** One WAAPI keyframe of the selector copy, relative to its original rect. */
export interface CatToyFrame {
  /** Offset of the playback. */
  offset: number;
  /** Horizontal translation in CSS pixels. */
  dx: number;
  /** Vertical translation in CSS pixels. */
  dy: number;
  /** Rotation in degrees about the copy's centre. */
  rotate: number;
  /** Copy opacity. */
  opacity: number;
  /** CSS easing of the segment that follows. */
  easing: string;
}

/** World positions at one time, for contact tests. */
export interface CatBaubleProbe {
  /** Feet, between all four paws. */
  feet: Point;
  /** The near forepaw's tip. */
  paw: Point;
  /** Where the teeth hold the toy. */
  mouth: Point;
  /** Toy centre and rotation in degrees. */
  toy: { center: Point; rotation: number };
  /** The grip point on the toy's top edge, rotated with it. */
  toyGrip: Point;
  /** Lowest y of the unrotated toy. */
  toyBottom: number;
  /** Toy edge facing the fir. */
  toyLead: number;
  /** The fir's empty hook. */
  hook: Point;
  /** Centre of the lowest bauble on the cat's side. */
  bauble: Point;
  /** Viewport x of the fir's trunk face toward the cat. */
  trunkFace: number;
}

interface Layer {
  ty: number;
  ind: number;
  nm: string;
  ip: number;
  op: number;
  st: number;
  sr: number;
  ks: SnowmanTransform;
  shapes: SnowmanShape[];
}

/** Lottie data, the selector copy's synchronized track and probes for tests. */
export interface CatBaubleComposition {
  /** The measured stage. */
  targets: CatBaubleTargets;
  /** Native Lottie data for the light SVG player. */
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
  /** Keyframes of the selector copy; empty with a tangerine. */
  toyFrames: CatToyFrame[];
  /** Paw contact, as an offset of the playback. */
  toyHideAt: number;
  /** Return to the slot, as an offset of the playback. */
  toyRestoreAt: number;
  /** World positions at a time, for contact tests. */
  probe: (seconds: number) => CatBaubleProbe;
}

type ArtShape = SnowmanShape & { it?: ArtShape[] };

const B = CAT_BAUBLE_BEATS;
const STEP = 1 / 30;
const FS = CAT_FIR.scale;
/* Slides keep some speed into the trunk instead of stopping short of it. */
const SLIDE: Bezier = [0.12, 0.55, 0.6, 1];
const SNAP: Bezier = [0, 0, 0.3, 1];
/* The rearing pose: body lean about the hind feet and head lift. */
const REAR = { lean: -55, head: -20 } as const;
const LYING: Point = [104, CAT_LYING_SQUASH];
/* Forward pawing angle of the near foreleg, and the flick that follows. */
const PAW_FORWARD = -80;

const rad = (angle: number) => (angle * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const rotate = ([x, y]: Point, angle: number): Point => {
  const a = rad(angle);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
/** Height along a ballistic arc that peaks `rise` above the higher end. */
const arcY = (from: number, to: number, rise: number, p: number) => {
  const apex = Math.min(from, to) - rise;
  return p < 0.5
    ? lerp(from, apex, 1 - (1 - 2 * p) ** 2)
    : lerp(apex, to, (2 * p - 1) ** 2);
};

/* Hundredths of a pixel or degree are below what the player can show. */
const round = (v: Vec): Vec => v.map((n) => Math.round(n * 100) / 100);
const toLottie = (
  track: Track,
  mapValue: (v: Vec) => Vec = (v) => v,
): SnowmanProperty => {
  const map = (v: Vec) => round(mapValue(v));
  if (!track.isAnimated) {
    const value = map(track.keys[0]?.v ?? [0]);
    return fixed(value.length === 1 ? value[0] : value);
  }
  return {
    a: 1,
    k: track.keys.map((key, index) => {
      const next = track.keys[index + 1];
      if (!next) return { t: key.t * FPS, s: map(key.v) };
      if (key.ease === 'hold') return { t: key.t * FPS, s: map(key.v), h: 1 };
      const [x1, y1, x2, y2] =
        key.ease === 'linear' ? ([0, 0, 1, 1] as const) : key.ease;
      /* The light player reads a segment's end from the next key's `s`. */
      return {
        t: key.t * FPS,
        s: map(key.v),
        o: { x: +x1.toFixed(4), y: +y1.toFixed(4) },
        i: { x: +x2.toFixed(4), y: +y2.toFixed(4) },
      };
    }),
  };
};
const cssEasing = (ease: Ease) => {
  if (ease === 'hold') return 'step-end';
  if (ease === 'linear') return 'linear';
  return `cubic-bezier(${ease.map((n) => +n.toFixed(4)).join(', ')})`;
};
/** Switches a held channel to `v` at `t`. */
const setHeld = (track: Track, t: number, v: number) => {
  track.set(t - 0.001, track.at(t - 0.001), 'hold');
  track.set(t, v, 'hold');
};
/** A damped pendulum angle, starting at zero with `amp` degrees toward its first swing. */
const pendulum = (amp: number, period: number, decay: number, dt: number) =>
  dt <= 0
    ? 0
    : amp * Math.exp(-decay * dt) * Math.sin((2 * Math.PI * dt) / period);

const findGroup = (shape: ArtShape, name: string): ArtShape | undefined => {
  if (shape.nm === name) return shape;
  for (const child of shape.it ?? []) {
    const found = findGroup(child, name);
    if (found) return found;
  }
  return undefined;
};
const transformOf = (shape: ArtShape | undefined) =>
  shape?.it?.find((item) => item.ty === 'tr') as unknown as
    SnowmanTransform | undefined;

/** A native cat point under the head turn. */
const headPoint = ([x, y]: Point, tilt: number): Point =>
  add(CAT_RIG.neck, rotate(sub([x, y], CAT_RIG.neck), tilt));
/** A native body point under squash and lean, relative to the feet. */
const bodyPoint = ([x, y]: Point, [sx, sy]: Point, lean: number): Point =>
  rotate([(x * sx) / 100, (y * sy) / 100], lean);
/** The near forepaw tip under the leg turn and stretch, before the body lean. */
const pawPoint = (squash: Point, angle: number, stretch: number): Point => {
  const shoulder: Point = [
    (CAT_RIG.shoulder[0] * squash[0]) / 100,
    (CAT_RIG.shoulder[1] * squash[1]) / 100,
  ];
  return add(shoulder, rotate([0, CAT_RIG.leg * stretch], angle));
};
/** Offset of the feet that keeps the hind paws planted while the body leans. */
const hindAnchor = (squash: Point, lean: number): Point => {
  const hind: Point = [(CAT_RIG.hip[0] * squash[0]) / 100, 0];
  return sub(hind, rotate(hind, lean));
};
/** The mouth in the rearing pose, relative to the standing feet, in native units. */
const rearMouth = (): Point =>
  add(
    bodyPoint(headPoint(CAT_RIG.mouth, REAR.head), [100, 100], REAR.lean),
    hindAnchor([100, 100], REAR.lean),
  );

/** Compose the cat, the fir and the toy's track on one Lottie clock. */
export const buildCatBaubleComposition = (
  targets: CatBaubleTargets,
  isMobile: boolean,
): CatBaubleComposition => {
  const { dir, toward, scale: s, floor, startEdge, firA, toyA } = targets;
  const selector =
    targets.mode === CatBaubleMode.Selector ? targets.selector : null;
  const tangerineR = TANGERINE_RADIUS * s;
  const tw = targets.toyWidth;
  const hh = targets.toyHeight / 2;
  /** Viewport x of a distance along the rim. */
  const X = (a: number) => startEdge + dir * a;
  /** Screen sign of the story direction. */
  const sd = dir * toward;
  /* Mobile samples sampled motion more coarsely: its paths are shorter. */
  const step = isMobile ? 1 / 24 : STEP;

  /* ---- Fir: tilt about its base and three bauble pendulums ---- */
  const firTilt = new Track([0]);
  const baubleSwing = CAT_FIR.baubles.map(() => new Track([0]));
  /** A fir-unit point in viewport pixels under the tilt at `t`. */
  const firWorld = (t: number, p: Point): Point => {
    const [x, y] = rotate(p, firTilt.at(t));
    return [X(firA) + sd * FS * s * x, floor + FS * s * y];
  };
  const baubleAt = (t: number, index: number): Point => {
    const { pivot, thread, radius } = CAT_FIR.baubles[index];
    return firWorld(
      t,
      add(pivot, rotate([0, thread + radius], baubleSwing[index].at(t))),
    );
  };
  const hookAt = (t: number) => firWorld(t, CAT_FIR.hook);
  const trunkFace = X(firA - toward * CAT_FIR.trunkHalf * FS * s);

  /* ---- Cat channels: position along the rim and height above it, in px ---- */
  const entryA = toyA - toward * 70 * s;
  const pos = new Track([entryA, 0]);
  const face = new Track([toward]);
  const lean = new Track([0]);
  const squash = new Track([100, 100]);
  const headTilt = new Track([0]);
  const legFore = new Track([0]);
  const stretch = new Track([1]);
  const legForeFar = new Track([0]);
  const legHind = new Track([0]);
  const legHindFar = new Track([0]);
  const tail = new Track([0]);
  const tailPuff = new Track([100]);
  const ears = new Track([100]);
  const pupils = new Track([100]);
  const eyes = new Track([100]);

  const facing = (t: number) => (face.at(t) >= 0 ? 1 : -1);
  /** Viewport point of a native offset from the feet at `t`. */
  const toWorld = (t: number, [x, y]: Point): Point => {
    const [a, up] = pos.value(t);
    return [X(a) + dir * facing(t) * s * x, floor + up + s * y];
  };
  const squashAt = (t: number): Point => {
    const [sx, sy] = squash.value(t);
    return [sx, sy];
  };
  const catWorld = (t: number, p: Point) =>
    toWorld(t, bodyPoint(p, squashAt(t), lean.at(t)));
  const pawAt = (t: number) =>
    toWorld(
      t,
      rotate(pawPoint(squashAt(t), legFore.at(t), stretch.at(t)), lean.at(t)),
    );
  const mouthAt = (t: number) =>
    catWorld(t, headPoint(CAT_RIG.mouth, headTilt.at(t)));

  const flip = (t: number, to: 1 | -1) => setHeld(face, t, to);
  const bell = new Track([0]);
  /** Trot to `to` with alternating diagonal leg pairs; the bell swings with the steps. */
  const walk = (to: number, t0: number, t1: number, stride = 26) => {
    const [from, y] = pos.value(t0);
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) / (stride * s)));
    pos.set(t0, [from, y], EASE).set(t1, [to, y], EASE);
    const dt = (t1 - t0) / steps;
    for (const leg of [legFore, legForeFar, legHind, legHindFar])
      leg.set(t0, 0);
    bell.set(t0, 0);
    for (let i = 1; i <= steps; i++) {
      const t = t0 + dt * i;
      const swing = i % 2 ? 22 : -22;
      legFore.set(t - dt / 2, -swing);
      legHindFar.set(t - dt / 2, -swing);
      legForeFar.set(t - dt / 2, swing);
      legHind.set(t - dt / 2, swing);
      bell.set(t - dt / 2, swing * 0.6);
    }
    for (const leg of [legFore, legForeFar, legHind, legHindFar])
      leg.set(t1, 0);
    bell.set(t1 + 0.2, 0);
    tail
      .set(t0, tail.at(t0))
      .set(t0 + 0.3, -8)
      .set(t1 - 0.2, -8)
      .set(t1, 0);
  };
  /** A ballistic leap of the root from where it is at `t0` to `toA`. */
  const leap = (t0: number, t1: number, toA: number, rise: number) => {
    const [fromA, fromUp] = pos.value(t0);
    pos.sample(t0, t1, step, (t) => {
      const p = (t - t0) / (t1 - t0);
      return [lerp(fromA, toA, p), arcY(fromUp, 0, rise * s, p)];
    });
  };
  const blink = (t: number) =>
    eyes
      .set(t - 0.06, 100)
      .set(t, 8, EASE_OUT)
      .set(t + 0.1, 100);

  /* ==== Beat 1–3: the trot, the stalk, the pounce and the miss ==== */
  const bauble0Rest = baubleAt(0, 0);
  const restBaubleA = (bauble0Rest[0] - startEdge) * dir;
  const pounceReach = pawPoint([100, 100], -100, 1);
  const apexA = restBaubleA - toward * pounceReach[0] * s;
  const crouchA = apexA - toward * 22 * s;
  const leapEndA = apexA + toward * 16 * s;
  walk(crouchA, 0.05, B.enterEnd);
  blink(1.4);
  headTilt.set(B.enterEnd, 0).set(B.lookUp, -16).set(B.crouch, -10);
  setHeld(pupils, B.lookUp - 0.1, 100);
  pupils.set(B.lookUp + 0.15, 230, EASE_OUT).set(B.landBack, 230);
  pupils.set(B.groom, 100);
  squash
    .set(B.crouch - 0.05, [100, 100])
    .set(B.crouch + 0.15, [104, 82], EASE_OUT);
  lean.set(B.crouch, 0).set(B.crouch + 0.15, -6);
  pos.set(B.crouch, [crouchA, 0]);
  /* Two rear wiggles: the hips rock while the shoulders stay low. */
  for (let i = 0; i < 4; i++) {
    lean.set(B.wiggle + i * 0.13, i % 2 ? -9 : -3, 'linear');
    tail.set(B.wiggle + i * 0.13, i % 2 ? 12 : -12, 'linear');
  }
  lean.set(B.pounce, -6, EASE_OUT);
  tail.set(B.pounce, 0);
  squash
    .set(B.pounce - 0.05, [104, 82])
    .set(B.pounce + 0.08, [96, 108], EASE_OUT);
  squash.set(B.apex, [100, 100]);
  leap(B.pounce, B.landFront, leapEndA, 14);
  lean.set(B.apex, -14).set(B.landFront, 10, EASE_IN).set(B.landBack, 0);
  legFore.set(B.pounce, 0).set(B.apex, -100, EASE_OUT).set(B.landFront, -20);
  legForeFar.set(B.pounce, 0).set(B.apex, -70, EASE_OUT).set(B.landFront, 0);
  legHind
    .set(B.pounce, 0)
    .set(B.pounce + 0.08, 40, EASE_OUT)
    .set(B.landBack, 0);
  legHindFar
    .set(B.pounce, 0)
    .set(B.pounce + 0.08, 34, EASE_OUT)
    .set(B.landBack, 0);
  legFore.set(B.landBack, 0);
  squash
    .set(B.landFront, [100, 100], 'linear')
    .set(B.landFront + 0.06, [106, 86], EASE_OUT)
    .set(B.landBack, [102, 92])
    .set(B.landBack + 0.14, [100, 100]);
  /* The bauble swings away just before the paw arrives. */
  baubleSwing[0].sample(B.swingAway, B.swingAway + 2.4, step, (t) => [
    -pendulum(58, 0.9, 1.6, t - B.swingAway),
  ]);
  baubleSwing[0].set(B.swingAway + 2.6, 0);
  /* Displacement grooming: paw to the mouth, a few licks. */
  headTilt.set(B.landBack, 0).set(B.groom, 22);
  legFore.set(B.groom - 0.1, 0).set(B.groom + 0.1, -125);
  stretch.set(B.groom - 0.1, 1).set(B.groom + 0.1, 1.15);
  for (let i = 0; i < 4; i++)
    headTilt.set(B.groom + 0.25 + i * 0.22, i % 2 ? 22 : 30);
  headTilt.set(B.groomEnd, 4);
  legFore.set(B.groomEnd - 0.1, -125).set(B.groomEnd, 0);
  stretch.set(B.groomEnd - 0.1, 1.15).set(B.groomEnd, 1);
  eyes
    .set(B.groom + 0.2, 100)
    .set(B.groom + 0.3, 30)
    .set(B.groomEnd - 0.2, 30);
  eyes.set(B.groomEnd, 100);

  /* ==== Beat 4: the toy, hooked up onto the rim and swatted ==== */
  headTilt.set(B.lookBack, 4).set(B.turnBack, -6);
  ears
    .set(B.lookBack, 100)
    .set(B.lookBack + 0.1, 88)
    .set(B.lookBack + 0.25, 100);
  setHeld(pupils, B.lookBack + 0.05, 180);
  flip(B.turnBack, -toward as 1 | -1);
  const isTangerine = !selector;
  /* Lying pose: shoulder above the selector, leg straight down; or, with a
     tangerine, the paw pushed forward against its back. */
  const restCenter: Point = selector
    ? [
        (selector.rect.left + selector.rect.right) / 2,
        (selector.rect.top + selector.rect.bottom) / 2,
      ]
    : [X(toyA), floor - tangerineR];
  const pawTarget: Point = selector
    ? [restCenter[0], selector.rect.top]
    : [restCenter[0] - sd * tangerineR, restCenter[1]];
  const reachAngle = selector ? 0 : PAW_FORWARD;
  const reachStretch = selector
    ? clamp(
        ((pawTarget[1] - floor) / s - (CAT_RIG.shoulder[1] * LYING[1]) / 100) /
          CAT_RIG.leg,
        1,
        CAT_RIG.maxStretch,
      )
    : 1;
  const reachTip = pawPoint(LYING, reachAngle, reachStretch);
  const lieA = (pawTarget[0] - startEdge) * dir - toward * reachTip[0] * s;
  /* He walks past the toy, turns round and lies down facing the fir. */
  walk(lieA - toward * 4 * s, B.turnBack + 0.05, B.atToy);
  flip(B.turnToFir, toward);
  pos.set(B.turnToFir, [lieA - toward * 4 * s, 0]).set(B.lie, [lieA, 0]);
  squash.set(B.turnToFir, [100, 100]).set(B.lie, LYING);
  legHind.set(B.turnToFir, 0).set(B.lie, -40);
  legHindFar.set(B.turnToFir, 0).set(B.lie, -40);
  legForeFar.set(B.turnToFir, 0).set(B.lie, -60);
  headTilt.set(B.lie, 18);
  legFore
    .set(B.lie, 0)
    .set(B.reach, reachAngle * 0.5)
    .set(B.hook, reachAngle);
  stretch.set(B.lie, 1).set(B.hook, reachStretch, EASE_OUT);
  /* The flick: the leg snaps back and forward, tossing the toy up and ahead. */
  legFore.set(B.flick, reachAngle + 10).set(B.flicked, -100, SNAP);
  stretch.set(B.flick, reachStretch).set(B.flicked, 1, SNAP);
  setHeld(pupils, B.flick, 100);
  legFore.set(B.stand, 0);
  squash.set(B.flicked, LYING).set(B.stand, [100, 100]);
  for (const leg of [legHind, legHindFar, legForeFar])
    leg.set(B.flicked, leg.at(B.flicked)).set(B.stand, 0);
  headTilt.set(B.flicked, 18).set(B.stand, 0);
  const landA = toyA + toward * (32 * s + tw / 2 + 6);
  const swatReach = pawPoint([100, 100], -70, 1);
  const swatA = landA - toward * (tw / 2 + swatReach[0] * s);
  walk(swatA, B.toSwat, B.atSwat, 10);
  squash.set(B.atSwat + 0.04, [100, 100]).set(B.swatWind, [103, 90]);
  legFore
    .set(B.swatWind, 18)
    .set(B.swat, -70, SNAP)
    .set(B.swat + 0.3, 0);
  lean
    .set(B.swatWind, -3)
    .set(B.swat, 6, SNAP)
    .set(B.swat + 0.25, 0);
  squash.set(B.swat, [97, 104], SNAP).set(B.swat + 0.25, [100, 100]);
  /* The chase: it follows the sliding toy and stops short of the fir. */
  const slideEndA = firA - toward * (CAT_FIR.trunkHalf * FS * s + tw / 2);
  const chaseA = slideEndA - toward * (tw / 2 + 52 * s);
  const chaseFrom = pos.value(B.swat + 0.3)[0];
  if ((chaseA - chaseFrom) * toward > 0)
    walk(chaseA, B.swat + 0.3, B.impact + 0.1, 32);

  /* ==== Beat 5–6: the impact, the leaning fir and the freeze ==== */
  firTilt
    .set(B.impact, 0, 'linear')
    .set(B.impact + 0.12, 6, EASE_OUT)
    .set(B.impact + 0.32, -2)
    .set(B.hung, 0);
  firTilt.set(B.firLean, -11, EASE_IN).set(B.firBack, -11);
  firTilt.set(B.firBack + 0.25, 3, EASE_OUT).set(B.firStill, 0);
  baubleSwing.forEach((track, index) => {
    const t0 = B.impact + index * 0.05;
    const from = index === 0 ? Math.max(B.swingAway + 2.6, t0) : t0;
    track.set(from - 0.001, 0, 'linear');
    track.sample(from, from + 3.2, step, (t) => [
      pendulum([22, 18, 14][index], [0.8, 0.95, 0.7][index], 1.1, t - from) +
        (B.firLean <= t && t < B.firStill ? 4 : 0),
    ]);
    track.set(from + 3.4, 0);
  });
  /* Ears flat and tail puffed before the body moves. */
  ears
    .set(B.hung, 100)
    .set(B.hung + 0.1, 42, EASE_OUT)
    .set(B.firStill, 42);
  ears.set(B.firStill + 0.2, 100);
  tailPuff
    .set(B.hung, 100)
    .set(B.hung + 0.12, 150, EASE_OUT)
    .set(B.firStill, 150)
    .set(B.firStill + 0.3, 100);
  setHeld(pupils, B.hung + 0.05, 240);
  pupils.set(B.firStill + 0.3, 100);
  squash.set(B.hung + 0.1, [100, 100]).set(B.hung + 0.25, [106, 84], EASE_OUT);
  squash.set(B.firStill, [106, 84]).set(B.firStill + 0.25, [100, 100]);
  lean
    .set(B.hung + 0.1, 0)
    .set(B.hung + 0.25, 8)
    .set(B.firStill, 8);
  lean.set(B.firStill + 0.25, 0);
  tail
    .set(B.hung, 0)
    .set(B.hung + 0.12, -20)
    .set(B.firStill, -20);
  tail.set(B.firStill + 0.3, 0);

  /* ==== Beat 7: admiring the new ornament ==== */
  squash.set(B.sit, [100, 100]).set(B.sit + 0.3, [100, 94]);
  legHind.set(B.sit, 0).set(B.sit + 0.3, -50);
  legHindFar.set(B.sit, 0).set(B.sit + 0.3, -50);
  lean.set(B.sit, 0).set(B.sit + 0.3, -14);
  headTilt
    .set(B.sit + 0.3, -10)
    .set(B.sit + 0.9, -24)
    .set(B.sit + 1.5, -24);
  headTilt.set(B.sit + 1.8, 6).set(B.admireEnd - 0.2, 6);
  blink(B.sit + 1.2);
  tail
    .set(B.sit + 0.4, 0)
    .set(B.sit + 0.9, 10)
    .set(B.sit + 1.4, -6)
    .set(B.admireEnd - 0.1, 0);

  /* ==== Beat 8: rear up, bite, unhook ==== */
  const mouthOffset = rearMouth();
  const hookRest = firWorld(B.bite, CAT_FIR.hook);
  const rearA = (hookRest[0] - startEdge) * dir - toward * mouthOffset[0] * s;
  squash.set(B.admireEnd, [100, 94]).set(B.admireEnd + 0.2, [100, 100]);
  for (const leg of [legHind, legHindFar])
    leg.set(B.admireEnd, -50).set(B.admireEnd + 0.2, 0);
  lean.set(B.admireEnd, -14).set(B.admireEnd + 0.2, 0);
  headTilt.set(B.admireEnd, 6).set(B.admireEnd + 0.2, -8);
  const sitA = pos.value(B.admireEnd)[0];
  if (Math.abs(rearA - sitA) > 2 * s)
    walk(rearA, B.admireEnd + 0.2, B.atRear, 12);
  else pos.set(B.atRear, [rearA, 0]);
  lean.set(B.atRear, 0).set(B.rear, REAR.lean, EASE_OUT).set(B.bite, REAR.lean);
  headTilt.set(B.atRear, -8).set(B.rear, REAR.head).set(B.bite, REAR.head);
  legFore.set(B.atRear, 0).set(B.rear, -150).set(B.bite, -150);
  legForeFar.set(B.atRear, 0).set(B.rear, -140).set(B.bite, -140);
  legHind
    .set(B.atRear, 0)
    .set(B.rear, REAR.lean * -1)
    .set(B.down, 0);
  legHindFar
    .set(B.atRear, 0)
    .set(B.rear, REAR.lean * -1)
    .set(B.down, 0);
  lean.set(B.down, 0, EASE_IN);
  headTilt.set(B.down, 6);
  legFore.set(B.down, 0, EASE_IN);
  legForeFar.set(B.down, 0, EASE_IN);
  squash
    .set(B.down, [100, 100], 'linear')
    .set(B.down + 0.08, [104, 90], EASE_OUT);
  squash.set(B.down + 0.2, [100, 100]);
  /* The hind paws stay planted while the body rears. */
  pos.sample(B.atRear, B.down, step, (t) => {
    const [dx, dy] = hindAnchor(squashAt(t), lean.at(t));
    return [rearA + facing(t) * dx * s, dy * s];
  });
  pos.set(B.down + 0.001, [rearA, 0], 'linear');

  /* ==== Beat 9: the carry home and the drop into the slot ==== */
  flip(B.turnHome, -toward as 1 | -1);
  const homeA = toyA + toward * CAT_RIG.mouth[0] * s;
  walk(homeA, B.turnHome + 0.05, B.atHome, 22);
  headTilt.set(B.atHome, 6).set(B.lower, 22).set(B.slotted, 26);
  lean.set(B.atHome, 0).set(B.lower, 14).set(B.slotted, 18);
  headTilt.set(B.curl, 26);
  lean.set(B.curl, 18);

  /* ==== Beat 10: the nap, the stretch and the exit ==== */
  squash.set(B.curl, [100, 100]).set(B.curl + 0.4, [112, 58]);
  lean.set(B.curl + 0.4, 0);
  headTilt.set(B.curl + 0.4, 30);
  tail
    .set(B.curl, 0)
    .set(B.curl + 0.4, 110)
    .set(B.curlEnd, 110);
  legHind
    .set(B.curl, 0)
    .set(B.curl + 0.4, -70)
    .set(B.curlEnd, -70);
  legHindFar
    .set(B.curl, 0)
    .set(B.curl + 0.4, -70)
    .set(B.curlEnd, -70);
  legForeFar
    .set(B.curl, 0)
    .set(B.curl + 0.4, -70)
    .set(B.curlEnd, -70);
  legFore
    .set(B.curl, 0)
    .set(B.curl + 0.4, -70)
    .set(B.curlEnd, -70);
  eyes
    .set(B.curl + 0.2, 100)
    .set(B.curl + 0.45, 6)
    .set(B.curlEnd, 6);
  eyes.set(B.curlEnd + 0.2, 100);
  blink(B.stretchEnd + 0.15);
  squash.set(B.curlEnd, [112, 58]).set(B.stretch + 0.2, [120, 86]);
  squash.set(B.stretchEnd, [120, 86]).set(B.exit, [100, 100]);
  lean
    .set(B.curlEnd, 0)
    .set(B.stretch + 0.2, 14)
    .set(B.stretchEnd, 14);
  lean.set(B.exit, 0);
  headTilt
    .set(B.curlEnd, 30)
    .set(B.stretch + 0.2, -12)
    .set(B.exit, 0);
  tail.set(B.curlEnd + 0.1, -20).set(B.exit, 0);
  for (const leg of [legFore, legForeFar])
    leg
      .set(B.curlEnd + 0.1, -40)
      .set(B.stretch + 0.2, -82)
      .set(B.stretchEnd, -82);
  for (const leg of [legHind, legHindFar])
    leg
      .set(B.curlEnd + 0.1, -40)
      .set(B.stretch + 0.2, 10)
      .set(B.stretchEnd, 10);
  const exitA = toyA - toward * 150 * s;
  walk(exitA, B.exit, B.exitEnd);

  /* ---- The toy: centre x, centre y, rotation, in viewport pixels ---- */
  const toyRest: Vec = [restCenter[0], restCenter[1], 0];
  const toy = new Track(toyRest);
  const landed: Point = [X(landA), floor - hh];
  if (selector) {
    toy.set(B.hook, toyRest, 'linear');
    toy.sample(B.flick, B.flicked, step, (t) => {
      const p = (t - B.flick) / (B.flicked - B.flick);
      return [
        lerp(restCenter[0], landed[0], bezierProgress(EASE, p)),
        arcY(restCenter[1], landed[1], 46 * s, p),
        sd * 360 * bezierProgress(EASE, p),
      ];
    });
  } else {
    toy.set(B.flick, toyRest, 'linear');
    toy.set(
      B.flicked,
      [landed[0], landed[1], sd * deg(Math.abs(landA - toyA) / tangerineR)],
      EASE_OUT,
    );
  }
  const spun = toy.value(B.flicked)[2];
  toy.set(B.flicked + 0.06, [landed[0], landed[1] + 1.5, spun], EASE_OUT);
  toy.set(B.flicked + 0.16, [landed[0], landed[1], spun]);
  toy.set(B.swat, [landed[0], landed[1], spun], 'linear');
  const slideEnd: Point = [X(slideEndA), floor - hh];
  toy.sample(B.swat, B.impact, step, (t) => {
    const p = bezierProgress(SLIDE, (t - B.swat) / (B.impact - B.swat));
    const x = lerp(landed[0], slideEnd[0], p);
    const roll = isTangerine ? deg(((x - landed[0]) * sd) / tangerineR) : 0;
    return [x, landed[1], spun + sd * roll];
  });
  const hitSpin = toy.value(B.impact)[2];
  /* The copy hangs and is carried by one grip on its top edge, near its
     fir-side end, so its body stays clear of the branches; the tangerine
     hangs by its stem. */
  const grip: Point = [isTangerine ? 0 : sd * Math.max(0, tw / 2 - 8), -hh];
  const tilt = isTangerine ? 0 : -sd * 8;
  const centerFrom = (anchor: Point, swing: number): Point =>
    sub(anchor, rotate(grip, swing));
  /* Popped up by the impact onto the empty hook, then hanging from it. */
  const hangStart = B.impact + 0.42;
  const hanging = (t: number): Vec => {
    const swing = tilt + pendulum(-sd * 16, 1.15, 0.9, t - hangStart);
    return [...centerFrom(hookAt(t), swing), hitSpin + swing];
  };
  toy.sample(B.impact, hangStart, step, (t) => {
    const p = (t - B.impact) / (hangStart - B.impact);
    const [hx, hy] = hanging(hangStart);
    return [
      lerp(slideEnd[0], hx, bezierProgress(EASE, p)),
      arcY(slideEnd[1], hy, 26 * s, p),
      hitSpin + tilt * bezierProgress(EASE, p),
    ];
  });
  toy.sample(hangStart, B.bite, step, hanging);
  /* In the mouth by the same grip, levelling out; it slides on the rim when it would hang lower. */
  const carried = (t: number): Vec => {
    const swing = tilt * (1 - clamp((t - B.bite) / 0.4, 0, 1));
    const [x, y] = centerFrom(mouthAt(t), swing);
    return [x, Math.min(y, floor - hh), hitSpin + swing];
  };
  toy.sample(B.bite, B.lower, step, carried);
  toy.sample(B.lower, B.slotted, step, (t) => {
    const p = bezierProgress(EASE, (t - B.lower) / (B.slotted - B.lower));
    const [cx, cy, cr] = carried(t);
    return [
      lerp(cx, restCenter[0], p),
      lerp(cy, restCenter[1], p),
      lerp(cr, hitSpin, p),
    ];
  });
  const home = hitSpin - (hitSpin % 360);
  toy.set(B.slotted + 0.001, [restCenter[0], restCenter[1], home], 'hold');
  toy.set(B.restore, [restCenter[0], restCenter[1], home], 'hold');
  toy.prune(0.4);

  /* ---- Layers, authored back to front ---- */
  const layers: Layer[] = [];
  const layer = (
    nm: string,
    ks: SnowmanTransform,
    shapes: SnowmanShape[],
    { ip = 0, op = END }: { ip?: number; op?: number } = {},
  ) => {
    layers.push({
      ty: 4,
      ind: layers.length + 1,
      nm,
      ip: Math.round(ip * FPS),
      op: Math.round(op * FPS),
      st: 0,
      sr: 1,
      ks,
      shapes,
    });
  };
  const fadeTrack = (t0: number, t1: number) =>
    new Track([0])
      .set(t0, 0)
      .set(t0 + 0.35, 100)
      .set(t1 - 0.35, 100)
      .set(t1, 0);

  /* The fir: fades in with the cat, stays to the end. */
  const fir = firArt() as ArtShape[];
  baubleSwing.forEach((track, index) => {
    track.prune(0.6);
    const transform = transformOf(
      fir.find((shape) => shape.nm === `bauble-${index}`),
    );
    if (transform) transform.r = toLottie(track);
  });
  firTilt.prune(0.2);
  layer(
    'fir',
    {
      ...identity(),
      p: fixed([X(firA), floor]),
      s: fixed([sd * FS * s * 100, FS * s * 100]),
      o: toLottie(fadeTrack(0, END)),
    },
    [group('tilt', fir, {}, { ...identity(), r: toLottie(firTilt) })],
  );

  if (isTangerine) {
    layer(
      'tangerine',
      {
        ...identity(),
        p: toLottie(toy, (v) => [v[0], v[1]]),
        r: toLottie(toy, (v) => [v[2]]),
        s: fixed([s * 100, s * 100]),
        o: toLottie(fadeTrack(0, END)),
      },
      tangerineArt(),
    );
  }

  /* The cat: the near foreleg sits outside the squash, so it keeps its length lying down. */
  const art = catArt() as ArtShape;
  const leg = reachingLegArt() as ArtShape;
  const joint = (
    root: ArtShape,
    name: string,
    key: keyof SnowmanTransform,
    value: SnowmanProperty,
  ) => {
    const transform = transformOf(findGroup(root, name));
    if (transform) transform[key] = value;
  };
  for (const track of [
    legFore,
    legForeFar,
    legHind,
    legHindFar,
    headTilt,
    tail,
  ])
    track.prune(0.5);
  stretch.prune(0.01);
  pos.prune(0.4);
  lean.prune(0.4);
  joint(leg, 'fore-near', 'r', toLottie(legFore));
  joint(
    leg,
    'fore-near',
    'p',
    toLottie(squash, ([sx, sy]) => [
      (CAT_RIG.shoulder[0] * sx) / 100,
      (CAT_RIG.shoulder[1] * sy) / 100,
    ]),
  );
  joint(
    leg,
    'shin',
    's',
    toLottie(stretch, ([k]) => [100, k * 100]),
  );
  joint(
    leg,
    'paw',
    'p',
    toLottie(stretch, ([k]) => [
      CAT_RIG.shoulder[0],
      CAT_RIG.shoulder[1] + CAT_RIG.leg * k,
    ]),
  );
  joint(art, 'head', 'r', toLottie(headTilt));
  joint(art, 'tail', 'r', toLottie(tail));
  joint(
    art,
    'tail',
    's',
    toLottie(tailPuff, ([k]) => [k, k]),
  );
  joint(
    art,
    'ears',
    's',
    toLottie(ears, ([k]) => [100, k]),
  );
  joint(
    art,
    'eyes',
    's',
    toLottie(eyes, ([k]) => [100, k]),
  );
  joint(
    art,
    'pupil-0',
    's',
    toLottie(pupils, ([k]) => [k, 100]),
  );
  joint(
    art,
    'pupil-1',
    's',
    toLottie(pupils, ([k]) => [k, 100]),
  );
  joint(art, 'hind-near', 'r', toLottie(legHind));
  joint(art, 'fore-far', 'r', toLottie(legForeFar));
  joint(art, 'hind-far', 'r', toLottie(legHindFar));
  joint(art, 'bell', 'r', toLottie(bell));
  layer(
    'cat',
    {
      ...identity(),
      p: toLottie(pos, (v) => [X(v[0]), floor + v[1]]),
      s: fixed([dir * s * 100, s * 100]),
      o: toLottie(fadeTrack(0, B.exitEnd)),
    },
    [
      group(
        'facing',
        [
          group(
            'lean',
            [
              leg,
              group(
                'squash',
                [art],
                {},
                { ...identity(), s: toLottie(squash) },
              ),
            ],
            {},
            { ...identity(), r: toLottie(lean) },
          ),
        ],
        {},
        { ...identity(), s: toLottie(face, (v) => [v[0] * 100, 100]) },
      ),
    ],
    { op: B.exitEnd },
  );

  /* ---- Selector copy frames (DOM), on the same clock ---- */
  const toyFrames: CatToyFrame[] = [];
  if (selector) {
    /* The snapshot helper fades the original out over 1 % of the playback
       before `hideAt` and back over 4 % after `restoreAt`; the copy covers
       both fades in place, so the swap is invisible. */
    const showFrom = B.hook - 0.3;
    const fadeStart = B.restore + 0.04 * END + 0.05;
    const times = [
      0,
      showFrom - 0.001,
      showFrom,
      ...toy.keys.map((key) => key.t),
      fadeStart,
      fadeStart + 0.05,
      END,
    ]
      .filter((t, i, all) => t >= 0 && t <= END && all.indexOf(t) === i)
      .sort((a, b) => a - b);
    for (const t of times) {
      const [x, y, rotation] = toy.value(t);
      const key = toy.keys.find((k) => Math.abs(k.t - t) < 1e-9);
      const isMoving = t >= B.hook && t < B.restore;
      const settled = t >= B.restore;
      toyFrames.push({
        offset: t / END,
        dx: settled ? 0 : x - restCenter[0],
        dy: settled ? 0 : y - restCenter[1],
        rotate: settled ? 0 : rotation,
        opacity: t >= showFrom && t <= fadeStart ? 1 : 0,
        easing: isMoving && key ? cssEasing(key.ease) : 'step-end',
      });
    }
  }

  const probe = (t: number): CatBaubleProbe => {
    const [x, y, rotation] = toy.value(t);
    const held = add([x, y], rotate(grip, rotation - hitSpin));
    return {
      feet: toWorld(t, [0, 0]),
      paw: pawAt(t),
      mouth: mouthAt(t),
      toy: { center: [x, y], rotation },
      toyGrip: held,
      toyBottom: y + hh,
      toyLead: x + sd * (tw / 2),
      hook: hookAt(t),
      bauble: baubleAt(t, 0),
      trunkFace,
    };
  };

  return {
    targets,
    animationData: {
      v: '5.13.0',
      fr: FPS,
      ip: 0,
      op: END * FPS,
      w: targets.width,
      h: targets.height,
      nm: 'Cat bauble',
      ddd: 0,
      assets: [],
      layers: layers.reverse(),
    },
    toyFrames,
    toyHideAt: B.hook / END,
    toyRestoreAt: B.restore / END,
    probe,
  };
};
