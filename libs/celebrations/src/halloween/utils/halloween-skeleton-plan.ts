import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import type {
  SkeletonGreetingWord,
  SkeletonTargets,
} from './halloween-skeleton-targets';

/** Includes both skeletons dropping below the viewport. */
export const SKELETON_MS = 11500;
export const SKELETON_DEADLINE_MS = SKELETON_MS + 500;
/** Maximum precomputed frames in any one track. */
export const SKELETON_FRAME_LIMIT = 80;
/** Showman 9 + partner 8 + free skull 3 + composer outline 1 + stolen word 1. */
export const SKELETON_ANIMATION_LIMIT = 22;
/** Raised arm direction used to grab the greeting word. */
export const SKELETON_GRAB_ARM = -75;
/** Smallest hop, in art units, when the word is within standing reach. */
export const SKELETON_MIN_HOP = 12;
/** Forward arm direction while running off with the word. */
export const SKELETON_CARRY_ARM = -12;
/** The stolen word hides at the grab contact. */
export const SKELETON_WORD_HIDE = 10450;
/** The thrown-back word lands in place and the original reappears. */
export const SKELETON_WORD_RESTORE = 11400;

/** Independently animated groups of the skeleton artwork. */
export enum SkeletonPart {
  Body = 'body',
  Skull = 'skull',
  Face = 'face',
  ArmLeft = 'arm-left',
  ArmRight = 'arm-right',
  LegLeft = 'leg-left',
  LegRight = 'leg-right',
}
/** Moments where one actor or prop visibly causes another to move. */
export enum SkeletonContactKind {
  Landing = 'landing',
  Launch = 'launch',
  Impact = 'impact',
  Catch = 'catch',
  Place = 'place',
  Grab = 'grab',
}

/** Pivots and contact points in the 100×170 skeleton viewBox. */
export const SKELETON_ART = {
  width: 100,
  height: 170,
  feetY: 158,
  shoulder: { x: 64, y: 58 },
  hand: { x: 78, y: 96 },
  skull: { x: 50, y: 25 },
  skullRadius: 20,
  /** Side of the free skull's square viewBox, centred on `skull`. */
  skullBox: 44,
} as const;
const ARM =
  Math.hypot(
    SKELETON_ART.hand.x - SKELETON_ART.shoulder.x,
    SKELETON_ART.hand.y - SKELETON_ART.shoulder.y,
  ) || 1;
const deg = (radians: number) => (radians * 180) / Math.PI;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
/** Direction of the resting right arm from its shoulder. */
export const SKELETON_ARM_REST = deg(
  Math.atan2(
    SKELETON_ART.hand.y - SKELETON_ART.shoulder.y,
    SKELETON_ART.hand.x - SKELETON_ART.shoulder.x,
  ),
);
/* The hand sits on the body's axis, so mirroring the figure cannot move it. */
const ARM_AXIS = deg(Math.acos((50 - SKELETON_ART.shoulder.x) / ARM));

export interface SkeletonPoint {
  x: number;
  y: number;
}

/**
 * Scene position of the right hand. `armDeg` is the arm's direction in the
 * unmirrored drawing; the emitted rotation is `armDeg - SKELETON_ARM_REST`.
 */
export const skeletonHandPoint = (
  root: SkeletonPoint,
  scale: number,
  facing: number,
  bodyDy: number,
  armDeg: number,
): SkeletonPoint => {
  const x = SKELETON_ART.shoulder.x + ARM * Math.cos(rad(armDeg));
  const y = SKELETON_ART.shoulder.y + bodyDy + ARM * Math.sin(rad(armDeg));
  return {
    x: root.x + scale * (facing < 0 ? SKELETON_ART.width - x : x),
    y: root.y + scale * y,
  };
};

export interface SkeletonContact extends SkeletonPoint {
  time: number;
  kind: SkeletonContactKind;
}
/** Hand and skull centre while the partner holds it; evidence for tests. */
export interface SkeletonHold {
  time: number;
  hand: SkeletonPoint;
  skull: SkeletonPoint;
}
export interface SkeletonActorTracks {
  scale: number;
  root: Keyframe[];
  facing: Keyframe[];
  parts: Partial<Record<SkeletonPart, Keyframe[]>>;
}
/** Plan-space rectangle of the decorative composer outline. */
export interface SkeletonLedge {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius?: string;
}
/** Immutable choreography; RTL mirrors the whole artwork layer. */
export interface SkeletonPlan {
  targets: SkeletonTargets;
  anchors: CelebrationSnapshotTarget[];
  ledge?: SkeletonLedge;
  stageY: number;
  skullSize: number;
  showman: SkeletonActorTracks;
  partner: SkeletonActorTracks;
  skull: { root: Keyframe[]; turn: Keyframe[]; face: Keyframe[] };
  outline: Keyframe[];
  contacts: SkeletonContact[];
  holds: SkeletonHold[];
  /** The greeting word the partner steals, when it is reachable. */
  word?: SkeletonWordPlan;
}

