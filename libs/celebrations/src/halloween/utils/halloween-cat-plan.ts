import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { HALLOWEEN_CAT_SCENE_DURATION_MS } from '../constants/halloween';
import type { CatTargets } from './halloween-cat-targets';

export const CAT_SCENE_MS = HALLOWEEN_CAT_SCENE_DURATION_MS;
export const CAT_RESTORE = 0.92;

export enum CatPart {
  Arm = 'arm',
  Forearm = 'forearm',
  Head = 'head',
  Tail = 'tail',
  HindLeg = 'hind-leg',
  FarLeg = 'far-leg',
  Eyes = 'eyes',
  Pupils = 'pupils',
  Ears = 'ears',
  Tongue = 'tongue',
}

export enum CatContactKind {
  Touch = 'touch',
  Nudge = 'nudge',
  Push = 'push',
  Release = 'release',
}

interface Point {
  x: number;
  y: number;
}

interface CatContact {
  button: number;
  time: number;
  kind: CatContactKind;
  point: Point;
}

interface CatButton {
  target: CelebrationSnapshotTarget;
  frames: Keyframe[];
  entry: number;
  release: number;
  landing: number;
  support?: CelebrationSnapshotTarget;
  rebound?: { apex: number; end: number; height: number };
}

export interface CatPlan {
  active: boolean;
  width: number;
  height: number;
  composer?: CelebrationSnapshotTarget;
  anchors: CelebrationSnapshotTarget[];
  size: number;
  /** Physical position of SVG foot point (80,120). */
  rest: Point;
  frames: Keyframe[];
  facing: Keyframe[];
  parts: Record<CatPart, Keyframe[]>;
  buttons: CatButton[];
  contacts: CatContact[];
  floor?: { x: number; y: number; width: number };
}

/** One paw push: the paw lands at `touch`, slides the button from `start` to `end`. */
interface Push {
  touch: number;
  start: number;
  end: number;
  amount: number;
}

interface Prize {
  target: CelebrationSnapshotTarget;
  foot: Point;
  side: number;
  pushes: Push[];
  release: number;
  landing: number;
  floorY: number;
  drop: number;
  support?: CelebrationSnapshotTarget;
  rebound?: { apex: number; end: number; height: number };
}

/* Story beats in milliseconds; everything is normalized against CAT_SCENE_MS. */
const WALK_IN_END = 2600;
const JUMP_FROM = 3100;
const JUMP_TO = 3700;
const HOP_FROM = 7600;
const HOP_TO = 8300;
const PRIZE_START = [8600, 15300];
const BEAT = 2500;
/** Offsets inside one beat: look at the user, then the button, then push slowly. */
const BEAT_TOUCH = 1000;
const BEAT_PUSH_FROM = 1150;
const BEAT_PUSH_TO = 2050;
const MOVE_FROM = 14200;
const MOVE_TO = 15100;
const GROOM_LIMIT = 22700;
const DEPART_FROM = 23500;
const DEPART_TO = 24900;
const GAIT_HZ = 1.9;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;
const smooth = (from: number, to: number, time: number) => {
  const progress = clamp((time - from) / (to - from), 0, 1);
  return progress * progress * (3 - 2 * progress);
};
const envelope = (
  from: number,
  peak: number,
  until: number,
  end: number,
  time: number,
) => smooth(from, peak, time) * (1 - smooth(until, end, time));
/** Ease in and out of a held pose over `[from, to]`, in milliseconds. */
const hold = ([from, to]: [number, number], ms: number, ramp = 220) =>
  envelope(from, from + ramp, to - ramp, to, ms);
const strongest = (windows: [number, number][], ms: number, ramp?: number) =>
  windows.reduce((value, window) => Math.max(value, hold(window, ms, ramp)), 0);
const sample = (from: number, to: number, steps: number) =>
  Array.from({ length: steps + 1 }, (_, index) => mix(from, to, index / steps));
const ordered = (times: number[]) =>
  [...new Set(times.map((time) => Number(clamp(time, 0, 1).toFixed(9))))].sort(
    (a, b) => a - b,
  );
const rotate = (angle: number) => `rotate(${angle}deg)`;
const at = (ms: number) => ms / CAT_SCENE_MS;
const toMs = (time: number) => time * CAT_SCENE_MS;
const oscillate = (ms: number, hz: number) =>
  Math.sin((ms / 1000) * Math.PI * 2 * hz);

