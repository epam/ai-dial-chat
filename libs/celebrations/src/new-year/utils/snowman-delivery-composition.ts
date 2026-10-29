import { SnowmanStage } from '../types/new-year';
import {
  armArt,
  bodyArt,
  BRANCH_PIVOT,
  BRANCH_SOCKET,
  branchArt,
  fixed,
  footArt,
  groundArt,
  group,
  headArt,
  identity,
  needlesArt,
  PRESENT_SIZE,
  presentArt,
  puffArt,
  scarfArt,
  sledArt,
  snowbankArt,
  SnowmanFace,
  type SnowmanProperty,
  type SnowmanShape,
  type SnowmanTransform,
  treeArt,
} from './snowman-delivery-art';
import {
  armPose,
  type Point,
  reachArm,
  SNOWMAN_RIG,
  SNOWMAN_SLIDE,
} from './snowman-delivery-rig';
import {
  STANCE_TO_SLED,
  type SnowmanDeliveryTargets,
} from './snowman-delivery-targets';
import {
  type Bezier,
  EASE,
  EASE_IN,
  EASE_OUT,
  type Ease,
  Track,
  type Vec,
} from './snowman-delivery-timeline';

/** One authored timeline: entrance, borrowing, ride, impact, recovery, return and exit. */
export const SNOWMAN_DELIVERY_MS = 25000;
const FPS = 60;
const END = SNOWMAN_DELIVERY_MS / 1000;

/** Story beat times in seconds; the card's hide and restore offsets come from here. */
export const SNOWMAN_BEATS = {
  enterEnd: 1.2,
  lookTree: 1.5,
  lookDistance: 2.1,
  lookCard: 2.6,
  idea: 3.0,
  presentUp: 3.3,
  presentOnHead: 3.85,
  grip: 4.3,
  gripHeld: 4.42,
  tug1: 4.6,
  tug1End: 4.75,
  tug2: 4.8,
  free: 5.1,
  lowered: 5.6,
  release: 5.75,
  landed: 5.9,
  presentDown: 6.0,
  presentHeld: 6.5,
  seatReached: 7.2,
  footTest: 7.4,
  footTestEnd: 7.6,
  sit: 8.1,
  settled: 8.3,
  push1: 8.6,
  push1End: 8.8,
  push2: 9.2,
  push2End: 9.5,
  glide: 9.6,
  smug: 10.6,
  impact: 12.0,
  separation: 12.05,
  compressed: 12.1,
  rebound: 12.25,
  settledImpact: 12.45,
  standUp: 14.8,
  bow: 15.5,
  presentPlaced: 15.8,
  risen: 16.2,
  spread: 16.9,
  inhale: 17.3,
  sneeze: 17.8,
  branchRelease: 17.95,
  catch: 18.35,
  headOn: 18.9,
  realize: 19.3,
  headGrabbed: 19.5,
  swap: 19.85,
  corrected: 20.2,
  nudge: 20.45,
  straightened: 20.75,
  turn: 21.0,
  cardGrip: 21.4,
  cardGripHeld: 21.52,
  cardLifted: 21.85,
  walkedBack: 22.55,
  slotted: 23.0,
  cardRelease: 23.2,
  headHeld: 23.5,
  exited: 24.6,
} as const;

/** Moments where one actor or prop visibly causes another to move; evidence for tests. */
export enum SnowmanContactKind {
  Grip = 'grip',
  Release = 'release',
  Seat = 'seat',
  Impact = 'impact',
  Compression = 'compression',
  HeadLaunch = 'head-launch',
  HeadLodge = 'head-lodge',
  BranchRelease = 'branch-release',
  HeadCatch = 'head-catch',
  Slot = 'slot',
}

/** One contact with its time; tests probe the plan around it. */
export interface SnowmanContact {
  kind: SnowmanContactKind;
  t: number;
}

/** World-pixel probe of the plan at one time, mirroring the renderer's interpolation. */
export interface SnowmanProbe {
  gripFront: Point;
  gripBack: Point;
  neck: Point;
  head: Point;
  headAttached: boolean;
  seat: Point;
  feet: [Point, Point];
  /** The card or sled's near-bottom corner and its rotation in degrees. */
  sled: { corner: Point; rotation: number } | null;
  /** The sled grips currently held, in world pixels. */
  sledGrips: [Point, Point] | null;
  present: Point;
  presentGrips: [Point, Point] | null;
}

interface Layer {
  ty: number;
  ind: number;
  nm: string;
  parent?: number;
  /** Precomposition asset of a `ty: 0` layer, with its size. */
  refId?: string;
  w?: number;
  h?: number;
  ip: number;
  op: number;
  st: number;
  sr: number;
  ks: SnowmanTransform;
  shapes?: SnowmanShape[];
}

/** One WAAPI keyframe of the borrowed card's copy, relative to its original rect. */
export interface SnowmanCardFrame {
  offset: number;
  dx: number;
  dy: number;
  rotate: number;
  opacity: number;
  easing: string;
}

/** Lottie data, the borrowed card's synchronized track and probes for tests. */
export interface SnowmanDeliveryComposition {
  targets: SnowmanDeliveryTargets;
  animationData: {
    v: string;
    fr: number;
    ip: number;
    op: number;
    w: number;
    h: number;
    nm: string;
    ddd: number;
    assets: { id: string; layers: Layer[] }[];
    layers: Layer[];
  };
  /** Keyframes of the card copy; empty with a drawn sled. */
  cardFrames: SnowmanCardFrame[];
  /** Grip contact and slot release, as offsets of the playback. */
  cardHideAt: number;
  cardRestoreAt: number;
  contacts: SnowmanContact[];
  /** Number of snow puff particles. */
  particleCount: number;
  probe: (seconds: number) => SnowmanProbe;
}

