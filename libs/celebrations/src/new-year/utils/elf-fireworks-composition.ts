import elves from '../assets/gift-wrapping-elves.json';
import { ElfFireworksMode } from '../types/new-year';
import {
  BURST_COLORS,
  caneArt,
  detonatorBoxArt,
  flameArt,
  flashArt,
  fuseSparkArt,
  plungerArt,
  ROCKET,
  ROCKET_COLORS,
  rocketArt,
  sackArt,
  smokeArt,
  sparkArt,
} from './elf-fireworks-art';
import {
  DETONATOR_SIZE,
  ELF_FISH_POSE,
  type ElfFireworksTargets,
  fishingHand,
  getElfFireworksRimLayout,
} from './elf-fireworks-targets';
import { ELF_RIG, elfPalm, elfReach } from './gift-wrapping-rig';
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

/** One authored timeline: entrance, rocket rack, fishing, stomp, fireworks, the dud ride and the fall back. */
export const ELF_FIREWORKS_MS = 25600;
const FPS = 60;
const END = ELF_FIREWORKS_MS / 1000;

/** Rockets that launch, per layout; one more dud always waits at the end of the rack. */
export const ELF_FIREWORKS_ROCKETS = { desktop: 5, mobile: 3 } as const;
/** Spark streaks per regular burst and in the final burst, per layout. */
export const ELF_FIREWORKS_SPARKS = {
  desktop: { burst: 12, finale: 18 },
  mobile: { burst: 8, finale: 12 },
} as const;

/** Beat times in seconds. */
export const ELF_FIREWORKS_BEATS = {
  enterEnd: 1.9,
  sackDown: 2.3,
  firstRelease: 2.75,
  lastRelease: 4.85,
  lookEnd: 5.5,
  idea: 5.9,
  turnToEnd: 6.1,
  atFish: 7.7,
  caneOut: 8.05,
  hook: 8.45,
  tug1: 8.65,
  tug1End: 8.8,
  tug2: 9,
  tug2End: 9.15,
  windUp: 9.3,
  yank: 9.45,
  caneAway: 9.85,
  landed: 10.05,
  turnToPress: 10.2,
  atPress: 11,
  press: 11.25,
  pressEnd: 11.4,
  lookRockets: 11.65,
  lookBack: 12,
  crouch: 12.25,
  jump: 12.4,
  stomp: 12.8,
  ignite: 12.85,
  firstLaunch: 13.15,
  lastLaunch: 14.83,
  cheer: 13.35,
  hopOff: 15.25,
  offLanded: 15.6,
  kick: 16,
  slotted: 16.55,
  restore: 16.75,
  turnToDud: 16.85,
  atDud: 17.5,
  peer: 17.95,
  dudFires: 18.05,
  hang: 18.2,
  dudExit: 19.25,
  finale: 19.4,
  hatLands: 20.05,
  fall: 20.25,
  fallLanded: 20.8,
  dizzyEnd: 21.85,
  bend: 22.25,
  hatOn: 22.65,
  bow: 23.05,
  bowEnd: 23.4,
  turnToExit: 23.5,
  exitEnd: 25.25,
} as const;

/** Rocket flight time, in seconds. */
export const ROCKET_FLIGHT_S = 0.85;
/** Burst lifetime, in seconds. */
export const BURST_LIFE_S = 1.4;

/** One WAAPI keyframe of the borrowed button's copy, relative to its original rect. */
export interface ElfButtonFrame {
  /** Offset of the playback. */
  offset: number;
  /** Horizontal translation in CSS pixels. */
  dx: number;
  /** Vertical translation in CSS pixels. */
  dy: number;
  /** Rotation in degrees. */
  rotate: number;
  /** Vertical scale about the centre. */
  scaleY: number;
  /** Copy opacity. */
  opacity: number;
  /** CSS easing of the segment that follows. */
  easing: string;
}

/** A burst of sparks, for tests and budgets. */
export interface ElfBurst {
  /** Viewport centre. */
  center: Point;
  /** Seconds when the sparks leave the centre. */
  t: number;
  /** Spark count. */
  sparks: number;
  /** Largest spark travel, in CSS pixels. */
  radius: number;
}