/** SVG arm: shoulder (100,72), elbow (100,96), paw (100,120). */
const reach = (point: Point): [number, number] => {
  const x = point.x - 100;
  const y = point.y - 72;
  const cosine = clamp((x * x + y * y - 2 * 24 * 24) / (2 * 24 * 24), -1, 1);
  const forearm = -Math.acos(cosine);
  const arm =
    Math.atan2(y, x) -
    Math.atan2(24 * Math.sin(forearm), 24 + 24 * Math.cos(forearm));
  return [(arm * 180) / Math.PI - 90, (forearm * 180) / Math.PI];
};

const displacement = (prize: Prize, time: number) =>
  prize.side *
  prize.pushes.reduce(
    (sum, push) => sum + push.amount * smooth(push.start, push.end, time),
    0,
  );

/** The cat shuffles after each push, so its paw stays within easy reach. */
const bodyShift = (prize: Prize, time: number) =>
  prize.side *
  prize.pushes.reduce(
    (sum, push) =>
      sum + push.amount * smooth(push.end + at(150), push.end + at(650), time),
    0,
  );

const contactPoint = (prize: Prize, time: number): Point => ({
  x:
    (prize.side > 0 ? prize.target.rect.left : prize.target.rect.right) +
    displacement(prize, time),
  y: prize.target.rect.top + prize.target.rect.height * 0.62,
});

const standAt = (prize: Prize, time: number): Point => ({
  x: prize.foot.x + bodyShift(prize, time),
  y: prize.foot.y,
});