/** Decorative copy of the greeting's last word and its restoration schedule. */
export interface SkeletonWordPlan {
  target: SkeletonGreetingWord;
  width: number;
  height: number;
  frames: Keyframe[];
  holds: SkeletonHold[];
  hideAt: number;
  restoreAt: number;
}

type Key = [time: number, ...values: number[]];
interface Eased {
  key: Key;
  easing: string;
}
const round = (n: number) => Math.round(n * 100) / 100;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(n, max));
const smooth = 'cubic-bezier(0.45, 0, 0.55, 1)';
const snappy = 'cubic-bezier(0.2, 0.9, 0.3, 1)';
const easeOut = 'cubic-bezier(0.22, 1, 0.36, 1)';
const easeIn = 'cubic-bezier(0.55, 0, 1, 0.45)';
const step = 'steps(1, end)';

/** Collects keys; equal times keep insertion order for instant switches. */
class Track {
  readonly keys: Eased[] = [];
  add(easing: string, ...keys: Key[]) {
    keys.forEach((key) => this.keys.push({ key, easing }));
    return this;
  }
  frames(format: (values: number[]) => Keyframe): Keyframe[] {
    return [...this.keys]
      .sort((a, b) => a.key[0] - b.key[0])
      .map(({ key: [time, ...values], easing }) => ({
        ...format(values),
        offset: time / SKELETON_MS,
        easing,
      }));
  }
  /** Linear interpolation, valid wherever the track is authored linearly. */
  sample(time: number): number[] {
    const sorted = [...this.keys].sort((a, b) => a.key[0] - b.key[0]);
    let previous = sorted[0].key;
    for (const { key } of sorted) {
      if (key[0] > time) {
        const span = key[0] - previous[0];
        const t = span ? (time - previous[0]) / span : 1;
        return previous.slice(1).map((v, i) => mix(v, key[i + 1], t));
      }
      previous = key;
    }
    return previous.slice(1);
  }
}
const translate = ([x, y, opacity = 1]: number[]): Keyframe => ({
  transform: `translate(${round(x)}px, ${round(y)}px)`,
  opacity,
});
const rotate = ([angle]: number[]): Keyframe => ({
  transform: `rotate(${round(angle)}deg)`,
});
const body = ([dy, sx = 1, sy = 1]: number[]): Keyframe => ({
  transform: `translate(0px, ${round(dy)}px) scale(${sx}, ${sy})`,
});
const flip = ([value]: number[]): Keyframe => ({
  transform: `scaleX(${value})`,
});
const fade = ([value]: number[]): Keyframe => ({ opacity: value });

/** Parabolic hop sampled into linear keys. */
const arc = (
  track: Track,
  from: SkeletonPoint,
  to: SkeletonPoint,
  start: number,
  end: number,
  lift: number,
  extra: (t: number) => number[] = () => [],
) => {
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    track.add('linear', [
      mix(start, end, t),
      mix(from.x, to.x, t),
      mix(from.y, to.y, t) - 4 * lift * t * (1 - t),
      ...extra(t),
    ]);
  }
};
/** Alternating steps; `stride` is the outward swing in degrees. */
const walk = (
  legs: [Track, Track],
  begin: number,
  end: number,
  pace: number,
  stride = 13,
) => {
  const cycles = Math.max(1, Math.round((end - begin) / pace));
  legs.forEach((leg, side) => {
    leg.add(smooth, [begin, 0]);
    for (let n = 0; n < cycles; n++)
      leg.add(
        smooth,
        [mix(begin, end, (n + 0.25) / cycles), (side ? -1 : 1) * stride],
        [mix(begin, end, (n + 0.75) / cycles), (side ? 1 : -1) * stride],
      );
    leg.add(smooth, [end, 0]);
  });
};