/** World positions at one time, for contact tests. */
export interface ElfFireworksProbe {
  /** Elf feet, between both boots. */
  feet: Point;
  /** The working hand. */
  hand: Point;
  /** The cane's hook bottom, or `null` while the cane is away. */
  hook: Point | null;
  /** Centre and vertical scale of the launch button (copy or detonator). */
  button: { center: Point; scaleY: number };
  /** Top centre of the launch button as drawn. */
  buttonTop: Point;
  /** Grip point of the dud rocket. */
  dudGrip: Point;
  /** Hat pivot, or `null` while it sits on the head. */
  hat: Point | null;
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

/** Lottie data, the button copy's synchronized track, bursts and probes for tests. */
export interface ElfFireworksComposition {
  /** The measured stage. */
  targets: ElfFireworksTargets;
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
  /** Keyframes of the button copy; empty with a drawn detonator. */
  buttonFrames: ElfButtonFrame[];
  /** Hook contact, as an offset of the playback. */
  buttonHideAt: number;
  /** Return to the slot, as an offset of the playback. */
  buttonRestoreAt: number;
  /** Launch times of the regular rockets, in rack order. */
  launches: number[];
  /** Regular bursts, then the finale. */
  bursts: ElfBurst[];
  /** World positions at a time, for contact tests. */
  probe: (seconds: number) => ElfFireworksProbe;
}

type ArtShape = SnowmanShape & { it?: ArtShape[] };

const B = ELF_FIREWORKS_BEATS;
const STEP = 1 / 30;
/* Props ride coarser samples than the elf: their paths bend less. */
const PROP_STEP = 1 / 24;
const ARM_REST: Point = [70, 30];
const HANG_ARM: Point = [-78, -8];
const HAT_PIVOT: Point = [0, -108];
const SACK_ON_BACK: Point = [-14, -34];
const FLIGHT: Bezier = [0.3, 0, 0.6, 1];
/* Sparks leave fast and coast: most of the travel happens in the first third. */
const SPARK_OUT: Bezier = [0.05, 0.7, 0.3, 1];
const CHEER_HOPS = [
  ELF_FIREWORKS_BEATS.stomp + 0.95,
  ELF_FIREWORKS_BEATS.stomp + 1.55,
];
const BURST_HEIGHTS = [0.25, 0.7, 0.4, 0.85, 0.55, 0.3];
const FINALE_COLORS = ['#f2a922', '#e8475b'] as const;

const rad = (angle: number) => (angle * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const rotate = ([x, y]: Point, angle: number): Point => {
  const a = rad(angle);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const point = (v: Vec): Point => [v[0], v[1]];
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const quad = ([p0, p1, p2]: Point[], p: number): Point => [
  (1 - p) ** 2 * p0[0] + 2 * (1 - p) * p * p1[0] + p ** 2 * p2[0],
  (1 - p) ** 2 * p0[1] + 2 * (1 - p) * p * p1[1] + p ** 2 * p2[1],
];
/** Clockwise degrees from "nose up" to the direction of travel along a quadratic curve. */
const quadHeading = ([p0, p1, p2]: Point[], p: number) => {
  const dx = 2 * (1 - p) * (p1[0] - p0[0]) + 2 * p * (p2[0] - p1[0]);
  const dy = 2 * (1 - p) * (p1[1] - p0[1]) + 2 * p * (p2[1] - p1[1]);
  return deg(Math.atan2(dx, -dy));
};
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
/** Fades in from `t0` and out by `t1`. */
const fade = (t0: number, t1: number, inFor: number, outFor: number) =>
  new Track([0])
    .set(t0, 0)
    .set(t0 + inFor, 100)
    .set(t1 - outFor, 100)
    .set(t1, 0);
/** A scale channel that flickers between two sizes from `t0` to `t1`. */
const flicker = (t0: number, t1: number, small: Vec, large: Vec, from: Vec) => {
  const track = new Track(from).set(t0, from, 'linear');
  for (let t = t0 + 0.06, n = 0; t < t1; t += 0.11, n++)
    track.set(t, n % 2 ? small : large, 'linear');
  return track;
};

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

/** Compose the elf, his rockets and the button copy's track on one Lottie clock. */
export const buildElfFireworksComposition = (
  targets: ElfFireworksTargets,
  isMobile: boolean,
): ElfFireworksComposition => {
  const { dir, scale: s, floor, startEdge, span, width, height } = targets;
  const button =
    targets.mode === ElfFireworksMode.Button ? targets.button : null;
  const layoutKey = isMobile ? 'mobile' : 'desktop';
  const launched = ELF_FIREWORKS_ROCKETS[layoutKey];
  const rocketCount = launched + 1;
  const sparkCounts = ELF_FIREWORKS_SPARKS[layoutKey];
  /** Viewport x of a distance along the rim from its start edge. */
  const X = (a: number) => startEdge + dir * a;
  /** Distance along the rim of a viewport x. */
  const A = (x: number) => (x - startEdge) * dir;

  const bw = button ? button.rect.width : DETONATOR_SIZE.width * s;
  const bh = button ? button.rect.height : DETONATOR_SIZE.height * s;
  const rim = getElfFireworksRimLayout(span, s, bw, rocketCount);
  const dudA = rim.rack[rocketCount - 1];
  const sackWorld: Point = [X(rim.sack), floor];
  const sackMouth: Point = [X(rim.sack), floor - 30 * s];
  const [fishHandX, fishHandY] = fishingHand();
  const fishA = button
    ? A((button.rect.left + button.rect.right) / 2) -
      (fishHandX + ELF_FISH_POSE.hookOffset) * s
    : rim.toss;
  const caneLength = button
    ? Math.max(24, (button.rect.top + 1 - (floor + fishHandY * s)) / s)
    : 0;
  const dudStanceA = dudA + 24 * s;
  const hatA = dudA - 6 * s;
  const fallA = hatA + 34 * s;

  /* ---- Elf channels: position along the rim and height above it, in px ---- */
  /* He fades in and out on the rim within a short walk of his first and last stops. */
  const pos = new Track([Math.min(span + 6, rim.toss + 150 * s), 0]);
  const face = new Track([-1]);
  const lean = new Track([-4]);
  const squash = new Track([100, 100]);
  const upper = new Track([ARM_REST[0]]);
  const fore = new Track([ARM_REST[1]]);
  const headTilt = new Track([0]);
  const legBack = new Track([0]);
  const legFront = new Track([0]);
  const faces = {
    expression: new Track([100]),
    surprise: new Track([0]),
    annoyed: new Track([0]),
  };
  const capShown = new Track([100]);

  const screenFacing = (t: number) => dir * (face.at(t) >= 0 ? 1 : -1);
  /** World point of a native elf point at `t`, under the body pose. */
  const elfWorld = (t: number, [x, y]: Point): Point => {
    const [sx, sy] = squash.value(t);
    const local = rotate([(x * sx) / 100, (y * sy) / 100], lean.at(t));
    const [a, up] = pos.value(t);
    return [X(a) + screenFacing(t) * s * local[0], floor + up + s * local[1]];
  };
  /** Native elf point of a world point at `t`, under the body pose. */
  const elfLocal = (t: number, [x, y]: Point): Point => {
    const [a, up] = pos.value(t);
    const [sx, sy] = squash.value(t);
    const local = rotate(
      [(x - X(a)) / (screenFacing(t) * s), (y - floor - up) / s],
      -lean.at(t),
    );
    return [(local[0] * 100) / sx, (local[1] * 100) / sy];
  };
  const flip = (t: number, to: 1 | -1) => setHeld(face, t, to);
  const setFace = (t: number, name: keyof typeof faces) => {
    for (const [key, track] of Object.entries(faces))
      setHeld(track, t, key === name ? 100 : 0);
  };
  /** Walk to `to` along the rim with alternating steps and a light bob. */
  const walk = (to: number, t0: number, t1: number) => {
    const [from, y] = pos.value(t0);
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) / (20 * s)));
    pos.set(t0, [from, y], 'linear');
    const dt = (t1 - t0) / steps;
    for (let i = 1; i <= steps; i++) {
      const t = t0 + dt * i;
      pos.set(t - dt / 2, [lerp(from, to, (i - 0.5) / steps), y - 2], 'linear');
      pos.set(t, [lerp(from, to, i / steps), y], i === steps ? EASE : 'linear');
      const swing = i % 2 ? 16 : -16;
      legBack.set(t - dt / 2, swing);
      legFront.set(t - dt / 2, -swing);
    }
    legBack.set(t0, 0).set(t1, 0);
    legFront.set(t0, 0).set(t1, 0);
    lean
      .set(t0, lean.at(t0))
      .set(t0 + 0.2, 4)
      .set(t1 - 0.1, 4)
      .set(t1, 0);
  };
  /** A ballistic hop of the root from where it is at `t0` to `[toA, toUp]`. */
  const hop = (
    t0: number,
    t1: number,
    toA: number,
    toUp: number,
    rise: number,
  ) => {
    const [fromA, fromUp] = pos.value(t0);
    pos.sample(t0, t1, STEP, (t) => {
      const p = (t - t0) / (t1 - t0);
      return [lerp(fromA, toA, p), arcY(fromUp, toUp, rise * s, p)];
    });
  };
  const land = (t: number, depth = 86) => {
    squash.set(t, [100, 100], 'linear');
    squash.set(t + 0.08, [100 + (100 - depth) * 0.5, depth], EASE_OUT);
    squash.set(t + 0.22, [98, 103]);
    squash.set(t + 0.34, [100, 100]);
  };
  const stompUp = (sy: number) => -bh * sy;