/** Precompute physical contacts, accelerating falls and one measured rebound. */
export const buildCatPlan = (
  targets: CatTargets,
  isMobile: boolean,
): CatPlan => {
  const { width, height, composer } = targets;
  const size = isMobile ? 112 : 140;
  const scale = size / 160;
  const emptyParts: Record<CatPart, Keyframe[]> = {
    [CatPart.Arm]: [],
    [CatPart.Forearm]: [],
    [CatPart.Head]: [],
    [CatPart.Tail]: [],
    [CatPart.HindLeg]: [],
    [CatPart.FarLeg]: [],
    [CatPart.Eyes]: [],
    [CatPart.Pupils]: [],
    [CatPart.Ears]: [],
    [CatPart.Tongue]: [],
  };
  const plan: CatPlan = {
    active: false,
    width,
    height,
    composer,
    anchors: [],
    size,
    rest: { x: 0, y: 0 },
    frames: [],
    facing: [],
    parts: emptyParts,
    buttons: [],
    contacts: [],
  };
  if (!composer || width < 300 || composer.rect.top < size * 0.7) return plan;

  const prizes: Prize[] = [];
  for (const target of targets.buttons.slice(0, 2)) {
    const rect = target.rect;
    if (height - rect.bottom < 24) continue;
    const preferred =
      rect.left + rect.width / 2 >= composer.rect.left + composer.rect.width / 2
        ? 1
        : -1;
    for (const side of [preferred, -preferred]) {
      const edge = side > 0 ? rect.left : rect.right;
      const foot = { x: edge - side * 30 * scale, y: rect.bottom };
      const margin = size * 0.46;
      const travel = side > 0 ? width - rect.right - 3 : rect.left - 3;
      const footTravel = side > 0 ? width - margin - foot.x : foot.x - margin;
      if (
        foot.x < margin ||
        foot.x > width - margin ||
        travel < 8 ||
        footTravel < 5
      )
        continue;
      const index = prizes.length;
      const nudge = index === 0 ? Math.min(5, travel * 0.25) : 0;
      const push = Math.min(size * 0.16, travel - nudge, footTravel);
      const shiftedLeft = rect.left + side * (nudge + push);
      const shiftedRight = shiftedLeft + rect.width;
      const support = targets.supports
        .filter(
          ({ rect: supportRect, element }) =>
            element !== target.element &&
            supportRect.top >= rect.bottom + 12 &&
            Math.min(shiftedRight, supportRect.right) -
              Math.max(shiftedLeft, supportRect.left) >=
              Math.min(16, rect.width * 0.3),
        )
        .sort((a, b) => a.rect.top - b.rect.top)[0];
      const floorY = support?.rect.top ?? height - 2;
      const drop = floorY - rect.bottom;
      /* A cautious test tap first, then the push that tips the button over. */
      const amounts = index === 0 ? [nudge, push] : [push * 0.45, push * 0.55];
      const pushes = amounts.map((amount, beat) => {
        const start = PRIZE_START[index] + beat * BEAT;
        return {
          touch: at(start + BEAT_TOUCH),
          start: at(start + BEAT_PUSH_FROM),
          end: at(start + BEAT_PUSH_TO),
          amount,
        };
      });
      const release = pushes[pushes.length - 1].end;
      /* Screen-space gravity, in px/s²; never ease each fall sample separately. */
      const fallTime = Math.sqrt((2 * drop) / 2000) / (CAT_SCENE_MS / 1000);
      prizes.push({
        target,
        foot,
        side,
        pushes,
        release,
        landing: release + fallTime,
        floorY,
        drop,
        support,
      });
      break;
    }
  }
  if (!prizes.length) return plan;
  const first = prizes[0];
  const last = prizes[prizes.length - 1];
  const reboundHeight = Math.min(last.drop * 0.32, size * 0.75);
  const reboundTime =
    Math.sqrt((2 * reboundHeight) / 2000) / (CAT_SCENE_MS / 1000);
  last.rebound = {
    height: reboundHeight,
    apex: last.landing + reboundTime,
    end: last.landing + reboundTime * 2,
  };
  const recoilStart = toMs(last.landing) + 80;
  const recoilEnd = Math.max(recoilStart + 800, toMs(last.rebound.end));
  /* Grooming bouts fill the wait; a lone prize leaves time for a second bout. */
  const grooms: [number, number][] = [
    [recoilEnd + 300, Math.min(recoilEnd + 1900, GROOM_LIMIT)],
  ];
  if (GROOM_LIMIT - grooms[0][1] > 4000)
    grooms.push([GROOM_LIMIT - 1600, GROOM_LIMIT]);
  const departSide = last.side;
  const lastFoot = standAt(last, 1);
  const groomFoot = { x: lastFoot.x - last.side * size * 0.14, y: lastFoot.y };
  const moveFrom = standAt(first, at(MOVE_FROM));
  const moveSide = Math.sign(last.foot.x - moveFrom.x) || last.side;
  const stance = (ms: number) =>
    prizes.length > 1 && ms >= MOVE_FROM ? last : first;

  const releases = prizes.map(({ release, landing }) => [
    toMs(release),
    toMs(landing),
  ]);
  /* Before every push: look at the user, at the button while pushing, then back at the user. */
  const lookUser: [number, number][] = [
    [4300, 5500],
    [6950, 7500],
    ...prizes.flatMap(({ pushes }) =>
      pushes.flatMap(({ touch, end }): [number, number][] => [
        [toMs(touch) - BEAT_TOUCH, toMs(touch) - 250],
        [toMs(end) + 300, toMs(end) + 1000],
      ]),
    ),
    ...releases.map(([, landing]): [number, number] => [
      landing + 450,
      landing + 1100,
    ]),
    ...grooms.map(([, end], index): [number, number] => [
      end + 100,
      index === grooms.length - 1 ? DEPART_FROM + 100 : end + 1600,
    ]),
  ];
  const lookButton: [number, number][] = [
    [5900, 6900],
    ...prizes.flatMap(({ pushes }) =>
      pushes.map(({ touch, end }): [number, number] => [
        toMs(touch) - 200,
        toMs(end) + 200,
      ]),
    ),
  ];
  const watchFall = releases.map(([release, landing]): [number, number] => [
    release,
    landing + 400,
  ]);
  const walkWindows: [number, number][] = [
    [-200, WALK_IN_END],
    ...(prizes.length > 1 ? [[MOVE_FROM, MOVE_TO] as [number, number]] : []),
    ...prizes.flatMap(({ pushes }) =>
      pushes.map(({ end }): [number, number] => [
        toMs(end) + 150,
        toMs(end) + 650,
      ]),
    ),
  ];
  const jumpWindows: [number, number][] = [
    [JUMP_FROM, JUMP_TO],
    [HOP_FROM, HOP_TO],
    [DEPART_FROM + 150, DEPART_TO],
  ];
  const blinks = [2900, 5000, 6400, 9300, 12300, 14700, 16700, 19200, 23200];
  const earTwitches = [4700, 10500, 18300, 22950];
  const walking = (ms: number) => strongest(walkWindows, ms, 120);
  const jumping = (ms: number) => strongest(jumpWindows, ms, 130);
  const gait = (ms: number) => oscillate(ms, GAIT_HZ);

  const body = (ms: number) => {
    let point: Point;
    let squash = 1;
    const top = { x: first.foot.x, y: composer.rect.top };
    const approach = {
      x: first.foot.x - first.side * size * 0.75,
      y: composer.rect.top + size * 0.4,
    };
    if (ms < WALK_IN_END) {
      /* Enters at walking pace and slows to a stop instead of sliding in. */
      const progress = clamp(ms / WALK_IN_END, 0, 1);
      point = {
        x: mix(
          first.side > 0 ? -size : width + size,
          approach.x,
          progress * (2 - progress),
        ),
        y: approach.y,
      };
    } else if (ms < JUMP_FROM) {
      point = approach;
      squash = 1 - envelope(2750, 3000, 3000, JUMP_FROM, ms) * 0.16;
    } else if (ms < JUMP_TO) {
      const progress = clamp((ms - JUMP_FROM) / (JUMP_TO - JUMP_FROM), 0, 1);
      point = {
        x: mix(approach.x, top.x, progress),
        y:
          mix(approach.y, top.y, progress) -
          Math.sin(progress * Math.PI) * size * 0.6,
      };
    } else if (ms < HOP_FROM) {
      point = top;
      squash =
        1 -
        envelope(JUMP_TO, JUMP_TO + 60, JUMP_TO + 100, JUMP_TO + 260, ms) *
          0.16;
    } else if (ms < HOP_TO) {
      const progress = clamp((ms - HOP_FROM) / (HOP_TO - HOP_FROM), 0, 1);
      point = {
        x: first.foot.x,
        y:
          mix(top.y, first.foot.y, progress) -
          Math.sin(progress * Math.PI) * size * 0.27,
      };
    } else if (prizes.length > 1 && ms >= MOVE_FROM && ms < MOVE_TO) {
      const progress = smooth(MOVE_FROM, MOVE_TO, ms);
      point = {
        x: mix(moveFrom.x, last.foot.x, progress),
        y: mix(moveFrom.y, last.foot.y, progress),
      };
    } else {
      point = standAt(stance(ms), at(ms));
      squash =
        1 -
        envelope(HOP_TO, HOP_TO + 60, HOP_TO + 100, HOP_TO + 250, ms) * 0.12;
    }
    if (ms >= recoilStart) {
      const progress = smooth(recoilStart, recoilEnd, ms);
      point = {
        x: mix(lastFoot.x, groomFoot.x, progress),
        y: lastFoot.y - Math.sin(progress * Math.PI) * size * 0.18,
      };
      squash =
        1 -
        envelope(
          recoilEnd,
          recoilEnd + 140,
          recoilEnd + 210,
          recoilEnd + 580,
          ms,
        ) *
          0.12;
    }
    if (ms >= DEPART_FROM) {
      squash =
        1 -
        envelope(
          DEPART_FROM,
          DEPART_FROM + 200,
          DEPART_FROM + 230,
          DEPART_FROM + 380,
          ms,
        ) *
          0.2;
      const progress = smooth(DEPART_FROM + 250, DEPART_TO, ms);
      point = {
        x: mix(groomFoot.x, departSide > 0 ? width + size : -size, progress),
        y:
          groomFoot.y -
          Math.sin(progress * Math.PI) * size * 0.7 +
          progress * size * 0.22,
      };
    }
    /* Each footfall lifts the body slightly. */
    point = {
      x: point.x,
      y: point.y - Math.abs(gait(ms)) * size * 0.014 * walking(ms),
    };
    return { ...point, squash };
  };

  const contacts = prizes.flatMap((prize, button) => {
    const firstPush = prize.pushes[0];
    const lastPush = prize.pushes[prize.pushes.length - 1];
    const events = [
      { time: firstPush.touch, kind: CatContactKind.Touch },
      ...(button === 0
        ? [{ time: firstPush.end, kind: CatContactKind.Nudge }]
        : []),
      { time: lastPush.touch, kind: CatContactKind.Push },
      { time: prize.release, kind: CatContactKind.Release },
    ];
    return events.map((event) => ({
      ...event,
      button,
      point: contactPoint(prize, event.time),
    }));
  });
  /* ~60 ms sampling keeps the gait and bob smooth instead of aliasing into twitches. */
  const frameTimes = ordered([
    ...sample(0, 1, Math.round(CAT_SCENE_MS / 60)),
    ...[
      WALK_IN_END,
      2750,
      3000,
      JUMP_FROM,
      JUMP_TO,
      JUMP_TO + 60,
      JUMP_TO + 100,
      JUMP_TO + 260,
      HOP_FROM,
      HOP_TO,
      HOP_TO + 60,
      HOP_TO + 100,
      HOP_TO + 250,
      MOVE_FROM,
      MOVE_TO,
      recoilStart,
      recoilEnd,
      recoilEnd + 140,
      recoilEnd + 210,
      recoilEnd + 580,
      DEPART_FROM,
      DEPART_FROM + 200,
      DEPART_FROM + 230,
      DEPART_FROM + 250,
      DEPART_FROM + 380,
      DEPART_TO,
    ].map(at),
    ...contacts.map(({ time }) => time),
    ...prizes.flatMap(({ pushes }) =>
      pushes.flatMap((push) => [
        push.touch - at(250),
        push.touch,
        ...sample(push.start, push.end, 12),
      ]),
    ),
  ]);
  plan.active = true;
  plan.rest = first.foot;
  plan.contacts = contacts;
  plan.frames = frameTimes.map((offset) => {
    const ms = toMs(offset);
    const point = body(ms);
    return {
      offset,
      opacity:
        ms < 450
          ? smooth(0, 450, ms)
          : 1 - smooth(DEPART_TO - 550, DEPART_TO + 50, ms),
      transform: `translate(${point.x}px, ${point.y}px) scale(${2 - point.squash}, ${point.squash})`,
      easing: 'linear',
    };
  });
  plan.facing = [
    { offset: 0, transform: `scaleX(${first.side})`, easing: 'steps(1, end)' },
    ...(prizes.length > 1
      ? [
          {
            offset: at(MOVE_FROM),
            transform: `scaleX(${moveSide})`,
            easing: 'steps(1, end)',
          },
          {
            offset: at(MOVE_TO),
            transform: `scaleX(${last.side})`,
            easing: 'steps(1, end)',
          },
        ]
      : []),
    { offset: 1, transform: `scaleX(${last.side})` },
  ];

  const arms = frameTimes.map((time) => {
    const ms = toMs(time);
    const stride = walking(ms);
    /* The near foreleg steps opposite the far one and tucks for jumps. */
    let arm = -gait(ms) * 15 * stride - jumping(ms) * 18;
    let forearm = -Math.max(0, gait(ms)) * 18 * stride;
    for (const prize of prizes) {
      for (const push of prize.pushes) {
        const weight = envelope(
          push.touch - at(250),
          push.touch,
          push.end + at(50),
          push.end + at(320),
          time,
        );
        if (!weight) continue;
        const point = contactPoint(prize, time);
        const foot = body(ms);
        const angles = reach({
          x: 80 + (prize.side * (point.x - foot.x)) / scale,
          y: 120 + (point.y - foot.y) / scale,
        });
        arm = mix(arm, angles[0], weight);
        forearm = mix(forearm, angles[1], weight);
      }
    }
    const grooming = strongest(grooms, ms, 280);
    const groomAngles = reach({ x: 112, y: 58 + oscillate(ms, 1.8) * 1.5 });
    return [
      mix(arm, groomAngles[0], grooming),
      mix(forearm, groomAngles[1], grooming),
    ];
  });
  plan.parts[CatPart.Arm] = frameTimes.map((offset, index) => ({
    offset,
    transform: rotate(arms[index][0]),
    easing: 'linear',
  }));
  plan.parts[CatPart.Forearm] = frameTimes.map((offset, index) => ({
    offset,
    transform: rotate(arms[index][1]),
    easing: 'linear',
  }));
  for (const offset of frameTimes) {
    const ms = toMs(offset);
    const button = strongest(lookButton, ms);
    const watch = strongest(watchFall, ms, 120);
    const user = strongest(lookUser, ms) * (1 - Math.max(button, watch));
    const lookUp = envelope(2550, 2750, 3000, 3200, ms);
    const recoil = envelope(
      recoilStart,
      recoilStart + 140,
      recoilEnd,
      recoilEnd + 600,
      ms,
    );
    const grooming = strongest(grooms, ms, 280);
    const jump = jumping(ms);
    const stride = walking(ms);
    const leg = gait(ms) * 17 * stride;
    const blink = blinks.reduce(
      (value, time) => Math.max(value, 1 - Math.abs(ms - time) / 90),
      0,
    );
    const twitch = earTwitches.reduce(
      (value, time) =>
        value + envelope(time, time + 60, time + 120, time + 240, ms),
      0,
    );
    const head =
      -user * 7 +
      button * 16 +
      watch * 24 -
      lookUp * 12 -
      recoil * 17 +
      grooming * (14 + oscillate(ms, 1.8) * 3) +
      oscillate(ms, GAIT_HZ * 2) * 1.5 * stride;
    plan.parts[CatPart.Head].push({
      offset,
      transform: rotate(head),
      easing: 'linear',
    });
    plan.parts[CatPart.Tail].push({
      offset,
      transform: rotate(
        oscillate(ms, 0.36) * 9 * (1 - stride * 0.5) +
          stride * 6 +
          button * oscillate(ms, 1.4) * 4 -
          recoil * 24 +
          jump * 14,
      ),
      easing: 'linear',
    });
    plan.parts[CatPart.HindLeg].push({
      offset,
      transform: rotate(leg - jump * 27 + recoil * 18),
      easing: 'linear',
    });
    plan.parts[CatPart.FarLeg].push({
      offset,
      transform: rotate(leg * 0.9 + jump * 24 - recoil * 15),
      easing: 'linear',
    });
    plan.parts[CatPart.Eyes].push({
      offset,
      transform: `scale(${1 + recoil * 0.15}, ${(1 + recoil * 0.35 + user * 0.06 - grooming * 0.55) * (1 - Math.max(0, blink) * 0.9)})`,
      easing: 'linear',
    });
    plan.parts[CatPart.Pupils].push({
      offset,
      transform: `translate(${-1.6 * user + 1.4 * button + 1.2 * watch}px, ${1.1 * button + 2 * watch - 0.2 * user}px)`,
      easing: 'linear',
    });
    plan.parts[CatPart.Ears].push({
      offset,
      transform: rotate(-recoil * 15 + user * 5 - button * 2 - twitch * 9),
      easing: 'linear',
    });
    plan.parts[CatPart.Tongue].push({
      offset,
      opacity: grooming * Math.max(0, oscillate(ms, 2.9)),
      easing: 'linear',
    });
  }

  for (const prize of prizes) {
    const { rect } = prize.target;
    const entry = prize.pushes[0].touch;
    const times = ordered([
      0,
      1,
      entry - at(175),
      entry,
      ...prize.pushes.flatMap((push) => [
        push.touch,
        ...sample(push.start, push.end, 12),
      ]),
      ...sample(prize.release, prize.landing, 18),
      ...(prize.rebound ? sample(prize.landing, prize.rebound.end, 20) : []),
      CAT_RESTORE,
      CAT_RESTORE + 0.04,
    ]);
    const frames = times.map((offset) => {
      let y = 0;
      let rotation = 0;
      if (offset >= prize.release) {
        const progress = clamp(
          (offset - prize.release) / (prize.landing - prize.release),
          0,
          1,
        );
        y = prize.drop * progress * progress;
        rotation =
          prize.side *
          Math.min(12, (prize.drop / rect.width) * 65) *
          Math.sin(progress * Math.PI);
      }
      if (
        prize.rebound &&
        offset >= prize.landing &&
        offset <= prize.rebound.end
      ) {
        const progress = clamp(
          (offset - prize.landing) / (prize.rebound.end - prize.landing),
          0,
          1,
        );
        y = prize.drop - 4 * prize.rebound.height * progress * (1 - progress);
        rotation = -prize.side * 8 * Math.sin(progress * Math.PI);
      }
      const visibility =
        smooth(entry - at(175), entry, offset) *
        (1 - smooth(CAT_RESTORE, CAT_RESTORE + 0.04, offset));
      return {
        offset,
        opacity: visibility,
        transform: `translate(${displacement(prize, offset)}px, ${y}px) rotate(${rotation}deg)`,
        easing: 'linear',
      };
    });
    plan.buttons.push({
      target: prize.target,
      frames,
      entry,
      release: prize.release,
      landing: prize.landing,
      support: prize.support,
      rebound: prize.rebound,
    });
  }
  plan.anchors = [
    ...new Set([
      composer,
      ...prizes.map(({ target }) => target),
      ...prizes.flatMap(({ support }) => (support ? [support] : [])),
    ]),
  ];
  const grounded = prizes.filter(({ support }) => !support);
  if (grounded.length) {
    const left = Math.min(
      ...grounded.map(
        (prize) => prize.target.rect.left + displacement(prize, 1),
      ),
    );
    const right = Math.max(
      ...grounded.map(
        (prize) => prize.target.rect.right + displacement(prize, 1),
      ),
    );
    plan.floor = {
      x: Math.max(0, left - 12),
      y: height - 2,
      width: Math.min(width - Math.max(0, left - 12), right - left + 24),
    };
  }
  return plan;
};