const B = SNOWMAN_BEATS;
const R = SNOWMAN_RIG;
const rad = (deg: number) => (deg * Math.PI) / 180;
const rotate = ([x, y]: Point, deg: number): Point => {
  const a = rad(deg);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const lerp = (a: Point, b: Point, p: number): Point => [
  a[0] + (b[0] - a[0]) * p,
  a[1] + (b[1] - a[1]) * p,
];
const point = (v: Vec): Point => [v[0], v[1]];
/** Glide ease: a cubic Bézier that reproduces the constant-acceleration glide exactly. */
const GLIDE: Bezier = [
  1 / 3,
  SNOWMAN_SLIDE.startSpeedShare / 3,
  2 / 3,
  (SNOWMAN_SLIDE.startSpeedShare + 1) / 3,
];
/* Arms follow held objects through dense samples, pruned where they move linearly. */
const STEP = 0.04;
/* Largest grip drift, in native units, that pruning an arm key may cause. */
const GRIP_TOLERANCE = 1.5;
const HEAD_CENTER: Point = add(R.neck, R.headOffset);
/** Longest step, in native units. */
const STRIDE = 34;

const toLottie = (
  track: Track,
  map: (v: Vec) => Vec = (v) => v,
): SnowmanProperty => {
  const out = (v: Vec) => map(v);
  if (!track.isAnimated) {
    const value = out(track.keys[0]?.v ?? [0]);
    return fixed(value.length === 1 ? value[0] : value);
  }
  return {
    a: 1,
    k: track.keys.map((key, index) => {
      const next = track.keys[index + 1];
      if (!next) return { t: key.t * FPS, s: out(key.v) };
      if (key.ease === 'hold') return { t: key.t * FPS, s: out(key.v), h: 1 };
      const [x1, y1, x2, y2] =
        key.ease === 'linear' ? ([0, 0, 1, 1] as const) : key.ease;
      return {
        t: key.t * FPS,
        s: out(key.v),
        e: out(next.v),
        o: { x: x1, y: y1 },
        i: { x: x2, y: y2 },
      };
    }),
  };
};
const cssEasing = (ease: Ease) => {
  if (ease === 'hold') return 'step-end';
  if (ease === 'linear') return 'linear';
  return `cubic-bezier(${ease.map((n) => +n.toFixed(4)).join(', ')})`;
};

/** Compose the snowman, props and the card copy's track on one Lottie clock. */
export const buildSnowmanDeliveryComposition = (
  targets: SnowmanDeliveryTargets,
  isMobile: boolean,
): SnowmanDeliveryComposition => {
  const { dir, scale: s, floor, stanceX, mode } = targets;
  const hasCard = targets.card != null;
  const world = ([x, y]: Point): Point => [
    stanceX + dir * s * x,
    floor + s * y,
  ];
  const local = (x: number) => (x - stanceX) / (dir * s);
  const wu = targets.sled.width / s;
  const hu = targets.sled.height / s;
  const lu = targets.slideLength / s;
  const seatFromFront = targets.seatFromFront / s;
  const seatOnSled = wu - seatFromFront;
  const placeX = STANCE_TO_SLED;
  const seat0 = placeX + seatOnSled;
  /* He fades in a few steps behind the ground strip's start. */
  const entry = local(targets.startEdge) - 30;
  const treeX = local(targets.treeX);
  const bankX = local(targets.snowbankX);
  const pivot: Point = add([treeX, 0], BRANCH_PIVOT);
  const socketRest: Point = add([treeX, 0], BRANCH_SOCKET);
  const catchX = socketRest[0] - 26;
  const presentGroundX = treeX - 20;
  const isRim = mode === SnowmanStage.Rim || mode === SnowmanStage.RimSled;
  /* Card slot: near-bottom corner and rotation; a drawn sled stands planted. */
  const slot: Point = hasCard
    ? [14, ((targets.card?.rect.bottom ?? floor) - floor) / s]
    : [34, -wu];
  const slotRotation = hasCard ? 0 : 90;
  /* Root height that brings both grips to the card's bottom edge; above
     his standing reach that means a jump, and he hangs from the card. */
  const reachY = hasCard ? Math.min(0, slot[1] + 124) : 0;
  const isJump = reachY < -2;

  /* ---- Rig and sled channels (stage-local units) ---- */
  const root = new Track([entry, 0]);
  const lean = new Track([3]);
  const squash = new Track([100]);
  const facing = new Track([1]);
  const travel = new Track([0]);
  const sledCorner = new Track([...slot]);
  const sledRotation = new Track([slotRotation]);
  const feetBack = new Track([entry - 10, 0]);
  const feetFront = new Track([entry + 11, 0]);
  const scarf = new Track([12]);
  const branch = new Track([0]);

  const flip = (t: number, to: 1 | -1) => {
    facing.set(t - 0.001, facing.at(t - 0.001), 'hold');
    facing.set(t, to, 'hold');
  };
  /** Moves a grounded foot to `x` with a small lift, so it never slides on the snow. */
  const stepFoot = (track: Track, t0: number, t1: number, x: number) => {
    const [from, y] = track.value(t0);
    if (Math.abs(from - x) <= 0.5 || Math.abs(y) > 1e-6) {
      track.set(
        t1,
        [Math.abs(y) > 1e-6 ? x : from, track.value(t1)[1]],
        'hold',
      );
      return;
    }
    track.set(t0, [from, 0], EASE);
    track.set((t0 + t1) / 2, [(from + x) / 2, -3], EASE);
    track.set(t1, [x, 0], 'hold');
  };
  /** Walk from the current root to `to`, planting feet on alternate steps. */
  const walk = (
    to: number,
    t0: number,
    t1: number,
    minSteps: number,
    bob = 2.5,
  ) => {
    const from = root.value(t0)[0];
    /* Short shuffling strides: a snowman's stubby feet never stretch apart. */
    const steps = Math.max(minSteps, Math.ceil(Math.abs(to - from) / STRIDE));
    const f = facing.at(t0 + 0.002);
    root.set(t0, [from, 0], EASE_IN);
    lean.set(t0, 3, EASE);
    const dt = (t1 - t0) / steps;
    let back = feetBack.value(t0)[0];
    let front = feetFront.value(t0)[0];
    feetBack.set(t0, [back, 0], 'hold');
    feetFront.set(t0, [front, 0], 'hold');
    for (let i = 1; i <= steps; i++) {
      const t = t0 + dt * i;
      const x = from + ((to - from) * i) / steps;
      /* A level carry needs no bob keys: the root then moves linearly. */
      if (bob > 0)
        root.set(
          t - dt / 2,
          [from + ((to - from) * (i - 0.5)) / steps, -bob],
          'linear',
        );
      root.set(t, [x, 0], i === steps ? EASE_OUT : 'linear');
      const moveBack = i % 2 === (f > 0 ? 1 : 0);
      const track = moveBack ? feetBack : feetFront;
      const old = moveBack ? back : front;
      const next = x + (moveBack ? -10 : 11) * f;
      track.set(t - dt, [old, 0], EASE);
      track.set(t - dt / 2, [(old + next) / 2, -4], EASE);
      track.set(t, [next, 0], 'hold');
      if (moveBack) back = next;
      else front = next;
    }
    /* The trailing foot catches up on the last step. */
    const settleFoot = (track: Track, offset: number) =>
      stepFoot(track, t1, t1 + 0.18, to + offset * f);
    settleFoot(feetBack, -10);
    settleFoot(feetFront, 11);
    lean.set(t1, 0, EASE);
  };
  const plant = (t: number) => {
    const x = root.value(t)[0];
    const f = facing.at(t);
    stepFoot(feetBack, t - 0.16, t, x - 10 * f);
    stepFoot(feetFront, t - 0.16, t, x + 11 * f);
  };

  /* Entrance and idea. */
  walk(0, 0, B.enterEnd, 4);
  plant(B.enterEnd + 0.2);
  lean.set(B.lookTree, -2).set(B.lookDistance, 1).set(B.lookCard, -4);
  root.set(B.idea - 0.05, [0, 0]).set(B.idea + 0.12, [0, -5], EASE_OUT);
  root.set(B.idea + 0.3, [0, 0], EASE_IN);
  squash
    .set(B.idea - 0.05, 100)
    .set(B.idea, 94)
    .set(B.idea + 0.15, 104)
    .set(B.idea + 0.32, 100);
  plant(B.idea + 0.32);

  /* Borrowing: crouch and jump (or reach), hang, resisted tug, his weight
     tears the card free, land, lower it in front, release. */
  const crouch = B.grip - 0.3;
  const jumpOff = B.grip - 0.18;
  root.set(B.presentOnHead, [0, 0]).set(crouch, [0, 0]);
  root.set(jumpOff, [0, 0], EASE_OUT).set(B.grip, [0, reachY]);
  root.set(B.gripHeld, [0, reachY]).set(B.tug1, [-1, reachY + 2 / s]);
  root.set(B.tug1End, [0, reachY]).set(B.tug2, [0, reachY], EASE_IN);
  root.set(B.free, [-2, 0], EASE_OUT).set(B.lowered, [6, 0]);
  root.set(B.release, [6, 0]).set(B.landed, [6, 0]);
  lean.set(B.presentOnHead, 0).set(crouch, 4).set(jumpOff, -2);
  lean.set(B.grip, -3).set(B.gripHeld, -3);
  lean.set(B.tug1, -4).set(B.tug1End, -2).set(B.tug2, -3);
  lean.set(B.free, -5, EASE_OUT).set(B.lowered, 14).set(B.release, 14);
  lean.set(B.landed, 6);
  squash.set(B.presentOnHead, 100).set(crouch, isJump ? 86 : 96);
  squash
    .set(jumpOff, isJump ? 108 : 100)
    .set(B.grip, 104)
    .set(B.gripHeld, 100);
  squash.set(B.tug1, isJump ? 102 : 96).set(B.tug1End, 100);
  squash
    .set(B.free, isJump ? 88 : 95)
    .set(B.free + 0.15, 102)
    .set(B.lowered, 100);
  plant(B.presentOnHead);
  /* Feet leave the snow with the jump, dangle, and land with him. */
  const footY = (track: Track, t: number, y: number, ease: Ease = EASE) =>
    track.set(t, [track.value(t)[0], y], ease);
  for (const track of [feetBack, feetFront]) {
    footY(track, jumpOff, 0, EASE_OUT);
    footY(track, B.grip, reachY);
    footY(track, B.gripHeld, reachY);
    footY(track, B.tug1, reachY + 2 / s);
    footY(track, B.tug1End, reachY);
    footY(track, B.tug2, reachY, EASE_IN);
    footY(track, B.free, 0, 'hold');
  }
  plant(B.free);
  plant(B.release);

  sledCorner.set(B.grip, slot).set(B.gripHeld, slot);
  sledCorner.set(B.tug1, add(slot, [0, hasCard ? 2 / s : -2]));
  sledCorner.set(B.tug1End, slot).set(B.tug2, slot);
  sledCorner.set(
    B.free,
    /* The card drops a little further than he does, staying in reach as he squashes on landing. */
    add(slot, hasCard ? [3, isJump ? 16 - reachY : 12] : [0, -8]),
    isJump ? EASE_IN : EASE_OUT,
  );
  sledRotation.set(B.grip, slotRotation).set(B.tug2, slotRotation);
  sledRotation.set(B.free, hasCard ? -3 : 70, EASE_OUT);
  sledCorner.set(B.lowered, [placeX, -40]);
  sledRotation.set(B.lowered, 0);
  sledCorner.set(B.release, [placeX, -40], EASE_IN);
  sledRotation.set(B.release, 0);
  sledCorner.set(B.landed, [placeX, 0], EASE_OUT);
  sledCorner.set(B.landed + 0.06, [placeX, -1.2], EASE_IN);
  sledCorner.set(B.landed + 0.12, [placeX, 0], 'hold');

  /* Present back to the chest, walk along the sled, test it, sit. */
  root.set(B.presentDown, [6, 0]).set(B.presentHeld, [4, 0]);
  lean.set(B.presentDown, 4).set(B.presentHeld, 0);
  plant(B.presentHeld);
  const seatSide = seat0 - 22;
  walk(seatSide, B.presentHeld, B.seatReached, 3);
  plant(B.seatReached + 0.2);
  feetFront.set(B.footTest, [seatSide + 11, 0], EASE);
  feetFront.set(B.footTest + 0.1, [seat0 - 4, -hu - 3], EASE);
  feetFront.set(B.footTest + 0.15, [seat0 - 4, -hu + 1 / s], EASE);
  feetFront.set(B.footTestEnd - 0.05, [seat0 - 4, -hu - 3], EASE);
  feetFront.set(B.footTestEnd, [seatSide + 11, 0], 'hold');
  lean.set(B.footTest, -4).set(B.footTestEnd, 0);
  sledCorner.set(B.footTest + 0.12, [placeX, 0]);
  sledCorner.set(B.footTest + 0.15, [placeX, 1 / s], EASE);
  sledCorner.set(B.footTestEnd - 0.05, [placeX, 0], 'hold');
  /* Anticipation crouch, then the seat lands on the sled top. */
  root.set(B.footTestEnd, [seatSide, 0]);
  squash.set(B.footTestEnd, 100).set(B.footTestEnd + 0.15, 92);
  root.set(B.footTestEnd + 0.15, [seatSide, 0], EASE);
  root.set(B.sit, [seat0, -hu + 5], EASE_OUT);
  squash.set(B.sit, 96).set(B.settled, 100);
  lean.set(B.sit, -4).set(B.settled, -2);
  const sitFeet = (t: number) => {
    feetBack.set(t, [seat0 + 12, -hu], 'hold');
    feetFront.set(t, [seat0 + 20, -hu], 'hold');
  };
  feetBack.set(B.footTestEnd + 0.15, feetBack.value(B.footTestEnd), EASE);
  feetFront.set(B.footTestEnd + 0.15, feetFront.value(B.footTestEnd), EASE);
  sitFeet(B.sit);

  /* Two scoots, then the glide; every rider channel shares the travel track. */
  travel
    .set(B.settled, 0)
    .set(B.push1, 0, EASE_IN)
    .set(B.push1End, lu * 0.04);
  travel
    .set(B.push2, lu * 0.04, EASE_IN)
    .set(B.push2End, lu * SNOWMAN_SLIDE.pushShare);
  travel
    .set(B.glide, lu * SNOWMAN_SLIDE.pushShare, GLIDE)
    .set(B.impact, lu, 'hold');
  lean
    .set(B.push1 - 0.15, -10)
    .set(B.push1, 12, EASE_OUT)
    .set(B.push1End, -2);
  lean
    .set(B.push2 - 0.2, -12)
    .set(B.push2, 14, EASE_OUT)
    .set(B.push2End, -4);
  lean.set(B.glide, -6).set(B.smug, -10).set(B.impact, -10);
  scarf
    .set(B.glide, 14)
    .set(B.glide + 0.5, 30)
    .set(B.smug, 55)
    .set(B.impact + 0.08, 72);
  for (const t of travel.keys.map((key) => key.t)) {
    if (t < B.settled || t > B.impact) continue;
    const key = travel.keys.find((k) => k.t === t);
    root.set(t, [seat0 + travel.at(t), -hu + 5], key?.ease ?? EASE);
    sledCorner.set(t, [placeX + travel.at(t), 0], key?.ease ?? EASE);
    for (const [track, offset] of [
      [feetBack, 12],
      [feetFront, 20],
    ] as const)
      track.set(t, [seat0 + offset + travel.at(t), -hu], key?.ease ?? EASE);
  }

  /* Impact: sled stops and noses up, body compresses, head flies on. */
  const crashCorner: Point = [placeX + lu, 0];
  const tilt = -14;
  const seatAt = (offset: number, angle: number): Point =>
    add(crashCorner, rotate([seatOnSled + offset, -hu], angle));
  const rootOnSled = (offset: number, angle: number): Point =>
    add(seatAt(offset, angle), rotate([0, 5], angle));
  sledRotation.set(B.impact, 0, EASE_OUT).set(B.impact + 0.08, tilt, 'hold');
  sledCorner.set(B.impact, crashCorner, 'hold');
  root.set(B.impact, root.value(B.impact), EASE_OUT);
  feetBack.set(B.impact, feetBack.value(B.impact), EASE_OUT);
  feetFront.set(B.impact, feetFront.value(B.impact), EASE_OUT);
  root.set(B.compressed, rootOnSled(3, tilt * 0.7), EASE_OUT);
  root.set(B.rebound, rootOnSled(1, tilt), EASE);
  root.set(B.settledImpact, rootOnSled(1, tilt), 'hold');
  lean.set(B.compressed, tilt * 0.7 + 10, EASE_OUT).set(B.rebound, tilt - 3);
  lean.set(B.settledImpact, tilt, 'hold');
  squash.set(B.impact, 100).set(B.compressed, 90, EASE_OUT).set(B.rebound, 105);
  squash.set(B.settledImpact, 100);
  scarf
    .set(B.compressed + 0.1, -30)
    .set(B.settledImpact + 0.2, 15)
    .set(B.settledImpact + 0.5, 10);
  const crashFoot = (offset: number): Point =>
    add(crashCorner, rotate([seatOnSled + 1 + offset, -hu], tilt));
  feetBack.set(B.compressed, crashFoot(12), 'hold');
  feetFront.set(B.compressed, crashFoot(20), 'hold');

  /* Stand, deliver the present with a bow, grope, catch the falling head. */
  root.set(B.standUp, rootOnSled(1, tilt), EASE);
  lean.set(B.standUp, tilt, EASE);
  root.set(B.standUp + 0.4, [catchX - 20, 0], EASE_OUT);
  lean.set(B.standUp + 0.4, 0);
  squash
    .set(B.standUp, 100)
    .set(B.standUp + 0.2, 94)
    .set(B.standUp + 0.4, 100);
  plant(B.standUp + 0.4);
  /* The bow puts the present about 50 units ahead of his root. */
  const bowX = presentGroundX - 50;
  walk(bowX, B.standUp + 0.4, B.bow - 0.1, 2);
  plant(B.bow - 0.1 + 0.18);
  lean
    .set(B.bow - 0.1, 0)
    .set(B.bow, 30)
    .set(B.presentPlaced, 50, EASE_OUT);
  squash.set(B.bow, 96).set(B.presentPlaced, 85);
  /* He steps into the bow, so the present reaches the ground. */
  root.set(B.bow - 0.1, [bowX, 0]).set(B.presentPlaced, [bowX, 0], EASE_OUT);
  plant(B.presentPlaced);
  lean.set(B.risen, 0, EASE);
  squash.set(B.risen, 100);
  /* He rises with one shuffle step under the bough. */
  walk(catchX, B.presentPlaced + 0.05, B.risen, 1);
  lean.set(B.presentPlaced + 0.05, 50, EASE).set(B.risen, 0, EASE);
  squash.set(B.presentPlaced + 0.05, 85);
  plant(B.risen + 0.18);
  lean.set(B.spread, -2).set(B.spread + 0.4, 0);
  lean
    .set(B.catch, 0)
    .set(B.catch + 0.08, 4)
    .set(B.catch + 0.22, 0);
  squash
    .set(B.catch, 100)
    .set(B.catch + 0.08, 95)
    .set(B.catch + 0.22, 100);

  /* Straighten the present, turn, take the card back, slot it, leave. */
  lean.set(B.corrected, 0).set(B.nudge, 46, EASE_OUT).set(B.straightened, 46);
  squash.set(B.corrected, 100).set(B.nudge, 88).set(B.straightened, 88);
  lean.set(B.turn - 0.05, 0, EASE);
  squash.set(B.turn - 0.05, 100);
  flip(B.turn, -1);
  plant(B.turn);
  const crashFar = add(crashCorner, rotate([wu, 0], tilt));
  const pickRoot = crashFar[0] + 14;
  walk(pickRoot, B.turn + 0.02, B.cardGrip - 0.12, 1);
  lean
    .set(B.cardGrip - 0.12, 0)
    .set(B.cardGrip, 18)
    .set(B.cardGripHeld, 18);
  lean.set(B.cardLifted, 2);
  plant(B.cardGripHeld);
  sledCorner.set(B.cardGrip, crashCorner).set(B.cardGripHeld, crashCorner);
  sledRotation.set(B.cardGrip, tilt).set(B.cardGripHeld, tilt);
  const carry = (x: number, y = 0): Point => [
    x - 14 - wu,
    -44 + (hasCard ? 0 : hu) + y,
  ];
  sledCorner.set(B.cardLifted, carry(pickRoot), 'hold');
  sledRotation.set(B.cardLifted, 0, 'hold');
  const backRoot = hasCard ? slot[0] + wu + 14 : placeX + wu + 14;
  walk(backRoot, B.cardLifted, B.walkedBack, 4, 0);
  /* Upright while carrying, so the card stays level in his mittens. */
  lean.set(B.cardLifted, 0).set(B.walkedBack, 0);
  /* The carried copy follows the root's eased first half-step and its
     linear stride, ignoring the 1-unit bob the mittens absorb. */
  const firstStride = root.keys.find((key) => key.t > B.cardLifted + 1e-6);
  if (firstStride) {
    sledCorner.set(B.cardLifted, carry(pickRoot), EASE_IN);
    sledCorner.set(firstStride.t, carry(firstStride.v[0]), 'linear');
    sledCorner.set(B.walkedBack, carry(backRoot), EASE);
  }
  plant(B.walkedBack + 0.2);
  if (hasCard) {
    /* Pushing the copy back up into its slot needs the same jump. */
    root.set(B.walkedBack, [backRoot, 0]).set(B.slotted - 0.12, [backRoot, 0]);
    root
      .set(B.slotted, [backRoot, reachY], EASE_IN)
      .set(B.cardRelease, [backRoot, reachY]);
    root
      .set(B.cardRelease + 0.25, [backRoot, 0], EASE_IN)
      .set(B.headHeld, [backRoot, 0]);
    squash.set(B.slotted - 0.12, isJump ? 88 : 100).set(B.slotted, 104);
    squash.set(B.cardRelease + 0.25, isJump ? 90 : 100).set(B.headHeld, 100);
    for (const track of [feetBack, feetFront]) {
      footY(track, B.slotted - 0.12, 0, EASE_OUT);
      footY(track, B.slotted, reachY);
      footY(track, B.cardRelease, reachY, EASE_IN);
      footY(track, B.cardRelease + 0.25, 0, 'hold');
    }
    /* Up to his standing reach first; the jump carries it the rest of the way. */
    sledCorner.set(B.walkedBack, carry(backRoot), EASE);
    sledCorner.set(B.slotted - 0.12, add(slot, [0, 14 - reachY]), EASE);
    sledCorner.set(B.slotted, slot, 'hold');
    sledRotation.set(B.slotted, 0, 'hold');
  } else {
    sledCorner.set(B.walkedBack, carry(backRoot), EASE_IN);
    sledCorner.set(B.walkedBack + 0.15, [placeX, 0], 'hold');
  }
  lean
    .set(B.walkedBack, 0)
    .set(B.slotted, -3)
    .set(B.cardRelease, -3)
    .set(B.headHeld, 0);
  walk(entry, B.headHeld, B.exited, 5);

  /* ---- Present: rig-relative while held, world pose once placed ---- */
  const presentRel = new Track([24, -58]);
  const presentRot = new Track([0]);
  const onHead: Point = [
    2,
    HEAD_CENTER[1] - R.headRadius - PRESENT_SIZE[1] / 2 + 1,
  ];
  presentRel.set(B.presentUp, [24, -58]);
  presentRel.set((B.presentUp + B.presentOnHead) / 2, [26, -104]);
  presentRel.set(B.presentOnHead, onHead);
  presentRot
    .set(B.tug1, 0)
    .set(B.tug1 + 0.12, -8)
    .set(B.tug1End, 4);
  presentRot
    .set(B.free, -6)
    .set(B.lowered, 5)
    .set(B.landed, -3)
    .set(B.presentDown, 0);
  presentRel.set(B.presentDown, onHead);
  presentRel.set((B.presentDown + B.presentHeld) / 2, [26, -104]);
  presentRel.set(B.presentHeld, [24, -58]);
  presentRel.set(B.sit, [24, -58]).set(B.settled, [22, -56]);
  presentRel.set(B.bow - 0.1, [22, -56]);
  presentRot.set(B.bow - 0.1, 0);

  /* ---- Rig sampling helpers ---- */
  interface Pose {
    root: Point;
    lean: number;
    sy: number;
    facing: number;
  }
  const pose = (t: number): Pose => ({
    root: point(root.value(t)),
    lean: lean.at(t),
    sy: squash.at(t) / 100,
    facing: facing.at(t) >= 0 ? 1 : -1,
  });
  const toStage = (p: Point, q: Pose): Point => {
    const sx = (1 + (1 - q.sy) * 0.5) * q.facing;
    return add(q.root, rotate([p[0] * sx, p[1] * q.sy], q.facing * q.lean));
  };
  const toRig = (p: Point, q: Pose): Point => {
    const sx = (1 + (1 - q.sy) * 0.5) * q.facing;
    const [x, y] = rotate(sub(p, q.root), -q.facing * q.lean);
    return [x / sx, y / q.sy];
  };

  /* Present placed with a deep bow: level-ish, slightly crooked, on the ground. */
  const placed: Point = [presentGroundX, -PRESENT_SIZE[1] / 2];
  const placedTilt = -8;
  const bowPose = pose(B.presentPlaced);
  presentRel.set(B.presentPlaced, toRig(placed, bowPose));
  presentRot.set(B.presentPlaced, placedTilt - bowPose.facing * bowPose.lean);
  const presentWorld = new Track([...placed]);
  const presentWorldRot = new Track([placedTilt]);
  presentWorldRot.set(B.corrected, placedTilt).set(B.nudge, placedTilt);
  presentWorldRot.set(B.straightened, 0, EASE_OUT);

  /* ---- Head: attached to the rig, or free in the world ---- */
  const headLift = new Track([0, 0]);
  const headTilt = new Track([0]);
  const headMirror = new Track([1]);
  const headShown = new Track([100]);
  headTilt.set(B.lookTree, -4).set(B.lookDistance, 2).set(B.lookCard, -14);
  headTilt
    .set(B.idea, -10)
    .set(B.idea + 0.3, 0)
    .set(B.grip, -8)
    .set(B.free, 0);
  headTilt.set(B.smug, 0).set(B.smug + 0.3, -8);
  headShown.set(B.separation - 0.001, 100, 'hold').set(B.separation, 0, 'hold');
  headShown.set(B.headOn, 100, 'hold');
  headMirror.set(B.headOn - 0.001, 1, 'hold').set(B.headOn, -1, 'hold');
  headLift.set(B.headGrabbed, [0, 0]).set(B.swap - 0.02, [0, -8], EASE_OUT);
  headMirror.set(B.swap - 0.001, -1, 'hold').set(B.swap, 1, 'hold');
  headLift.set(B.corrected, [0, 0], EASE_IN);
  headTilt.set(B.headOn, 0).set(B.realize, 6).set(B.headGrabbed, 0);

  const headFree = new Track();
  const headFreeRot = new Track();
  const headFreeMirror = new Track([1]);
  const launch = toStage(HEAD_CENTER, pose(B.separation));
  const returnRelease = hasCard ? B.cardRelease : B.walkedBack;
  /* The flight starts where the neck actually is, at the sled's own speed. */
  const sledSpeed = (travel.at(B.impact) - travel.at(B.impact - 0.001)) / 0.001;
  const flight = Math.min(
    0.6,
    Math.max(0.35, Math.abs(socketRest[0] - launch[0]) / sledSpeed),
  );
  const lodgeAt = B.separation + flight;
  const branchTip = (t: number): Point =>
    add(pivot, rotate(sub(socketRest, pivot), branch.at(t)));
  const lodgeSpin = 400;
  headFree.sample(B.separation, lodgeAt, 1 / 30, (t) => {
    const p = (t - B.separation) / flight;
    const [x, y] = lerp(launch, socketRest, p);
    return [x, y - 4 * 6 * p * (1 - p)];
  });
  headFreeRot.sample(B.separation, lodgeAt, 1 / 30, (t) => [
    (lodgeSpin * (t - B.separation)) / flight,
  ]);
  branch
    .set(lodgeAt, 0)
    .set(lodgeAt + 0.12, -12, EASE_OUT)
    .set(lodgeAt + 0.3, 5);
  branch.set(lodgeAt + 0.5, 0, EASE_OUT);
  branch.set(B.sneeze, 0).set(B.sneeze + 0.08, -10, EASE_OUT);
  branch.set(B.branchRelease, 14, EASE_IN).set(B.branchRelease + 0.25, -4);
  branch.set(B.branchRelease + 0.45, 0, EASE_OUT);
  headFree.sample(lodgeAt, lodgeAt + 0.5, 1 / 20, (t) => branchTip(t));
  headFree.set(B.sneeze - 0.5, branchTip(B.sneeze - 0.5));
  headFree.set(B.sneeze - 0.1, add(branchTip(B.sneeze), [-2, -2]), EASE);
  headFree.sample(B.sneeze, B.branchRelease, 1 / 30, (t) => branchTip(t));
  headFreeRot
    .set(lodgeAt, lodgeSpin)
    .set(B.inhale, lodgeSpin)
    .set(B.inhale + 0.4, lodgeSpin - 12);
  headFreeRot
    .set(B.sneeze, lodgeSpin + 8, EASE_OUT)
    .set(B.branchRelease, lodgeSpin);

  /* The waiting mittens catch the head; it lands facing the wrong way. */
  const caughtRel: Point = [26, -52];
  const catchPose = pose(B.catch);
  const caught = toStage(caughtRel, catchPose);
  const dropFrom = branchTip(B.branchRelease);
  headFree.sample(B.branchRelease, B.catch, 1 / 24, (t) => {
    const p = (t - B.branchRelease) / (B.catch - B.branchRelease);
    return lerp(dropFrom, caught, p * p);
  });
  headFreeRot.set(B.catch, 360, 'hold');
  headFreeMirror.set(B.catch - 0.001, 1, 'hold').set(B.catch, -1, 'hold');
  const headHeldRel = new Track([...caughtRel]);
  headHeldRel
    .set(B.catch, caughtRel)
    .set(B.catch + 0.1, add(caughtRel, [0, 3]));
  headHeldRel.set(B.catch + 0.18, caughtRel);
  headHeldRel.set(B.catch + 0.35, [30, -100], EASE);
  headHeldRel.set(B.headOn, HEAD_CENTER, EASE);
  headFree.sample(B.catch, B.headOn, STEP, (t) =>
    toStage(point(headHeldRel.value(t)), pose(t)),
  );

  /* ---- Arms: authored grip targets, or the held object's grips ---- */
  const frontTarget = new Track([22, -60]);
  const backTarget = new Track([12, -58]);
  const rest = (t: number, ease: Ease = EASE) => {
    frontTarget.set(t, [16, -46], ease);
    backTarget.set(t, [-14, -48], ease);
  };
  rest(B.cardRelease + 0.01);
  frontTarget
    .set(B.lookCard, [30, -70])
    .set(B.idea, [26, -96])
    .set(B.idea + 0.3, [30, -66]);
  rest(B.landed + 0.02);
  rest(B.seatReached);
  rest(B.risen);
  frontTarget.set(B.risen + 0.15, [8, -104]).set(B.risen + 0.35, [12, -98]);
  frontTarget.set(B.risen + 0.55, [6, -106]).set(B.spread - 0.05, [10, -100]);
  backTarget.set(B.risen + 0.15, [-14, -106]).set(B.risen + 0.35, [-18, -100]);
  backTarget.set(B.risen + 0.55, [-12, -108]).set(B.spread - 0.05, [-16, -104]);
  frontTarget.set(B.spread, [36, -82]).set(B.inhale, [38, -54]);
  backTarget.set(B.spread, [-34, -84]).set(B.inhale, [14, -56]);
  rest(B.headOn + 0.1);
  frontTarget.set(B.realize, [30, -88]).set(B.realize + 0.1, [26, -96]);
  rest(B.straightened + 0.1);
  rest(B.turn);

  type Grips = [front: Point, back: Point];
  /** Windows where the mittens follow a held object's grips, in rig coordinates. */
  const windows: { t0: number; t1: number; grips: (t: number) => Grips }[] = [];
  const presentGrips = (t: number): Grips => {
    const c = point(presentRel.value(t));
    const r = presentRot.at(t);
    return [
      add(c, rotate([PRESENT_SIZE[0] / 2, 0], r)),
      add(c, rotate([-PRESENT_SIZE[0] / 2, 0], r)),
    ];
  };
  const sledGripPoints = (t: number, far: boolean): Grips => {
    const n = point(sledCorner.value(t));
    const r = sledRotation.at(t);
    /* A low drawn sled is picked up by its top edge; a card by its bottom edge. */
    const edge = far && !hasCard ? -hu : 0;
    const near = (d: number) => add(n, rotate([far ? wu - d : d, edge], r));
    return [near(16), near(6)];
  };
  const headGrips = (center: Point): Grips => [
    add(center, [15, 2]),
    add(center, [-15, 2]),
  ];
  windows.push({ t0: 0, t1: B.presentOnHead, grips: presentGrips });
  windows.push({
    t0: B.grip,
    t1: B.release,
    grips: (t) =>
      sledGripPoints(t, false).map((p) => toRig(p, pose(t))) as Grips,
  });
  windows.push({ t0: B.presentDown, t1: B.bow - 0.3, grips: presentGrips });
  windows.push({ t0: B.bow - 0.3, t1: B.presentPlaced, grips: presentGrips });
  windows.push({
    t0: B.straightened - 0.3,
    t1: B.straightened,
    grips: (t) => {
      const corner = toRig(
        add(
          point(presentWorld.value(t)),
          rotate([-11, -9], presentWorldRot.at(t)),
        ),
        pose(t),
      );
      return [corner, [-14, -48]];
    },
  });
  windows.push({
    t0: B.catch,
    t1: B.headOn,
    grips: (t) => headGrips(point(headHeldRel.value(t))),
  });
  windows.push({
    t0: B.headGrabbed - 0.15,
    t1: B.corrected + 0.05,
    grips: (t) => headGrips(add(HEAD_CENTER, point(headLift.value(t)))),
  });
  windows.push({
    t0: B.cardGrip,
    t1: returnRelease,
    grips: (t) =>
      sledGripPoints(t, true).map((p) => toRig(p, pose(t))) as Grips,
  });
  windows.push({
    t0: B.cardRelease + 0.1,
    t1: END,
    grips: () => headGrips(HEAD_CENTER),
  });
  /* The present is held at the chest through the ride and impact. */
  /* Every key of a channel the grips depend on is a corner worth keeping. */
  const kinks = [
    root,
    lean,
    squash,
    facing,
    sledCorner,
    sledRotation,
    presentRel,
    presentRot,
    headLift,
  ].flatMap((track) => track.keys.map((key) => key.t));
  for (const w of windows) {
    const sample = (index: 0 | 1) => (t: number) => w.grips(t)[index];
    frontTarget.sample(w.t0, w.t1, STEP, sample(0), kinks);
    backTarget.sample(w.t0, w.t1, STEP, sample(1), kinks);
  }
  /* Catching mittens wait under the branch before the head drops. */
  const waiting = toRig(add(caught, [0, 4]), catchPose);
  frontTarget
    .set(B.inhale + 0.2, add(waiting, [15, 2]))
    .set(B.catch - 0.001, add(waiting, [15, 2]));
  backTarget
    .set(B.inhale + 0.2, add(waiting, [-15, 2]))
    .set(B.catch - 0.001, add(waiting, [-15, 2]));

  const armTracks = (shoulder: Point, target: Track) => {
    const upper = new Track();
    const bend = new Track();
    let previous = 60;
    for (const key of target.keys) {
      const solved = reachArm(shoulder, point(key.v), 1);
      let angle = solved.upper;
      while (angle - previous > 180) angle -= 360;
      while (angle - previous < -180) angle += 360;
      previous = angle;
      upper.set(key.t, angle, key.ease);
      bend.set(key.t, solved.bend, key.ease);
    }
    return { upper, bend };
  };
  /*
   * Upper and forearm keys share times, so they are pruned together by the
   * grip drift that dropping a key would cause (Douglas–Peucker on the grip).
   */
  const pruned = (arm: { upper: Track; bend: Track }, shoulder: Point) => {
    const { upper, bend } = arm;
    const keep = new Set<number>();
    const gripAt = (a: number, b: number) => armPose(shoulder, a, b).grip;
    const simplify = (from: number, to: number) => {
      keep.add(from);
      keep.add(to);
      let worst = -1;
      let error = GRIP_TOLERANCE;
      const [u0, u1] = [upper.keys[from], upper.keys[to]];
      const [b0, b1] = [bend.keys[from], bend.keys[to]];
      for (let i = from + 1; i < to; i++) {
        const p = (upper.keys[i].t - u0.t) / (u1.t - u0.t);
        const line = gripAt(
          u0.v[0] + (u1.v[0] - u0.v[0]) * p,
          b0.v[0] + (b1.v[0] - b0.v[0]) * p,
        );
        const actual = gripAt(upper.keys[i].v[0], bend.keys[i].v[0]);
        const deviation = Math.hypot(line[0] - actual[0], line[1] - actual[1]);
        if (deviation > error) {
          error = deviation;
          worst = i;
        }
      }
      if (worst > 0) {
        simplify(from, worst);
        simplify(worst, to);
      }
    };
    let start = 0;
    for (let i = 0; i < upper.keys.length; i++) {
      if (i < upper.keys.length - 1 && upper.keys[i].ease === 'linear')
        continue;
      simplify(start, i);
      start = i;
    }
    for (let i = upper.keys.length - 1; i >= 0; i--)
      if (!keep.has(i)) {
        upper.keys.splice(i, 1);
        bend.keys.splice(i, 1);
      }
    return arm;
  };
  const armFront = pruned(
    armTracks(R.shoulderFront, frontTarget),
    R.shoulderFront,
  );
  const armBack = pruned(armTracks(R.shoulderBack, backTarget), R.shoulderBack);
  const gripOf = (
    arm: { upper: Track; bend: Track },
    shoulder: Point,
    t: number,
  ) => armPose(shoulder, arm.upper.at(t), arm.bend.at(t)).grip;

  /* ---- Expressions ---- */
  const faces = (entries: [number, SnowmanFace][], first: SnowmanFace) => {
    const tracks = new Map<SnowmanFace, Track>();
    for (const face of Object.values(SnowmanFace))
      tracks.set(face, new Track([face === first ? 100 : 0]));
    for (const [t, face] of entries)
      for (const [name, track] of tracks) {
        track.set(t - 0.001, track.at(t - 0.001), 'hold');
        track.set(t, name === face ? 100 : 0, 'hold');
      }
    return tracks;
  };
  const attachedFaces = faces(
    [
      [B.idea, SnowmanFace.Idea],
      [B.presentUp, SnowmanFace.Neutral],
      [B.gripHeld, SnowmanFace.Cautious],
      [B.free, SnowmanFace.Neutral],
      [B.footTest, SnowmanFace.Cautious],
      [B.settled, SnowmanFace.Neutral],
      [B.glide, SnowmanFace.Cautious],
      [B.smug, SnowmanFace.Smug],
      [B.headOn, SnowmanFace.Neutral],
      [B.realize, SnowmanFace.Indignant],
      [B.corrected, SnowmanFace.Smug],
      [B.turn, SnowmanFace.Neutral],
      [B.headHeld, SnowmanFace.Smug],
    ],
    SnowmanFace.Neutral,
  );
  const freeFaces = faces(
    [
      [B.inhale, SnowmanFace.Sneeze],
      [B.branchRelease, SnowmanFace.Indignant],
    ],
    SnowmanFace.Indignant,
  );

  /* ---- Particles: snow spray at impact, puffs at the sneeze ---- */
  const particles: {
    start: Point;
    end: Point;
    t0: number;
    t1: number;
    r: number;
  }[] = [];
  const sprayCount = isMobile ? 2 : 6;
  const sneezeCount = isMobile ? 2 : 4;
  for (let i = 0; i < sprayCount; i++) {
    const a = -150 + (100 * i) / Math.max(1, sprayCount - 1);
    const start: Point = [bankX - 4, -10];
    particles.push({
      start,
      end: add(start, rotate([26 + (i % 3) * 6, 0], a)),
      t0: B.impact,
      t1: B.impact + 0.55,
      r: 2.6 + (i % 2),
    });
  }
  for (let i = 0; i < sneezeCount; i++) {
    const start = add(socketRest, [-14, 0]);
    particles.push({
      start,
      end: add(start, rotate([-22 - i * 5, 0], -20 + i * 14)),
      t0: B.sneeze,
      t1: B.sneeze + 0.45,
      r: 2.2,
    });
  }

  /* The sled's corner and rotation share one key set, eased by whichever changes. */
  const sledTimes = () =>
    [
      ...new Set([...sledCorner.keys, ...sledRotation.keys].map((k) => k.t)),
    ].sort((a, b) => a - b);
  const sledEase = (t: number): Ease => {
    const next = sledTimes().find((time) => time > t + 1e-6);
    const corner = sledCorner.keys.find((k) => Math.abs(k.t - t) < 1e-6);
    const turn = sledRotation.keys.find((k) => Math.abs(k.t - t) < 1e-6);
    if (next === undefined) return 'linear';
    const moves = (track: Track) =>
      track
        .value(t)
        .some((v, axis) => Math.abs(v - track.value(next)[axis]) > 1e-9);
    if (moves(sledCorner)) return corner?.ease ?? 'linear';
    if (moves(sledRotation)) return turn?.ease ?? 'linear';
    return 'hold';
  };

  /* ---- Layers (pushed bottom first) ---- */
  const layers: Layer[] = [];
  /* The snowman's own layers live in one precomposition, so a single
     opacity fades him in and out. */
  const snowmanLayers: Layer[] = [];
  let target = layers;
  const layer = (
    nm: string,
    ks: SnowmanTransform,
    shapes: SnowmanShape[] | undefined,
    {
      ip = 0,
      op = END,
      parent,
      null: isNull = false,
    }: {
      ip?: number;
      op?: number;
      parent?: Layer;
      null?: boolean;
    } = {},
  ): Layer => {
    const result: Layer = {
      ty: isNull ? 3 : 4,
      ind: target.length + 1,
      nm,
      ip: ip * FPS,
      op: op * FPS,
      st: 0,
      sr: 1,
      ks,
      ...(isNull ? {} : { shapes }),
      ...(parent ? { parent: parent.ind } : {}),
    };
    target.push(result);
    return result;
  };
  const stageKs = (): SnowmanTransform => ({
    ...identity(),
    p: fixed(world([0, 0])),
    s: fixed([dir * s * 100, s * 100]),
  });
  const worldScale = (mirror = 1) => [dir * mirror * s * 100, s * 100];

  if (!hasCard) {
    layer(
      'sled',
      {
        ...identity(),
        p: toLottie(
          (() => {
            const track = new Track();
            for (const t of sledTimes())
              track.set(
                t,
                world(
                  add(
                    point(sledCorner.value(t)),
                    rotate([wu / 2, 0], sledRotation.at(t)),
                  ),
                ),
                sledEase(t),
              );
            return track;
          })(),
        ),
        r: toLottie(
          (() => {
            const track = new Track();
            for (const t of sledTimes())
              track.set(t, dir * sledRotation.at(t), sledEase(t));
            return track;
          })(),
        ),
        s: fixed(worldScale()),
      },
      sledArt(),
    );
  }

  const groundStart = Math.min(local(targets.startEdge), treeX) - 20;
  const groundEnd = treeX + 44;
  const sceneryKs = stageKs();
  sceneryKs.o = toLottie(
    new Track([0])
      .set(0.4, 100)
      .set(END - 0.4, 100)
      .set(END, 0),
  );
  layer('scenery', sceneryKs, [
    group(
      'snowbank-group',
      snowbankArt(),
      {},
      { ...identity(), p: fixed([bankX, 0]) },
    ),
    group('tree-group', treeArt(), {}, { ...identity(), p: fixed([treeX, 0]) }),
    group(
      'ground-group',
      groundArt(groundEnd - groundStart, isRim ? 4 : 14),
      {},
      { ...identity(), p: fixed([(groundStart + groundEnd) / 2, 0]) },
    ),
  ]);

  const branchKs = stageKs();
  branchKs.o = sceneryKs.o;
  layer('branch', branchKs, [
    group(
      'bough-pivot',
      [
        group(
          'bough-at-tree',
          branchArt(),
          {},
          {
            ...identity(),
            p: fixed([treeX, 0]),
          },
        ),
      ],
      {},
      { ...identity(pivot), r: toLottie(branch) },
    ),
  ]);

  const flipStarts = facing.keys
    .filter(
      (key) =>
        key.ease === 'hold' &&
        facing.keys.some((k) => Math.abs(k.t - key.t - 0.001) < 1e-6),
    )
    .map((key) => key.t);
  const merged = (tracks: Track[], value: (t: number) => Vec, own: Track) => {
    const out = new Track();
    const times = [
      ...new Set(tracks.flatMap((track) => track.keys.map((k) => k.t))),
    ].sort((a, b) => a - b);
    for (const t of times) {
      const isFlip = flipStarts.some((start) => Math.abs(start - t) < 1e-6);
      const ownKey = own.keys.find((k) => Math.abs(k.t - t) < 1e-6);
      out.set(t, value(t), isFlip ? 'hold' : (ownKey?.ease ?? 'linear'));
    }
    return out;
  };
  const facingAt = (t: number) => (facing.at(t) >= 0 ? 1 : -1);
  const rigKs: SnowmanTransform = {
    ...identity(),
    p: toLottie(
      (() => {
        const track = new Track();
        for (const key of root.keys)
          track.set(key.t, world(point(key.v)), key.ease);
        return track;
      })(),
    ),
    r: toLottie(
      merged([lean, facing], (t) => [dir * facingAt(t) * lean.at(t)], lean),
    ),
    s: toLottie(
      merged(
        [squash, facing],
        (t) => {
          const sy = squash.at(t) / 100;
          return [
            dir * facingAt(t) * (1 + (1 - sy) * 0.5) * s * 100,
            sy * s * 100,
          ];
        },
        squash,
      ),
    ),
  };
  layer(
    'present-placed',
    {
      ...identity([0, -PRESENT_SIZE[1] / 2]),
      p: fixed(world(placed)),
      r: toLottie(presentWorldRot, (v) => [dir * v[0]]),
      s: fixed(worldScale()),
    },
    presentArt(),
    { ip: B.presentPlaced },
  );

  target = snowmanLayers;
  const rig = layer('rig', rigKs, undefined, { null: true });

  const transformOf = (shape: SnowmanShape | undefined) =>
    shape?.it?.find((item) => item.ty === 'tr') as unknown as SnowmanTransform;
  const armLayer = (
    name: string,
    shoulder: Point,
    arm: { upper: Track; bend: Track },
  ) => {
    const shapes = armArt(shoulder);
    const upperGroup = shapes[0];
    transformOf(upperGroup).r = toLottie(arm.upper);
    transformOf(upperGroup.it?.find((item) => item.nm === 'forearm')).r =
      toLottie(arm.bend);
    layer(name, identity(), shapes, { parent: rig });
  };
  const worldTrack = (track: Track) => {
    const out = new Track();
    for (const key of track.keys) out.set(key.t, world(point(key.v)), key.ease);
    return out;
  };
  const footLayer = (name: string, track: Track) =>
    layer(
      name,
      { ...identity(), p: toLottie(worldTrack(track)), s: fixed(worldScale()) },
      footArt(),
    );

  armLayer('arm-back', R.shoulderBack, armBack);
  footLayer('foot-back', feetBack);
  layer('body', identity(), bodyArt(), { parent: rig });
  const scarfShapes = scarfArt();
  transformOf(scarfShapes[0]).r = toLottie(scarf);
  layer('scarf', identity(), scarfShapes, { parent: rig });
  footLayer('foot-front', feetFront);

  layer(
    'present-held',
    identity(),
    [
      group(
        'present-pose',
        presentArt(),
        {},
        {
          ...identity(),
          a: fixed([0, -PRESENT_SIZE[1] / 2]),
          p: toLottie(presentRel),
          r: toLottie(presentRot),
        },
      ),
    ],
    { parent: rig, op: B.presentPlaced },
  );

  const withFaces = (shapes: SnowmanShape[], tracks: Map<SnowmanFace, Track>) =>
    shapes.map((shape) => {
      const face = Object.values(SnowmanFace).find(
        (name) => shape.nm === `face-${name}`,
      );
      if (face)
        transformOf(shape).o = toLottie(tracks.get(face) ?? new Track([0]));
      return shape;
    });
  layer(
    'head',
    { ...identity(), o: toLottie(headShown) },
    [
      group(
        'head-pose',
        withFaces(headArt(), attachedFaces),
        {},
        {
          ...identity(),
          p: toLottie(headLift, (v) => [
            HEAD_CENTER[0] + v[0],
            HEAD_CENTER[1] + v[1],
          ]),
          r: toLottie(headTilt),
          s: toLottie(headMirror, (v) => [v[0] * 100, 100]),
        },
      ),
    ],
    { parent: rig },
  );
  layer(
    'head-free',
    {
      ...identity(),
      p: toLottie(worldTrack(headFree)),
      r: toLottie(
        (() => {
          const out = new Track();
          for (const key of headFreeRot.keys)
            out.set(key.t, dir * key.v[0], key.ease);
          return out;
        })(),
      ),
      s: toLottie(headFreeMirror, (v) => worldScale(v[0])),
    },
    withFaces(headArt(), freeFaces),
    { ip: B.separation, op: B.headOn },
  );
  armLayer('arm-front', R.shoulderFront, armFront);
  target = layers;
  layer(
    'snowman',
    {
      ...identity(),
      o: toLottie(
        new Track([0])
          .set(0.35, 100)
          .set(B.exited - 0.35, 100)
          .set(B.exited, 0),
      ),
    },
    undefined,
  );
  const precomp = layers[layers.length - 1];
  Object.assign(precomp, {
    ty: 0,
    refId: 'snowman',
    w: targets.width,
    h: targets.height,
  });
  delete precomp.shapes;
  layer('needles', stageKs(), [
    group(
      'needles-at-tree',
      needlesArt(),
      {},
      {
        ...identity(),
        p: fixed([treeX, 0]),
      },
    ),
  ]);
  layer(
    'particles',
    stageKs(),
    particles.map(({ start, end, t0, t1, r }, index) =>
      group(
        `particle-${index}`,
        puffArt(r),
        {},
        {
          ...identity(),
          p: toLottie(
            new Track([...start]).set(t0, start, EASE_OUT).set(t1, end),
          ),
          o: toLottie(
            new Track([0])
              .set(t0 - 0.001, 0, 'hold')
              .set(t0, 100, EASE_IN)
              .set(t1, 0),
          ),
        },
      ),
    ),
    { ip: B.impact - 0.1, op: B.sneeze + 0.6 },
  );

  /* ---- Card copy frames (DOM), on the same keys and eases ---- */
  const cardFrames: SnowmanCardFrame[] = [];
  const card = targets.card;
  if (card) {
    const { rect } = card;
    const original: Point = [
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    ];
    const centerAt = (t: number): Point =>
      world(
        add(
          point(sledCorner.value(t)),
          rotate([wu / 2, -hu / 2], sledRotation.at(t)),
        ),
      );
    /* The snapshot helper fades the original over 1 % of the playback before
       `hideAt` and back over 4 % after `restoreAt`; the copy covers both
       fades exactly in place, so the swap is invisible. */
    const showFrom = B.grip - 0.3;
    const fadeStart = B.cardRelease + 1.0;
    const times = [
      0,
      showFrom - 0.001,
      showFrom,
      ...sledTimes(),
      B.cardRelease,
      fadeStart,
      fadeStart + 0.05,
      END,
    ]
      .filter((t, i, all) => t >= 0 && t <= END && all.indexOf(t) === i)
      .sort((a, b) => a - b);
    for (const t of times) {
      const [cx, cy] = centerAt(t);
      cardFrames.push({
        offset: t / END,
        dx: cx - original[0],
        dy: cy - original[1],
        rotate: dir * sledRotation.at(t),
        opacity: t >= showFrom && t <= fadeStart ? 1 : 0,
        easing:
          t < B.grip || t >= B.cardRelease
            ? 'step-end'
            : cssEasing(sledEase(t)),
      });
    }
  }

  const contacts: SnowmanContact[] = [
    { kind: SnowmanContactKind.Grip, t: B.grip },
    { kind: SnowmanContactKind.Release, t: B.release },
    { kind: SnowmanContactKind.Seat, t: B.sit },
    { kind: SnowmanContactKind.Impact, t: B.impact },
    { kind: SnowmanContactKind.Compression, t: B.impact + 1 / FPS },
    { kind: SnowmanContactKind.HeadLaunch, t: B.separation },
    { kind: SnowmanContactKind.HeadLodge, t: lodgeAt },
    { kind: SnowmanContactKind.BranchRelease, t: B.branchRelease },
    { kind: SnowmanContactKind.HeadCatch, t: B.catch },
    { kind: SnowmanContactKind.Grip, t: B.cardGrip },
    { kind: SnowmanContactKind.Slot, t: B.slotted },
  ];

  const probe = (t: number): SnowmanProbe => {
    const q = pose(t);
    const toWorld = (p: Point) => world(toStage(p, q));
    const attached = t < B.separation || t >= B.headOn;
    const held = windows.find((w) => t >= w.t0 && t <= w.t1);
    const sledHeld =
      (t >= B.grip && t <= B.release) ||
      (t >= B.cardGrip && t <= returnRelease);
    return {
      gripFront: toWorld(gripOf(armFront, R.shoulderFront, t)),
      gripBack: toWorld(gripOf(armBack, R.shoulderBack, t)),
      neck: toWorld(R.neck),
      head: attached
        ? toWorld(add(HEAD_CENTER, point(headLift.value(t))))
        : world(point(headFree.value(t))),
      headAttached: attached,
      seat: toWorld(R.seat),
      feet: [world(point(feetBack.value(t))), world(point(feetFront.value(t)))],
      sled: {
        corner: world(point(sledCorner.value(t))),
        rotation: dir * sledRotation.at(t),
      },
      sledGrips: sledHeld
        ? (sledGripPoints(t, t >= B.cardGrip).map(world) as [Point, Point])
        : null,
      present:
        t < B.presentPlaced
          ? toWorld(point(presentRel.value(t)))
          : world(point(presentWorld.value(t))),
      presentGrips:
        held && held.grips === presentGrips
          ? (presentGrips(t).map(toWorld) as [Point, Point])
          : null,
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
      nm: 'Delivery without losing your head',
      ddd: 0,
      assets: [{ id: 'snowman', layers: snowmanLayers.reverse() }],
      layers: layers.reverse(),
    },
    cardFrames,
    cardHideAt: B.grip / END,
    cardRestoreAt: B.cardRelease / END,
    contacts,
    particleCount: particles.length,
    probe,
  };
};