  /* ==== Pass 1: the body ==== */

  /* Entrance with the sack on his back; it goes down behind him. */
  walk(rim.toss, 0, B.enterEnd);
  lean
    .set(B.enterEnd + 0.15, -2)
    .set(B.sackDown, 3)
    .set(B.sackDown + 0.25, 0);
  const releases = rim.rack.map((_, i) =>
    lerp(B.firstRelease, B.lastRelease, i / (rocketCount - 1)),
  );
  const grabs = releases.map((t) => t - 0.24);
  for (const release of releases)
    lean
      .set(release - 0.24, 6)
      .set(release, -6, EASE_OUT)
      .set(release + 0.18, 0);

  /* The idea: what is there to press? He looks along the rim and hops. */
  headTilt
    .set(B.lookEnd - 0.3, 0)
    .set(B.lookEnd, -10)
    .set(B.idea, 14);
  headTilt.set(B.idea + 0.3, 0);
  pos.set(B.idea - 0.02, [rim.toss, 0], 'linear');
  pos.set(B.idea + 0.12, [rim.toss, -6], EASE_OUT);
  pos.set(B.idea + 0.28, [rim.toss, 0]);
  setFace(B.idea, 'surprise');
  setFace(B.idea + 0.5, 'expression');
  flip(B.turnToEnd, 1);
  if (button) walk(fishA, B.turnToEnd + 0.05, B.atFish);
  /* Lower the hook (or dig in the sack), tug twice, then yank. */
  lean.set(B.caneOut, button ? 4 : 10).set(B.hook, ELF_FISH_POSE.lean);
  setFace(B.hook + 0.05, 'annoyed');
  for (const [t, back] of [
    [B.tug1, B.tug1End],
    [B.tug2, B.tug2End],
  ]) {
    lean.set(t, ELF_FISH_POSE.lean - 5, EASE_OUT).set(back, ELF_FISH_POSE.lean);
    squash
      .set(t, [100, 100])
      .set(t + 0.06, [103, 96])
      .set(back, [100, 100]);
  }
  lean.set(B.windUp, ELF_FISH_POSE.lean + 4).set(B.yank, -18, EASE_OUT);
  lean.set(B.landed, -6).set(B.turnToPress, 0);
  squash.set(B.windUp, [104, 92]).set(B.yank, [97, 106], EASE_OUT);
  squash.set(B.yank + 0.2, [100, 100]);
  setFace(B.landed, 'surprise');

  /* To the button, facing it; a press by hand does nothing. */
  const fromA = pos.value(B.turnToPress)[0];
  const towardPress = rim.press >= fromA ? 1 : -1;
  flip(B.turnToPress, towardPress);
  walk(rim.press, B.turnToPress + 0.05, B.atPress);
  if (towardPress > 0) flip(B.atPress + 0.02, -1);
  setFace(B.atPress, 'expression');
  lean
    .set(B.press - 0.2, 6)
    .set(B.press, 10, EASE_OUT)
    .set(B.pressEnd, 4);
  lean.set(B.lookRockets, 0);
  headTilt
    .set(B.pressEnd, 0)
    .set(B.lookRockets, -8)
    .set(B.lookBack - 0.1, -8);
  headTilt
    .set(B.lookBack, 12)
    .set(B.crouch - 0.05, 12)
    .set(B.crouch, 0);
  setFace(B.lookBack, 'annoyed');
  /* Stomp on it with both boots. */
  squash.set(B.crouch - 0.1, [100, 100]).set(B.crouch, [106, 86]);
  squash.set(B.jump, [96, 108], EASE_OUT).set(B.jump + 0.2, [100, 100]);
  lean.set(B.crouch, 8).set(B.jump, -4).set(B.stomp, 0);
  hop(B.jump, B.stomp, rim.land, stompUp(1), 34);
  pos.set(B.stomp + 0.08, [rim.land, stompUp(0.72)], EASE_OUT);
  land(B.stomp + 0.02, 80);
  /* Cheering on the button: two small hops after the first rockets. */
  setFace(B.cheer, 'expression');
  headTilt
    .set(B.cheer, -14)
    .set(B.hopOff - 0.3, -14)
    .set(B.hopOff, 0);
  for (const t of CHEER_HOPS) {
    pos.set(t - 0.001, [rim.land, stompUp(0.72)], 'linear');
    hop(t, t + 0.36, rim.land, stompUp(0.82), 10);
    pos.set(t + 0.44, [rim.land, stompUp(0.72)], EASE_OUT);
    land(t + 0.36, 92);
  }
  /* Hop off on the start side and kick the button home. */
  pos.set(B.hopOff - 0.001, [rim.land, stompUp(0.72)], 'linear');
  pos.set(B.hopOff + 0.05, [rim.land, stompUp(1)], EASE_OUT);
  hop(B.hopOff + 0.05, B.offLanded, rim.kick, 0, 18);
  land(B.offLanded);
  flip(B.offLanded + 0.1, 1);
  legFront.set(B.kick - 0.25, 0).set(B.kick - 0.1, 24);
  legFront.set(B.kick, -38, EASE_OUT).set(B.kick + 0.25, 0);
  lean
    .set(B.kick - 0.1, -6)
    .set(B.kick, 6)
    .set(B.kick + 0.3, 0);
  setFace(B.kick, 'expression');