/** Deterministic finite choreography; all geometry work precedes playback. */
export const buildSkeletonPlan = (
  targets: SkeletonTargets,
  mobile: boolean,
): SkeletonPlan => {
  const { width, height, rtl, composer } = targets;
  const s = mobile ? 0.56 : 0.72,
    sB = s * 0.92,
    rs = SKELETON_ART.skullRadius * s;
  const box = composer && {
    left: rtl ? width - composer.rect.right : composer.rect.left,
    right: rtl ? width - composer.rect.left : composer.rect.right,
    top: composer.rect.top,
    height: composer.rect.height,
  };
  const ledge =
    box && box.right - box.left >= (mobile ? 200 : 220) && box.top >= 150
      ? box
      : undefined;
  const stageY = ledge ? ledge.top : height - 6;
  const right = ledge ? ledge.right - 8 : width - 24;
  const left = Math.max(
    ledge ? ledge.left + 8 : 24,
    right - (mobile ? 320 : 460),
  );
  const w = right - left;
  const below = height + 20;
  const yA = stageY - SKELETON_ART.feetY * s,
    yB = stageY - SKELETON_ART.feetY * sB;
  const aX = left + 0.2 * w - 50 * s,
    bX = left + 0.52 * w - 50 * sB;
  const aPlace = aX + 8,
    aAfter = aX + 14;
  const contacts: SkeletonContact[] = [];
  const contact = (
    time: number,
    kind: SkeletonContactKind,
    point: SkeletonPoint,
  ) => contacts.push({ time, kind, ...point });

  /* ---- Showman: dances, loses the skull, gropes, is fixed. ---- */
  const aRoot = new Track(),
    aFacing = new Track(),
    aBody = new Track(),
    aSkull = new Track(),
    aFace = new Track(),
    aArmL = new Track(),
    aArmR = new Track(),
    aLegL = new Track(),
    aLegR = new Track();
  /* ---- Partner: dances, catches, carries and places the skull. ---- */
  const bRoot = new Track(),
    bFacing = new Track(),
    bBody = new Track(),
    bSkull = new Track(),
    bArmL = new Track(),
    bArmR = new Track(),
    bLegL = new Track(),
    bLegR = new Track();

  aRoot.add('linear', [0, aX, below, 0], [300, aX, below, 1]);
  arc(aRoot, { x: aX, y: below }, { x: aX, y: yA }, 300, 1000, 130 * s);
  bRoot.add('linear', [0, bX, below, 0], [450, bX, below, 1]);
  arc(bRoot, { x: bX, y: below }, { x: bX, y: yB }, 450, 1150, 130 * sB);
  contact(1000, SkeletonContactKind.Landing, { x: aX + 50 * s, y: stageY });
  contact(1150, SkeletonContactKind.Landing, { x: bX + 50 * sB, y: stageY });
  aBody.add('linear', [0, 0], [900, 0, 0.94, 1.08], [1000, 0, 0.94, 1.08]);
  aBody.add(easeOut, [1000, 0, 1.08, 0.9], [1170, 0, 0.97, 1.04]);
  aBody.add(smooth, [1320, 0]);
  bBody.add('linear', [0, 0], [1050, 0, 0.94, 1.08], [1150, 0, 0.94, 1.08]);
  bBody.add(easeOut, [1150, 0, 1.1, 0.88], [1300, 0, 0.96, 1.05]);
  bBody.add(smooth, [1440, 0]);
  [aLegL, aLegR, bLegL, bLegR].forEach((leg, i) =>
    leg.add(
      smooth,
      [0, 0],
      [i < 2 ? 1000 : 1150, i % 2 ? -9 : 9],
      [i < 2 ? 1300 : 1420, 0],
    ),
  );
  [aArmL, aArmR, bArmL, bArmR].forEach((arm, i) =>
    arm.add(
      smooth,
      [0, 0],
      [i < 2 ? 850 : 1000, i % 2 ? -35 : 35],
      [i < 2 ? 1250 : 1400, 0],
    ),
  );
  aSkull.add('linear', [0, 0, 1, 1]);
  bSkull.add('linear', [0, 0]);

  /* Eight-beat jig: the showman sways wide, the partner hits beats sharply. */
  aRoot.add(
    smooth,
    [1400, aX, yA],
    [2200, aX + 8, yA],
    [3000, aX, yA],
    [3800, aX + 8, yA],
  );
  bRoot.add(
    snappy,
    [1440, bX, yB],
    [2200, bX - 8, yB],
    [3000, bX, yB],
    [3800, bX - 8, yB],
  );
  for (let n = 0; n < 8; n++) {
    const t = 1400 + n * 400,
      even = n % 2 === 0;
    aBody.add(smooth, [t, 0], [t + 200, -4]);
    bBody.add(snappy, [t + 40, 0], [t + 200, -5]);
    aSkull.add(smooth, [t, 0, 1, 1], [t + 200, even ? 6 : -6, 1, 1]);
    bSkull.add(snappy, [t + 40, 0], [t + 200, even ? -8 : 8]);
    (even ? aLegL : aLegR).add(
      smooth,
      [t, 0],
      [t + 150, even ? 18 : -18],
      [t + 350, 0],
    );
    (even ? bLegR : bLegL).add(
      snappy,
      [t + 40, 0],
      [t + 170, even ? -20 : 20],
      [t + 360, 0],
    );
    aArmL.add(smooth, [t + 200, even ? 110 : 20]);
    aArmR.add(smooth, [t + 200, even ? -20 : -110]);
    bArmL.add(snappy, [t + 200, even ? 45 : -10]);
    bArmR.add(snappy, [t + 200, even ? 10 : -45]);
  }
  aRoot.add(smooth, [4600, aX, yA]);
  bRoot.add('linear', [4600, bX, yB]);
  [aArmL, aArmR, bArmL, bArmR].forEach((arm) => arm.add(smooth, [4600, 0]));
  aBody.add(smooth, [4600, 0]);
  bBody.add(smooth, [4600, 0]);
  bSkull.add(smooth, [4600, 0]);

  /* Wind-up, over-eager nod, snap: the skull leaves from rest pose. */
  aBody.add(smooth, [4850, 4], [5050, -2]);
  aBody.add(easeOut, [5200, 0], [5300, -5]);
  aBody.add(smooth, [5500, 0]);
  aSkull.add(smooth, [4600, 0, 1, 1], [4850, -18, 1, 1]);
  aSkull.add(easeIn, [5050, 26, 1, 1]);
  aSkull.add('linear', [5200, 0, 1, 1], [5200, 0, 1, 0], [9400, 0, 1, 0]);
  aFace.add(step, [0, 1], [5200, 0], [9950, 1], [SKELETON_MS, 1]);
  const launch = { x: aX + 50 * s, y: yA + SKELETON_ART.skull.y * s };
  contact(5200, SkeletonContactKind.Launch, launch);

  /* Headless panic, then groping the wrong way and back. */
  aArmL.add(easeOut, [5200, 0], [5350, 140]);
  aArmR.add(easeOut, [5200, 0], [5350, -140]);
  aArmL.add(smooth, [5650, 140], [5900, 80]);
  aArmR.add(smooth, [5650, -140], [5900, -80]);
  for (let t = 6200, n = 0; t < 9200; t += 300, n++) {
    aArmL.add(smooth, [t, n % 2 ? 80 : 92]);
    aArmR.add(smooth, [t, n % 2 ? -92 : -80]);
  }
  aArmL.add(smooth, [9300, 80], [9550, 0]);
  aArmR.add(smooth, [9300, -80], [9550, 0]);
  aFacing.add(step, [0, 1], [5700, -1], [7000, 1], [SKELETON_MS, 1]);
  aRoot.add(
    smooth,
    [5900, aX, yA],
    [6700, aX - 12, yA],
    [7100, aX - 12, yA],
    [8200, aPlace, yA],
  );
  aRoot.add('linear', [9400, aPlace, yA]);
  walk([aLegL, aLegR], 5950, 6700, 360, 11);
  walk([aLegL, aLegR], 7150, 8200, 360, 11);
  aBody.add('linear', [8600, 0], [9400, 0]);

  /* ---- Free skull: flight over the partner, bounce, roll, teeter. ---- */
  const skull = new Track(),
    turn = new Track(),
    freeFace = new Track();
  const land = { x: left + 0.72 * w, y: stageY - rs };
  const bounce = { x: land.x + 0.05 * w, y: land.y };
  const corner = {
    x: ledge ? ledge.right - rs * 0.35 : right,
    y: land.y,
  };
  const roll = deg((corner.x - bounce.x) / rs);
  skull.add('linear', [0, launch.x, launch.y, 0, 0]);
  skull.add('linear', [5200, launch.x, launch.y, 0, 0]);
  arc(skull, launch, land, 5200, 5900, 120 * s, (t) => [200 * t, 1]);
  contact(5900, SkeletonContactKind.Impact, { x: land.x, y: stageY });
  arc(skull, land, bounce, 5900, 6250, 16 * s, (t) => [200 + 40 * t, 1]);
  contact(6250, SkeletonContactKind.Impact, { x: bounce.x, y: stageY });
  for (let k = 1; k <= 8; k++) {
    const t = k / 8,
      p = 1 - (1 - t) ** 2;
    skull.add('linear', [
      mix(6250, 7000, t),
      mix(bounce.x, corner.x, p),
      corner.y,
      240 + roll * p,
      1,
    ]);
  }
  const rest = 240 + roll,
    tip = ledge ? 3 : 0;
  skull.add(
    smooth,
    [7150, corner.x + tip * 0.5, corner.y, rest + 10, 1],
    [7350, corner.x - tip * 0.3, corner.y, rest - 6, 1],
    [7550, corner.x + tip * 0.8, corner.y + tip * 0.3, rest + 14, 1],
    [7750, corner.x + tip, corner.y + tip * 0.6, rest + 20, 1],
  );
  turn.add(smooth, [0, 1], [5450, 1], [5550, 0], [5650, 1], [SKELETON_MS, 1]);
  freeFace.add(step, [0, 1], [5550, 0], [SKELETON_MS, 0]);

  /* ---- Partner: startle, watch, lunge, catch, carry, place. ---- */
  const caught = {
    x: corner.x + tip,
    y: corner.y + tip,
  };
  const reach = (
    hand: SkeletonPoint,
    rootY: number,
    dy: number,
    facing: number,
    armDeg?: number,
  ) => {
    const direction =
      armDeg ??
      deg(
        Math.asin(
          clamp(
            (hand.y - rootY - sB * (SKELETON_ART.shoulder.y + dy)) / (sB * ARM),
            -1,
            1,
          ),
        ),
      );
    const probe = skeletonHandPoint(
      { x: 0, y: rootY },
      sB,
      facing,
      dy,
      direction,
    );
    return { x: hand.x - probe.x, y: rootY + hand.y - probe.y, direction };
  };
  const catchPose = reach({ x: caught.x, y: caught.y - rs }, yB, 28, 1);
  const target = {
    x: aPlace + 50 * s,
    y: yA + SKELETON_ART.skull.y * s,
  };
  const placeArm = -30;
  const placePose = reach(
    { x: target.x, y: target.y - rs },
    yB,
    0,
    -1,
    placeArm,
  );
  contact(7900, SkeletonContactKind.Catch, caught);
  contact(9400, SkeletonContactKind.Place, target);

  bBody.add(smooth, [5300, 0]);
  bBody.add(easeOut, [5420, 12]);
  bBody.add(smooth, [5750, 0]);
  bArmL.add(easeOut, [5300, 0], [5420, 120]);
  bArmR.add(easeOut, [5300, 0], [5420, -120]);
  bArmL.add(smooth, [5900, 0]);
  bArmR.add(smooth, [5900, 0]);
  bSkull.add(smooth, [5300, 0], [5450, -10], [6200, 0], [6500, 12]);
  bSkull.add(smooth, [7200, 12], [7450, 0]);
  bFacing.add(step, [0, -1], [6300, 1], [8300, -1], [SKELETON_MS, -1]);
  bBody.add(smooth, [7200, 0], [7400, 10]);
  bBody.add(easeOut, [7500, -4]);
  bBody.add(smooth, [7780, 0]);
  bBody.add(
    'linear',
    [7880, 28],
    [7900, 28],
    [8250, 0],
    [9050, 0],
    [9200, 8],
    [9400, 0],
  );
  bBody.add(easeOut, [9650, 0, 1.06, 0.92]);
  bBody.add(smooth, [9800, 0]);
  bRoot.add('linear', [7450, bX, yB]);
  arc(bRoot, { x: bX, y: yB }, { x: catchPose.x, y: yB }, 7450, 7850, 22 * sB);
  const hop = placePose.y;
  bRoot.add(
    'linear',
    [7900, catchPose.x, yB],
    [8300, catchPose.x, yB],
    [9050, placePose.x, yB],
    [9200, placePose.x, yB],
    [9300, placePose.x, mix(yB, hop, 0.8)],
    [9400, placePose.x, hop],
  );
  bRoot.add(easeIn, [9400, placePose.x, hop]);
  bRoot.add('linear', [9650, placePose.x, yB]);
  /* A step back gives the celebration room; bodies no longer overlap. */
  const backX = placePose.x + 36 * sB;
  bRoot.add(smooth, [9800, placePose.x, yB], [10050, backX, yB]);
  walk([bLegL, bLegR], 9800, 10050, 250, 12);
  contact(7850, SkeletonContactKind.Landing, {
    x: catchPose.x + 50 * sB,
    y: stageY,
  });
  contact(9650, SkeletonContactKind.Landing, {
    x: placePose.x + 50 * sB,
    y: stageY,
  });
  bArmR.add(
    'linear',
    [7700, 0],
    [7850, catchPose.direction - SKELETON_ARM_REST],
    [7900, catchPose.direction - SKELETON_ARM_REST],
    [8250, ARM_AXIS - SKELETON_ARM_REST],
    [9200, ARM_AXIS - SKELETON_ARM_REST],
    [9400, placeArm - SKELETON_ARM_REST],
  );
  bArmR.add(smooth, [9650, 0]);
  bArmL.add(smooth, [7450, -60], [7850, 30], [8300, 0]);
  bArmL.add(smooth, [9200, 0], [9400, 40], [9650, 0]);
  walk([bLegL, bLegR], 7200, 7450, 250, 16);
  walk([bLegL, bLegR], 8300, 9050, 250, 14);
  [bLegL, bLegR].forEach((leg, side) =>
    leg.add(
      smooth,
      [7500, side ? -20 : 20],
      [7800, 0],
      [7880, side ? -14 : 14],
      [8250, 0],
      [9200, side ? -10 : 10],
      [9330, side ? 6 : -6],
      [9650, 0],
    ),
  );

  /* The held skull is sampled from the same linear poses as the arm. */
  const holds: SkeletonHold[] = [];
  const held = rest + 20;
  const upright = Math.round(held / 360) * 360;
  for (let t = 7900; t <= 9400; t += 50) {
    const [x, y] = bRoot.sample(t);
    const [dy] = bBody.sample(t);
    const [rotation] = bArmR.sample(t);
    const hand = skeletonHandPoint(
      { x, y },
      sB,
      t < 8300 ? 1 : -1,
      dy,
      rotation + SKELETON_ARM_REST,
    );
    const center = { x: hand.x, y: hand.y + rs };
    holds.push({ time: t, hand, skull: center });
    skull.add('linear', [
      t,
      center.x,
      center.y,
      t < 8300 ? mix(held, upright, (t - 7900) / 400) : upright,
      1,
    ]);
  }
  skull.add('linear', [9400, target.x, target.y, upright, 0]);
  skull.add('linear', [SKELETON_MS, target.x, target.y, upright, 0]);

  /* Backwards: a shrug, a shake and a spin put the face forward. */
  aRoot.add(smooth, [9450, aPlace, yA], [9700, aAfter, yA]);
  walk([aLegL, aLegR], 9450, 9700, 250, 9);
  aArmL.add(smooth, [9700, 35], [9850, 0]);
  aArmR.add(smooth, [9700, -35], [9850, 0]);
  aSkull.add('linear', [9400, 0, 1, 1]);
  aSkull.add(smooth, [9500, -8, 1, 1], [9650, 8, 1, 1], [9800, 0, 1, 1]);
  aSkull.add(easeIn, [9950, 0, 0, 1]);
  aSkull.add(easeOut, [10100, 0, 1, 1]);
  bSkull.add(smooth, [9700, 0], [9850, -14], [10050, 0]);
  bArmL.add(smooth, [9750, 0], [9880, 60], [10050, 0]);

  /* The partner can reach the greeting's last word from the edge. */
  const found = ledge ? targets.word : undefined;
  const wordBox = found && {
    x: rtl
      ? width - found.rect.left - found.rect.width / 2
      : found.rect.left + found.rect.width / 2,
    y: found.rect.top + found.rect.height / 2,
    top: found.rect.top,
    width: found.rect.width,
    height: found.rect.height,
  };
  const grabFacing = wordBox && wordBox.x >= backX + 50 * sB ? 1 : -1;
  const grip = wordBox && { x: wordBox.x, y: wordBox.top + 2 };
  /* A high word needs a jump with a raised arm; a word within standing reach
     (the real chat's greeting sits right above the composer) needs only a
     small hop, with the arm angle solved for the word. */
  const raised = grip && reach(grip, yB, 0, grabFacing, SKELETON_GRAB_ARM);
  const hopY = yB - SKELETON_MIN_HOP * sB;
  const lowered =
    grip && raised && raised.y > hopY
      ? reach(grip, hopY, 0, grabFacing)
      : undefined;
  const grabPose = lowered ?? raised;
  const grab =
    found &&
    wordBox &&
    grabPose &&
    found.rect.bottom <= stageY - 8 &&
    wordBox.x >= left &&
    wordBox.x <= right &&
    grabPose.x + 50 * sB >= left &&
    grabPose.x + 50 * sB <= right &&
    /* A clamped solve cannot touch the word, so it is not a grab. */
    (!lowered || Math.abs(lowered.y - hopY) < 0.5) &&
    yB - grabPose.y >= 0 &&
    yB - grabPose.y <= 110 * sB
      ? { found, box: wordBox, pose: grabPose }
      : undefined;
  const wordTrack = new Track();
  const wordHolds: SkeletonHold[] = [];

  /* Showman celebrates; without a theft the partner joins, then both drop. */
  aRoot.add(smooth, [10100, aAfter, yA]);
  aRoot.add(easeOut, [10250, aAfter, yA - 12]);
  aRoot.add(easeIn, [10450, aAfter, yA]);
  aBody.add(smooth, [10100, 0, 1.05, 0.94], [10250, 0, 0.97, 1.05]);
  aBody.add(smooth, [10450, 0], [SKELETON_MS, 0]);
  if (grab) {
    const { pose, box } = grab;
    const chase = aAfter + grabFacing * 60;
    aArmL.add(smooth, [10100, 0], [10250, 120], [10450, 20]);
    aArmR.add(smooth, [10100, 0], [10250, -120], [10450, -20]);
    /* "Hey!" - arms out at the thief, then after him. */
    aArmL.add(easeOut, [10650, 20], [10780, 75]);
    aArmR.add(easeOut, [10650, -20], [10780, -75]);
    aArmL.add(smooth, [11250, 40]);
    aArmR.add(smooth, [11250, -40]);
    aSkull.add(smooth, [10650, 0, 1, 1], [10780, grabFacing * 12, 1, 1]);
    aRoot.add(smooth, [10850, aAfter, yA]);
    arc(
      aRoot,
      { x: aAfter, y: yA },
      { x: chase, y: below + 20 },
      10850,
      11250,
      28 * s,
    );
    aRoot.add('linear', [11300, chase, below + 20, 0]);
    aRoot.add('linear', [SKELETON_MS, chase, below + 20, 0]);
    contact(10850, SkeletonContactKind.Landing, {
      x: aAfter + 50 * s,
      y: stageY,
    });

    const escape = { x: pose.x + grabFacing * 60, y: below + 20 };
    bFacing.add(step, [10100, grabFacing]);
    bSkull.add(smooth, [10100, 0], [10220, -16], [10450, 0]);
    bBody.add(smooth, [10100, 0], [10250, 10]);
    bBody.add('linear', [10450, 0], [11150, 0], [SKELETON_MS, 0]);
    bRoot.add(smooth, [10100, backX, yB], [10250, backX, yB]);
    arc(
      bRoot,
      { x: backX, y: yB },
      { x: pose.x, y: pose.y },
      10250,
      10450,
      18 * sB,
    );
    bRoot.add(
      'linear',
      [10550, pose.x, mix(pose.y, yB, 0.35)],
      [10700, pose.x, yB],
      [10800, pose.x, yB],
    );
    arc(bRoot, { x: pose.x, y: yB }, escape, 10800, 11150, 26 * sB);
    bRoot.add('linear', [11200, escape.x, escape.y, 0]);
    bRoot.add('linear', [SKELETON_MS, escape.x, escape.y, 0]);
    contact(10250, SkeletonContactKind.Landing, {
      x: backX + 50 * sB,
      y: stageY,
    });
    contact(10450, SkeletonContactKind.Grab, { x: box.x, y: box.top + 2 });
    contact(10700, SkeletonContactKind.Landing, {
      x: pose.x + 50 * sB,
      y: stageY,
    });
    bArmR.add(smooth, [10100, 0], [10250, 12]);
    bArmR.add(
      'linear',
      [10450, pose.direction - SKELETON_ARM_REST],
      /* Lowered forward so the loot dangles beside the body, not over the face. */
      [10700, SKELETON_CARRY_ARM - SKELETON_ARM_REST],
      [11150, SKELETON_CARRY_ARM - SKELETON_ARM_REST],
    );
    bArmL.add(smooth, [10250, 40], [10450, -30], [10800, 60], [11150, 30]);
    [bLegL, bLegR].forEach((leg, side) =>
      leg.add(
        smooth,
        [10250, side ? -12 : 12],
        [10450, side ? 8 : -8],
        [10700, 0],
        [10800, 0],
        [11000, side ? -25 : 25],
        [SKELETON_MS, side ? -25 : 25],
      ),
    );
    [aLegL, aLegR].forEach((leg, i) =>
      leg.add(
        smooth,
        [10850, 0],
        [11050, i ? -25 : 25],
        [SKELETON_MS, i ? -25 : 25],
      ),
    );

    /* The word dangles from the same sampled pose, then flies home. */
    const home = { x: box.x, y: box.y };
    wordTrack.add(
      'linear',
      [0, home.x, home.y, 0, 0],
      [SKELETON_WORD_HIDE, home.x, home.y, 0, 0],
    );
    let last = home;
    for (let t = SKELETON_WORD_HIDE; t <= 11100; t += 50) {
      const [x, y] = bRoot.sample(t);
      const [dy] = bBody.sample(t);
      const [rotation] = bArmR.sample(t);
      const hand = skeletonHandPoint(
        { x, y },
        sB,
        grabFacing,
        dy,
        rotation + SKELETON_ARM_REST,
      );
      last = { x: hand.x, y: hand.y + box.height / 2 - 2 };
      wordHolds.push({ time: t, hand, skull: last });
      wordTrack.add('linear', [
        t,
        last.x,
        last.y,
        6 * Math.sin((t - SKELETON_WORD_HIDE) / 130),
        1,
      ]);
    }
    arc(wordTrack, last, home, 11100, SKELETON_WORD_RESTORE, 90 * s, (t) => [
      -360 * (1 - t),
      1,
    ]);
    wordTrack.add(
      'linear',
      [SKELETON_WORD_RESTORE, home.x, home.y, 0, 0],
      [SKELETON_MS, home.x, home.y, 0, 0],
    );
  } else {
    bRoot.add(smooth, [10100, backX, yB]);
    bRoot.add(easeOut, [10250, backX, yB - 14]);
    bRoot.add(easeIn, [10450, backX, yB]);
    bBody.add(smooth, [10100, 0, 1.06, 0.93], [10250, 0, 0.96, 1.06]);
    bBody.add(smooth, [10450, 0], [SKELETON_MS, 0]);
    [aArmL, bArmL].forEach((arm) =>
      arm.add(smooth, [10100, 0], [10250, 120], [10450, 20], [11300, 30]),
    );
    [aArmR, bArmR].forEach((arm) =>
      arm.add(smooth, [10100, 0], [10250, -120], [10450, -20], [11300, -30]),
    );
    arc(
      aRoot,
      { x: aAfter, y: yA },
      { x: aAfter - 40, y: below + 20 },
      10550,
      11300,
      30 * s,
    );
    arc(
      bRoot,
      { x: backX, y: yB },
      { x: backX + 40, y: below + 20 },
      10600,
      11300,
      30 * sB,
    );
    aRoot.add('linear', [11350, aAfter - 40, below + 20, 0]);
    aRoot.add('linear', [SKELETON_MS, aAfter - 40, below + 20, 0]);
    bRoot.add('linear', [11350, backX + 40, below + 20, 0]);
    bRoot.add('linear', [SKELETON_MS, backX + 40, below + 20, 0]);
    contact(10550, SkeletonContactKind.Landing, {
      x: aAfter + 50 * s,
      y: stageY,
    });
    [aLegL, aLegR, bLegL, bLegR].forEach((leg, i) =>
      leg.add(
        smooth,
        [10500, 0],
        [10750, i % 2 ? -25 : 25],
        [SKELETON_MS, i % 2 ? -25 : 25],
      ),
    );
  }
  [aArmL, aArmR, bArmL, bArmR, aSkull, bSkull].forEach((track) =>
    track.add('linear', [SKELETON_MS, ...track.sample(SKELETON_MS)]),
  );

  /* The outline dips only after a landing or impact has happened. */
  const outline = new Track();
  outline.add(smooth, [0, 0, 0], [700, 0, 0], [950, 0, 0.9]);
  outline.add(
    easeOut,
    [1000, 0, 0.9],
    [1060, 2, 0.9],
    [1160, 1.4, 0.9],
    [1210, 2.5, 0.9],
    [1390, 0, 0.9],
  );
  [
    [5900, 3],
    [6250, 1.2],
    [7850, 2],
    [9650, 2.2],
    ...(grab
      ? [
          [10250, 1.2],
          [10700, 2],
          [10850, 1.2],
        ]
      : [[10550, 1.5]]),
  ].forEach(([time, depth]) =>
    outline.add(
      easeOut,
      [time, 0, 0.9],
      [time + 60, depth, 0.9],
      [time + 240, 0, 0.9],
    ),
  );
  outline.add(smooth, [10950, 0, 0.9], [11400, 0, 0], [SKELETON_MS, 0, 0]);

  return {
    targets,
    anchors: [
      ...(ledge && composer ? [composer] : []),
      ...(grab
        ? [{ element: grab.found.heading, rect: grab.found.headingRect }]
        : []),
    ],
    ledge: ledge && {
      left: ledge.left,
      top: ledge.top,
      width: ledge.right - ledge.left,
      height: ledge.height,
      borderRadius: composer?.borderRadius,
    },
    stageY,
    skullSize: SKELETON_ART.skullBox * s,
    showman: {
      scale: s,
      root: aRoot.frames(translate),
      facing: aFacing.frames(flip),
      parts: {
        [SkeletonPart.Body]: aBody.frames(body),
        [SkeletonPart.Skull]: aSkull.frames(([angle, sx, opacity]) => ({
          transform: `rotate(${round(angle)}deg) scaleX(${sx})`,
          opacity,
        })),
        [SkeletonPart.Face]: aFace.frames(fade),
        [SkeletonPart.ArmLeft]: aArmL.frames(rotate),
        [SkeletonPart.ArmRight]: aArmR.frames(rotate),
        [SkeletonPart.LegLeft]: aLegL.frames(rotate),
        [SkeletonPart.LegRight]: aLegR.frames(rotate),
      },
    },
    partner: {
      scale: sB,
      root: bRoot.frames(translate),
      facing: bFacing.frames(flip),
      parts: {
        [SkeletonPart.Body]: bBody.frames(body),
        [SkeletonPart.Skull]: bSkull.frames(rotate),
        [SkeletonPart.ArmLeft]: bArmL.frames(rotate),
        [SkeletonPart.ArmRight]: bArmR.frames(rotate),
        [SkeletonPart.LegLeft]: bLegL.frames(rotate),
        [SkeletonPart.LegRight]: bLegR.frames(rotate),
      },
    },
    skull: {
      root: skull.frames(([x, y, angle, opacity]) => ({
        transform: `translate(${round(x - SKELETON_ART.skullBox * s * 0.5)}px, ${round(y - SKELETON_ART.skullBox * s * 0.5)}px) rotate(${round(angle)}deg)`,
        opacity,
      })),
      turn: turn.frames(flip),
      face: freeFace.frames(fade),
    },
    outline: ledge
      ? outline.frames(([dy, opacity]) => ({
          transform: `translateY(${round(dy)}px)`,
          opacity,
        }))
      : [],
    contacts: contacts.sort((a, b) => a.time - b.time),
    holds,
    word: grab && {
      target: grab.found,
      width: grab.box.width,
      height: grab.box.height,
      frames: wordTrack.frames(([x, y, angle, opacity]) => ({
        transform: `translate(${round(x - grab.box.width / 2)}px, ${round(y - grab.box.height / 2)}px) rotate(${round(angle)}deg)`,
        opacity,
      })),
      holds: wordHolds,
      hideAt: SKELETON_WORD_HIDE,
      restoreAt: SKELETON_WORD_RESTORE,
    },
  };
};