  /* The dud: walk to it, peer in; it fires and he holds on. */
  flip(B.turnToDud, -1);
  walk(dudStanceA, B.turnToDud + 0.05, B.atDud);
  lean
    .set(B.atDud + 0.1, 0)
    .set(B.peer, 22)
    .set(B.dudFires, 22);
  headTilt.set(B.atDud + 0.1, 0).set(B.peer, 10);
  setFace(B.peer, 'surprise');
  const dudRest: Point = [X(dudA), floor + ROCKET.pivot[1] * s];
  const dudGripRest: Point = [X(dudA), floor + ROCKET.grip[1] * s];
  const exitX = X(span * 0.12);
  const flight: Point[] = [
    dudRest,
    [lerp(dudRest[0], exitX, 0.55), floor - 90 * s],
    [exitX, -220],
  ];
  const flightProgress = (t: number) =>
    bezierProgress(
      EASE_IN,
      clamp((t - B.dudFires) / (B.dudExit - B.dudFires), 0, 1),
    );
  const dudPivotAt = (t: number): Point => quad(flight, flightProgress(t));
  const dudAngleAt = (t: number) =>
    quadHeading(flight, Math.max(0.02, flightProgress(t)));
  const gripOffset: Point = [
    (ROCKET.grip[0] - ROCKET.pivot[0]) * s,
    (ROCKET.grip[1] - ROCKET.pivot[1]) * s,
  ];
  const dudGripAt = (t: number): Point =>
    t <= B.dudFires
      ? dudGripRest
      : add(dudPivotAt(t), rotate(gripOffset, dudAngleAt(t)));
  lean
    .set(B.hang, -10)
    .set(B.hang + 0.4, -24)
    .set(B.dudExit, -30);
  legBack
    .set(B.dudFires, 0)
    .set(B.hang + 0.2, -30)
    .set(B.dudExit, -20);
  legFront
    .set(B.dudFires, 0)
    .set(B.hang + 0.2, 18)
    .set(B.dudExit, 26);
  setHeld(capShown, B.dudFires, 0);
  /* He stays on his boots until the rocket lifts him; the arm takes the rest. */
  pos.set(B.dudFires, [dudStanceA, 0], EASE_IN);
  pos.sample(B.hang, B.dudExit, STEP, (t) => {
    const grip = dudGripAt(t);
    const palm = rotate(elfPalm(...HANG_ARM), lean.at(t));
    const along = A(grip[0] - screenFacing(t) * palm[0] * s);
    const up = grip[1] - floor - palm[1] * s;
    /* Dragged on his boots until the rocket is high enough to lift him. */
    return [along, Math.min(0, up)];
  });

  /* The fall back: from above the viewport onto the rim beside his hat. */
  const above = -floor - 180;
  pos.set(B.dudExit + 0.01, [fallA, above], 'hold');
  lean.set(B.dudExit + 0.01, 0, 'hold');
  legBack.set(B.dudExit + 0.01, 0, 'hold');
  legFront.set(B.dudExit + 0.01, 0, 'hold');
  pos.set(B.fall, [fallA, above], EASE_IN);
  pos.set(B.fallLanded, [fallA, 0], 'linear');
  lean.set(B.fall, 0).set(B.fallLanded, 0);
  land(B.fallLanded, 72);
  setFace(B.fall, 'surprise');
  setFace(B.fallLanded + 0.3, 'annoyed');
  for (let i = 0; i < 4; i++)
    headTilt.set(B.fallLanded + 0.35 + i * 0.2, i % 2 ? -12 : 12);
  headTilt.set(B.dizzyEnd, 0);
  /* Pick the hat up, put it on, bow and leave with the sack. */
  lean
    .set(B.dizzyEnd, 0)
    .set(B.bend, 30)
    .set(B.hatOn - 0.15, 30);
  lean.set(B.hatOn, 0);
  setHeld(capShown, B.hatOn, 100);
  setFace(B.hatOn, 'expression');
  lean
    .set(B.bow, 0)
    .set(B.bow + 0.2, 34)
    .set(B.bowEnd, 34);
  lean.set(B.bowEnd + 0.15, 0);
  flip(B.turnToExit, 1);
  const exitA = Math.min(span + 10, Math.max(fallA, rim.sack) + 120 * s);
  walk(exitA, B.turnToExit + 0.05, B.exitEnd);

  /* ==== Pass 2: the arm, against the finished body ==== */

  /* The nearest turn of an angle to the previous pose, so solved arms never spin round. */
  const unwrap = (angle: number, near: number) =>
    angle + 360 * Math.round((near - angle) / 360);
  const setArm = (t: number, [u, f]: Point, ease: Ease = EASE) => {
    upper.set(t, unwrap(u, upper.at(t)), ease);
    fore.set(t, unwrap(f, fore.at(t)), ease);
  };
  const reachWorld = (t: number, target: Point, ease: Ease = EASE) =>
    setArm(t, elfReach(elfLocal(t, target)), ease);
  const palmAt = (t: number) => elfPalm(upper.at(t), fore.at(t));
  const handAt = (t: number) => elfWorld(t, palmAt(t));

  /* Reach into the sack behind him, toss each rocket ahead. */
  for (const [i, release] of releases.entries()) {
    reachWorld(grabs[i] - 0.14, add(sackMouth, [0, 4 * s]));
    reachWorld(grabs[i], add(sackMouth, [0, 8 * s]));
    setArm(release, [-35, -15], EASE_OUT);
    setArm(release + 0.2, [30, 40]);
  }
  setArm(B.lastRelease + 0.4, ARM_REST);
  if (button) {
    setArm(B.atFish + 0.1, [40, -30]);
    setArm(B.caneOut, ELF_FISH_POSE.arm);
    setArm(B.windUp, ELF_FISH_POSE.arm);
    setArm(B.yank, [10, -20], EASE_OUT);
  } else {
    /* Rummage in the sack in front of him. */
    reachWorld(B.caneOut, add(sackMouth, [0, 2 * s]));
    for (const [t, back] of [
      [B.tug1, B.tug1End],
      [B.tug2, B.tug2End],
    ]) {
      reachWorld(t, add(sackMouth, [0, 10 * s]), EASE_OUT);
      reachWorld(back, add(sackMouth, [0, 2 * s]));
    }
    reachWorld(B.windUp, add(sackMouth, [0, 10 * s]));
    setArm(B.yank, [-20, -10], EASE_OUT);
  }
  setArm(B.caneAway, [120, 10]);
  setArm(B.turnToPress, ARM_REST);
  const buttonTop = (sy: number): Point => [X(rim.land), floor - bh * sy];
  reachWorld(B.press - 0.2, add(buttonTop(1), [0, -10 * s]));
  reachWorld(B.press, buttonTop(0.88), EASE_OUT);
  reachWorld(B.pressEnd, add(buttonTop(1), [0, -6 * s]));
  setArm(B.pressEnd + 0.2, ARM_REST);
  /* Scratch the cap. */
  setArm(B.lookRockets + 0.1, [-100, -40]);
  setArm(B.lookBack - 0.05, [-95, -50]);
  setArm(B.crouch, [60, 40]);
  setArm(B.jump, [-60, -40], EASE_OUT);
  setArm(B.stomp + 0.3, ARM_REST);
  setArm(B.cheer, [-80, -20], EASE_OUT);
  setArm(B.hopOff - 0.3, [-60, -30]);
  setArm(B.hopOff, ARM_REST);
  setArm(B.turnToDud, ARM_REST);
  reachWorld(B.peer, add(dudGripRest, [0, -10 * s]));
  reachWorld(B.dudFires, dudGripRest, EASE_OUT);
  for (let t = B.dudFires + STEP; t <= B.dudExit + 1e-6; t += STEP)
    reachWorld(t, dudGripAt(t), 'linear');
  setArm(B.dudExit + 0.01, [-70, -20], 'hold');
  setArm(B.fallLanded, [-70, -20]);
  setArm(B.fallLanded + 0.2, ARM_REST);
  const hatRest: Point = [X(hatA), floor - 17 * s];
  setArm(B.dizzyEnd, ARM_REST);
  reachWorld(B.bend, hatRest);
  reachWorld(B.hatOn - 0.15, add(hatRest, [0, -4 * s]));
  setArm(B.hatOn, [-60, -70]);
  setArm(B.hatOn + 0.3, ARM_REST);

  /* ==== Pass 3: props that follow the body or the hand ==== */

  /* The hat: pops off at the launch, flutters down, rides the hand back up. */
  const hatPos = new Track();
  const hatRot = new Track([0]);
  const hatStart = elfWorld(B.dudFires, HAT_PIVOT);
  const hatPeak: Point = [hatStart[0] + dir * 20 * s, hatStart[1] - 40 * s];
  const hatOnHead = elfWorld(B.hatOn, HAT_PIVOT);
  hatPos.set(B.dudFires, hatStart, EASE_OUT).set(B.dudFires + 0.3, hatPeak);
  hatPos.sample(B.dudFires + 0.3, B.hatLands, STEP, (t) => {
    const p = (t - B.dudFires - 0.3) / (B.hatLands - B.dudFires - 0.3);
    const sway = Math.sin(p * Math.PI * 3) * 18 * s * (1 - p);
    return [
      lerp(hatPeak[0], hatRest[0], p) + sway,
      lerp(hatPeak[1], hatRest[1], p),
    ];
  });
  const tilted = screenFacing(B.dudFires) * lean.at(B.dudFires);
  hatRot.sample(B.dudFires, B.hatLands, STEP, (t) => {
    const p = (t - B.dudFires) / (B.hatLands - B.dudFires);
    return [tilted * (1 - p) ** 2 + Math.sin(p * Math.PI * 3) * 24 * (1 - p)];
  });
  hatPos.set(B.bend, hatRest);
  hatPos.sample(B.bend, B.hatOn, STEP, (t) => {
    const p = bezierProgress(EASE, (t - B.bend) / (B.hatOn - B.bend));
    return [
      lerp(hatRest[0], hatOnHead[0], p),
      lerp(hatRest[1], hatOnHead[1], p) - Math.sin(p * Math.PI) * 14 * s,
    ];
  });
  hatPos.prune(0.4);
  hatRot.prune(0.5);

  /* The launch button: centre x, bottom y, rotation and vertical scale. */
  const restCenter: Point = button
    ? [
        (button.rect.left + button.rect.right) / 2,
        (button.rect.top + button.rect.bottom) / 2,
      ]
    : [X(rim.land), floor - bh / 2];
  const restBottom = restCenter[1] + bh / 2;
  const landX = X(rim.land);
  const launcher = button
    ? new Track([restCenter[0], restBottom, 0, 1])
    : new Track([sackMouth[0], sackMouth[1], 0, 1]);
  const keyAt = (t: number, ease: Ease = EASE) =>
    launcher.set(t, launcher.value(t), ease);
  const squashAt = (t: number, sy: number, ease: Ease = EASE) => {
    const [x, y, r] = launcher.value(t);
    launcher.set(t, [x, y, r, sy], ease);
  };
  const arc = (
    t0: number,
    t1: number,
    to: Point,
    rise: number,
    spin: number,
  ) => {
    const [x0, y0, r0] = launcher.value(t0);
    launcher.sample(t0, t1, STEP, (t) => {
      const p = (t - t0) / (t1 - t0);
      return [
        lerp(x0, to[0], p),
        arcY(y0, to[1], rise, p),
        r0 + spin * bezierProgress(EASE, p),
        1,
      ];
    });
  };
  if (button) {
    keyAt(B.hook);
    for (const [t, back] of [
      [B.tug1, B.tug1End],
      [B.tug2, B.tug2End],
    ]) {
      launcher.set(t, [restCenter[0], restBottom - 3, 0, 1], EASE_OUT);
      launcher.set(back, [restCenter[0], restBottom, 0, 1]);
    }
  }
  keyAt(B.yank, 'linear');
  arc(B.yank, B.landed, [landX, floor], (button ? 70 : 60) * s, -dir * 360);
  const spun = launcher.value(B.landed)[2];
  launcher.set(B.landed, [landX, floor, spun, 1], 'linear');
  launcher.set(B.landed + 0.07, [landX, floor, spun, 0.85], EASE_OUT);
  launcher.set(B.landed + 0.16, [landX, floor, spun, 1.05]);
  launcher.set(B.landed + 0.26, [landX, floor, spun, 1]);
  keyAt(B.press - 0.02);
  squashAt(B.press, 0.88, EASE_OUT);
  squashAt(B.pressEnd, 1);
  keyAt(B.stomp, 'linear');
  squashAt(B.stomp + 0.08, 0.72, EASE_OUT);
  for (const t of CHEER_HOPS) {
    keyAt(t);
    squashAt(t + 0.12, 0.82);
    squashAt(t + 0.36, 0.82, 'linear');
    squashAt(t + 0.44, 0.72, EASE_OUT);
  }
  keyAt(B.hopOff);
  squashAt(B.hopOff + 0.15, 1.08, EASE_OUT);
  squashAt(B.hopOff + 0.3, 1);
  keyAt(B.kick, 'linear');
  if (button) {
    arc(B.kick, B.slotted, [restCenter[0], restBottom], 60 * s, dir * 360);
    const home = spun + dir * 360;
    launcher.set(B.slotted, [restCenter[0], restBottom, home, 1], 'linear');
    launcher.set(
      B.slotted + 0.06,
      [restCenter[0], restBottom, home, 0.92],
      EASE_OUT,
    );
    launcher.set(B.restore, [restCenter[0], restBottom, home, 1]);
  } else {
    arc(B.kick, B.slotted, sackMouth, 40 * s, dir * 360);
  }
  const buttonAt = (t: number) => {
    const [x, bottomY, rotation, scaleY] = launcher.value(t);
    return {
      center: [x, bottomY - (bh * scaleY) / 2] as Point,
      rotation,
      scaleY,
    };
  };

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

  /* Launch times: the rack fires from its far end toward him. */
  const launches = Array.from({ length: launched }, (_, i) =>
    lerp(B.firstLaunch, B.lastLaunch, launched > 1 ? i / (launched - 1) : 0),
  );
  /* Bursts spread over the sky above the composer; nearest pairs with nearest. */
  const skyTop = Math.max(28, height * 0.07);
  const skyBottom = Math.max(skyTop + 60, floor - 150);
  const radius = isMobile ? 52 : 78;
  const rackX = rim.rack.slice(0, launched).map(X);
  const rocketsByX = [...rackX.keys()].sort((a, b) => rackX[a] - rackX[b]);
  const bursts: ElfBurst[] = Array.from({ length: launched }, () => ({
    center: [0, 0],
    t: 0,
    sparks: sparkCounts.burst,
    radius,
  }));
  const burstOf: number[] = [];
  rocketsByX.forEach((rocket, slot) => {
    burstOf[rocket] = slot;
    bursts[slot] = {
      center: [
        clamp(
          lerp(width * 0.12, width * 0.88, (slot + 0.5) / launched),
          radius + 8,
          width - radius - 8,
        ),
        lerp(skyTop, skyBottom, BURST_HEIGHTS[rocket % BURST_HEIGHTS.length]),
      ],
      t: launches[rocket] + ROCKET_FLIGHT_S,
      sparks: sparkCounts.burst,
      radius,
    };
  });
  bursts.push({
    center: [
      clamp(exitX, radius * 1.35 + 8, width - radius * 1.35 - 8),
      Math.max(skyTop, height * 0.14),
    ],
    t: B.finale,
    sparks: sparkCounts.finale,
    radius: radius * 1.35,
  });

  bursts.forEach(({ center, t, sparks, radius: reach }, index) => {
    const isFinale = index === bursts.length - 1;
    const pair = isFinale
      ? FINALE_COLORS
      : BURST_COLORS[index % BURST_COLORS.length];
    const shapes: SnowmanShape[] = [
      group(
        'flash-glow',
        flashArt(pair[0]),
        {},
        {
          ...identity(),
          p: fixed(center),
          s: toLottie(
            new Track()
              .set(t, [0, 0], EASE_OUT)
              .set(t + 0.3, [reach * 38, reach * 38]),
          ),
          o: toLottie(new Track().set(t, 30, EASE_OUT).set(t + 0.4, 0)),
        },
      ),
    ];
    /* Each streak flies out and slows; one shared channel adds the fall, and
       the layer fades the whole burst. */
    const streaks: SnowmanShape[] = [];
    for (let k = 0; k < sparks; k++) {
      const angle = (360 * k) / sparks + (index % 2) * (180 / sparks);
      const distance = reach * (k % 2 ? 0.82 : 1.08);
      const [ux, uy] = rotate([1, 0], angle);
      const out: Point = [center[0] + ux * distance, center[1] + uy * distance];
      streaks.push(
        group(
          `spark-${k}`,
          sparkArt(pair[k % 2], isMobile ? 2.8 : 3.6),
          {},
          {
            ...identity(),
            p: toLottie(
              new Track().set(t, center, SPARK_OUT).set(t + BURST_LIFE_S, out),
            ),
            r: fixed(angle),
          },
        ),
      );
    }
    shapes.unshift(
      group(
        'sparks',
        streaks,
        {},
        {
          ...identity(),
          p: toLottie(
            new Track()
              .set(t + 0.3, [0, 0], EASE_IN)
              .set(t + BURST_LIFE_S, [0, 24]),
          ),
        },
      ),
    );
    layer(
      isFinale ? 'finale' : `burst-${index}`,
      {
        ...identity(),
        o: toLottie(
          new Track().set(t + 0.7, 100, EASE_IN).set(t + BURST_LIFE_S, 0),
        ),
      },
      shapes,
      { ip: t - 0.05, op: Math.min(END, t + BURST_LIFE_S + 0.05) },
    );
  });

  /* Launch smoke, one puff per launched rocket. */
  layer(
    'smoke',
    identity(),
    launches.map((t, i) =>
      group(
        `puff-${i}`,
        smokeArt(),
        {},
        {
          ...identity(),
          p: fixed([rackX[i], floor - 4 * s]),
          s: toLottie(
            new Track([0, 0])
              .set(t, [0, 0], EASE_OUT)
              .set(t + 0.6, [1200 * s, 700 * s]),
          ),
          o: toLottie(
            new Track([0])
              .set(t - 0.001, 0, 'hold')
              .set(t, 80, EASE_OUT)
              .set(t + 0.7, 0),
          ),
        },
      ),
    ),
    { ip: B.firstLaunch - 0.1, op: B.lastLaunch + 0.9 },
  );

  /* The sack: on his back, set down, picked up again at the exit. */
  const sackPos = new Track();
  const carriedSack = (t: number) => elfWorld(t, SACK_ON_BACK);
  sackPos.sample(0, B.sackDown, STEP, carriedSack);
  sackPos.set(B.sackDown + 0.15, sackWorld, EASE_OUT);
  const exitFrom = pos.value(B.turnToExit + 0.05)[0];
  const pickup = lerp(
    B.turnToExit + 0.05,
    B.exitEnd,
    clamp((rim.sack - exitFrom) / (exitA - exitFrom), 0, 1),
  );
  sackPos.set(pickup, sackWorld, 'linear');
  sackPos.sample(pickup + 0.12, B.exitEnd, STEP, carriedSack);
  sackPos.prune(0.6);
  layer(
    'sack',
    {
      ...identity(),
      p: toLottie(sackPos),
      s: fixed([dir * s * 100, s * 100]),
      o: toLottie(fade(0, B.exitEnd + 0.2, 0.35, 0.3)),
    },
    sackArt(),
  );

  /* Rockets: from the hand to the rack, then to their bursts; the last is the dud. */
  for (let i = 0; i < rocketCount; i++) {
    const isDud = i === rocketCount - 1;
    const pivot = new Track();
    const angle = new Track([0]);
    const restPivot: Point = [X(rim.rack[i]), floor + ROCKET.pivot[1] * s];
    const release = releases[i];
    const inHand = (t: number) => add(handAt(t), [0, -6 * s]);
    pivot.sample(grabs[i], release, PROP_STEP, inHand);
    const from = inHand(release);
    const settled = release + 0.5;
    const spin = screenFacing(release) * -360;
    pivot.sample(release, settled, PROP_STEP, (t) => {
      const p = (t - release) / (settled - release);
      return [
        lerp(from[0], restPivot[0], p),
        arcY(from[1], restPivot[1], 40 * s, p),
      ];
    });
    angle.set(release, 0).set(settled, spin, 'linear');
    angle.set(settled + 0.1, spin + 10).set(settled + 0.22, spin - 5);
    angle.set(settled + 0.34, spin);
    const flame = new Track([0]);
    const shapes: SnowmanShape[] = [];
    let flameFrom: number;
    let flameTo: number;
    let op: number;
    if (isDud) {
      /* A fizzle while he peers, then the ride. */
      pivot.set(B.dudFires, restPivot, 'linear');
      pivot.sample(B.dudFires, B.dudExit, PROP_STEP, dudPivotAt);
      angle.set(B.dudFires, spin, 'linear');
      angle.sample(B.dudFires + 0.02, B.dudExit, PROP_STEP, (t) => [
        spin + dudAngleAt(t),
      ]);
      setHeld(flame, B.peer - 0.2, 100);
      setHeld(flame, B.peer - 0.05, 0);
      setHeld(flame, B.dudFires, 100);
      flameFrom = B.peer - 0.2;
      flameTo = B.dudExit;
      op = B.dudExit;
    } else {
      const burst = bursts[burstOf[i]];
      const t0 = launches[i];
      const t1 = t0 + ROCKET_FLIGHT_S;
      const lift: Point[] = [
        restPivot,
        [
          lerp(restPivot[0], burst.center[0], 0.15),
          lerp(burst.center[1], restPivot[1], 0.45),
        ],
        burst.center,
      ];
      const progress = (t: number) =>
        bezierProgress(FLIGHT, (t - t0) / (t1 - t0));
      pivot.set(t0, restPivot, 'linear');
      pivot.sample(t0, t1, PROP_STEP, (t) => quad(lift, progress(t)));
      angle.set(t0, spin, 'linear');
      angle.sample(t0 + 0.02, t1, PROP_STEP, (t) => [
        spin + quadHeading(lift, Math.max(0.02, progress(t))),
      ]);
      setHeld(flame, t0, 100);
      flameFrom = t0;
      flameTo = t1;
      op = t1 + 0.02;
      shapes.push(
        group(
          'fuse',
          fuseSparkArt(),
          {},
          {
            ...identity(),
            p: fixed(ROCKET.nozzle),
            s: toLottie(
              flicker(B.ignite, t0, [70, 70], [110, 110], [0, 0]).set(
                t0,
                [0, 0],
                'hold',
              ),
            ),
          },
        ),
      );
    }
    pivot.prune(0.6);
    angle.prune(1.2);
    shapes.push(
      group(
        'flame',
        flameArt(),
        {},
        {
          ...identity(),
          p: fixed(ROCKET.nozzle),
          s: toLottie(
            flicker(flameFrom, flameTo, [80, 120], [110, 150], [100, 100]),
          ),
          o: toLottie(flame),
        },
      ),
      ...rocketArt(ROCKET_COLORS[i % ROCKET_COLORS.length]),
    );
    layer(
      isDud ? 'dud' : `rocket-${i}`,
      {
        ...identity(ROCKET.pivot),
        p: toLottie(pivot),
        r: toLottie(angle),
        s: fixed([s * 100, s * 100]),
      },
      shapes,
      { ip: grabs[i], op },
    );
  }

  /* The drawn detonator, when no send button qualified. */
  if (!button) {
    const box = new Track();
    const rod = new Track();
    const spin = new Track();
    for (const { t, v, ease } of launcher.keys) {
      box.set(t, [v[0], v[1] - bh / 2], ease);
      rod.set(t, [0, (1 - v[3]) * DETONATOR_SIZE.height], ease);
      spin.set(t, v[2], ease);
    }
    layer(
      'detonator',
      {
        ...identity([0, -DETONATOR_SIZE.height / 2]),
        p: toLottie(box),
        r: toLottie(spin),
        s: fixed([s * 100, s * 100]),
      },
      [
        group('plunger', plungerArt(), {}, { ...identity(), p: toLottie(rod) }),
        ...detonatorBoxArt(),
      ],
      { ip: B.yank, op: B.slotted },
    );
  }

  /* The elf: the gift-wrapping master, re-posed; the cane hangs from his palm. */
  const art = JSON.parse(JSON.stringify(elves.master)) as ArtShape;
  const joint = (
    name: string,
    key: keyof SnowmanTransform,
    value: SnowmanProperty,
  ) => {
    const transform = transformOf(findGroup(art, name));
    if (transform) transform[key] = value;
  };
  upper.prune(0.5);
  fore.prune(0.5);
  joint('upper-arm', 'r', toLottie(upper));
  joint('forearm', 'r', toLottie(fore));
  joint('head', 'r', toLottie(headTilt));
  joint('cap', 'o', toLottie(capShown));
  joint('leg-0', 'r', toLottie(legBack));
  joint('leg-1', 'r', toLottie(legFront));
  for (const [name, track] of Object.entries(faces))
    joint(name, 'o', toLottie(track));
  const caneTurn =
    ELF_FISH_POSE.arm[0] + ELF_FISH_POSE.arm[1] + ELF_FISH_POSE.lean;
  if (button) {
    /* Hanging straight down in the fishing pose; drawn under the mitten. */
    const forearm = findGroup(art, 'forearm');
    const caneShown = new Track([0]);
    setHeld(caneShown, B.caneOut - 0.2, 100);
    setHeld(caneShown, B.caneAway, 0);
    forearm?.it?.splice(
      forearm.it.length - 1,
      0,
      group(
        'cane',
        caneArt(caneLength),
        {},
        {
          ...identity(),
          p: fixed([ELF_RIG.palm.x, 0]),
          r: fixed(-caneTurn),
          o: toLottie(caneShown),
        },
      ),
    );
  }
  pos.prune(0.5);
  layer(
    'elf',
    {
      ...identity(),
      p: toLottie(pos, (v) => [X(v[0]), floor + v[1]]),
      s: fixed([dir * s * 100, s * 100]),
      o: toLottie(fade(0, B.exitEnd + 0.2, 0.35, 0.3)),
    },
    [
      group(
        'facing',
        [
          group(
            'pose',
            [art],
            {},
            {
              ...identity(),
              r: toLottie(lean),
              s: toLottie(squash),
            },
          ),
        ],
        {},
        { ...identity(), s: toLottie(face, (v) => [v[0] * 100, 100]) },
      ),
    ],
  );

  /* The dud draws over him: he peers into it and then hangs below it. */
  const dudAt = layers.findIndex(({ nm }) => nm === 'dud');
  layers.push(...layers.splice(dudAt, 1));
  layers.forEach((item, index) => (item.ind = index + 1));

  /* The hat, while it is off his head; drawn in the elf's frame. */
  const hatArt = JSON.parse(
    JSON.stringify(findGroup(elves.master as unknown as ArtShape, 'cap')),
  ) as ArtShape;
  const hatTransform = transformOf(hatArt);
  if (hatTransform) Object.assign(hatTransform, identity());
  layer(
    'hat',
    {
      ...identity(HAT_PIVOT),
      p: toLottie(hatPos),
      r: toLottie(hatRot),
      s: fixed([screenFacing(B.dudFires) * s * 100, s * 100]),
    },
    [hatArt],
    { ip: B.dudFires, op: B.hatOn },
  );

  /* ---- Button copy frames (DOM), on the same clock ---- */
  const buttonFrames: ElfButtonFrame[] = [];
  if (button) {
    /* The snapshot helper fades the original out over 1 % of the playback
       before `hideAt` and back over 4 % after `restoreAt`; the copy covers
       both fades in place, so the swap is invisible. */
    const showFrom = B.hook - 0.3;
    const fadeStart = B.restore + 0.04 * END + 0.05;
    const times = [
      0,
      showFrom - 0.001,
      showFrom,
      ...launcher.keys.map((key) => key.t),
      fadeStart,
      fadeStart + 0.05,
      END,
    ]
      .filter((t, i, all) => t >= 0 && t <= END && all.indexOf(t) === i)
      .sort((a, b) => a - b);
    for (const t of times) {
      const { center, rotation, scaleY } = buttonAt(t);
      const key = launcher.keys.find((k) => Math.abs(k.t - t) < 1e-9);
      const isMoving = t >= B.hook && t < B.restore;
      buttonFrames.push({
        offset: t / END,
        dx: center[0] - restCenter[0],
        dy: center[1] - restCenter[1],
        rotate: rotation,
        scaleY,
        opacity: t >= showFrom && t <= fadeStart ? 1 : 0,
        easing: isMoving && key ? cssEasing(key.ease) : 'step-end',
      });
    }
  }

  const probe = (t: number): ElfFireworksProbe => {
    const { center, scaleY } = buttonAt(t);
    let hook: Point | null = null;
    if (button && t >= B.caneOut - 0.2 && t < B.caneAway) {
      const angle = upper.at(t) + fore.at(t);
      const tip = rotate(
        [ELF_FISH_POSE.hookOffset, caneLength],
        angle - caneTurn,
      );
      hook = elfWorld(t, add(palmAt(t), tip));
    }
    return {
      feet: elfWorld(t, [0, 0]),
      hand: handAt(t),
      hook,
      button: { center, scaleY },
      buttonTop: [center[0], center[1] - (bh * scaleY) / 2],
      dudGrip: dudGripAt(t),
      hat: t >= B.dudFires && t < B.hatOn ? point(hatPos.value(t)) : null,
    };
  };

  return {
    targets,
    animationData: {
      v: '5.13.0',
      fr: FPS,
      ip: 0,
      op: END * FPS,
      w: width,
      h: height,
      nm: 'Elf fireworks',
      ddd: 0,
      assets: [],
      layers: layers.reverse(),
    },
    buttonFrames,
    buttonHideAt: B.hook / END,
    buttonRestoreAt: B.restore / END,
    launches,
    bursts,
    probe,
  };
};
