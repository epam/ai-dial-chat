import type { GiftWrappingTarget } from './gift-wrapping-targets';

/** Playback includes the final reel collection and departure. */
export const GIFT_WRAPPING_MS = 18000;

/** Art coordinates shared by the rig, cap and hand contact calculations. */
export const ELF_RIG = {
  shoulder: { x: 13, y: -58 },
  capBase: { x: 0, y: -94 },
  capTip: { x: 28, y: -124 },
  armLength: 35,
};

interface Point {
  x: number;
  y: number;
}

/** One precomputed animation of an element inside this scene. */
interface GiftWrappingTrack {
  selector: string;
  frames: Keyframe[];
}

interface Pose extends Point {
  time: number;
  lean: number;
  opacity: number;
  hand: Point;
  head: number;
  capAngle: number;
  capScale: number;
}

/** Complete bounded scene, including contact samples for verification. */
export interface GiftWrappingPlan {
  target: GiftWrappingTarget;
  scale: number;
  knot: Point;
  tracks: GiftWrappingTrack[];
  contacts: { time: number; hat: Point; knot: Point; hand: Point }[];
  animationLimit: number;
  frameLimit: number;
}

const radians = (angle: number) => (angle * Math.PI) / 180;
const degrees = (angle: number) => (angle * 180) / Math.PI;
const rotate = ({ x, y }: Point, angle: number): Point => ({
  x: x * Math.cos(radians(angle)) - y * Math.sin(radians(angle)),
  y: x * Math.sin(radians(angle)) + y * Math.cos(radians(angle)),
});
const localToStage = (p: Point, pose: Pose, scale: number, facing: number) => {
  const rotated = rotate(p, pose.lean);
  return {
    x: pose.x + rotated.x * scale * facing,
    y: pose.y + rotated.y * scale,
  };
};
const stageToLocal = (p: Point, pose: Pose, scale: number, facing: number) =>
  rotate(
    { x: (p.x - pose.x) / scale / facing, y: (p.y - pose.y) / scale },
    -pose.lean,
  );
const armAngles = (hand: Point) => {
  const dx = hand.x - ELF_RIG.shoulder.x;
  const dy = hand.y - ELF_RIG.shoulder.y;
  const distance = Math.min(
    ELF_RIG.armLength * 2 - 0.01,
    Math.max(1, Math.hypot(dx, dy)),
  );
  const bend = Math.acos(distance / (ELF_RIG.armLength * 2));
  return {
    upper: degrees(Math.atan2(dy, dx) - bend),
    forearm: degrees(2 * bend),
  };
};
const frame = (time: number, values: Omit<Keyframe, 'offset'>): Keyframe => ({
  offset: time / 18,
  easing: 'cubic-bezier(.4,0,.2,1)',
  ...values,
});

/** Builds one shared timeline without reading or changing the DOM. */
export const buildGiftWrappingPlan = (
  target: GiftWrappingTarget,
  isMobile: boolean,
): GiftWrappingPlan => {
  const { box, width, rtl } = target;
  const scale = Math.min(isMobile ? 0.65 : 0.85, box.width / 350);
  const direction = rtl ? -1 : 1;
  const center = box.left + box.width / 2;
  const knot = { x: center, y: box.top - 10 * scale };
  const tracks: GiftWrappingTrack[] = [];
  const contacts: GiftWrappingPlan['contacts'] = [];
  const add = (selector: string, frames: Keyframe[]) =>
    tracks.push({ selector, frames });
  const times = [
    0, 0.6, 1.2, 1.8, 2.4, 3, 4.4, 5.2, 6.2, 7, 7.8, 8.5, 9, 9.5, 10, 10.8, 12,
    13.2, 14, 14.8, 15.6, 16.4, 17.2, 18,
  ];

  for (let actor = 0; actor < 2; actor++) {
    const helper = actor === 1;
    const facing = (helper ? -1 : 1) * direction;
    const actorScale = scale * (helper ? 0.91 : 1);
    const edge = center - facing * (box.width / 2 - 25 * actorScale);
    const home = center - facing * (helper ? 126 : 52) * actorScale;
    const outside = facing === 1 ? -80 : width + 80;
    const caughtLean = 72;
    const tip = rotate(ELF_RIG.capTip, caughtLean);
    const caughtX = center - tip.x * actorScale * facing;
    const caughtY = knot.y - tip.y * actorScale;
    const poses = times.map((time): Pose => {
      const pose: Pose = {
        time,
        x: home,
        y: box.top,
        lean: 0,
        opacity: 1,
        hand: { x: 31, y: -26 },
        head: 0,
        capAngle: 0,
        capScale: 1,
      };
      if (time === 0)
        Object.assign(pose, {
          x: helper ? edge : outside,
          y: box.top + 60,
          opacity: 0,
        });
      else if (time <= 2.4) {
        const progress = Math.min(1, time / (helper ? 1.2 : 2.4));
        pose.x = helper ? edge : outside + (edge - outside) * progress;
        pose.y = box.top - Math.sin(progress * Math.PI) * 30;
        pose.head = helper ? -12 : 6;
        if (helper && time === 1.8) pose.hand = { x: 43, y: -94 };
      } else if (time === 3) {
        pose.x = center - facing * 52 * actorScale;
        pose.lean = 28;
        pose.hand = stageToLocal(knot, pose, actorScale, facing);
      } else if (time <= 5.2) {
        pose.x = edge;
        pose.lean = time === 5.2 ? -8 : 12;
        pose.hand = stageToLocal(
          { x: center - facing * (box.width / 2 - 8), y: box.top },
          pose,
          actorScale,
          facing,
        );
      } else if (time <= 7.8) {
        pose.x = helper ? caughtX : center - facing * 50 * actorScale;
        pose.lean = helper
          ? time === 6.2
            ? 25
            : time === 7
              ? 50
              : caughtLean
          : 30;
        if (helper && time === 7.8) pose.y = caughtY;
        pose.hand = stageToLocal(knot, pose, actorScale, facing);
      } else if (time <= 12) {
        pose.x = helper ? caughtX : center - facing * 50 * actorScale;
        pose.lean = helper
          ? time === 9
            ? 62
            : time === 9.5
              ? 74
              : caughtLean
          : time >= 10.8
            ? 18
            : 30;
        if (helper) {
          pose.y = caughtY;
          const heldTip = stageToLocal(knot, pose, actorScale, facing);
          const dx = heldTip.x - ELF_RIG.capBase.x;
          const dy = heldTip.y - ELF_RIG.capBase.y;
          const baseDx = ELF_RIG.capTip.x - ELF_RIG.capBase.x;
          const baseDy = ELF_RIG.capTip.y - ELF_RIG.capBase.y;
          pose.capAngle = degrees(
            Math.atan2(dy, dx) - Math.atan2(baseDy, baseDx),
          );
          pose.capScale = Math.hypot(dx, dy) / Math.hypot(baseDx, baseDy);
          const capVector = rotate(
            { x: baseDx * pose.capScale, y: baseDy * pose.capScale },
            pose.capAngle,
          );
          const angles = armAngles(heldTip);
          const upper = rotate({ x: ELF_RIG.armLength, y: 0 }, angles.upper);
          const forearm = rotate(
            { x: ELF_RIG.armLength, y: 0 },
            angles.upper + angles.forearm,
          );
          const hand = localToStage(
            {
              x: ELF_RIG.shoulder.x + upper.x + forearm.x,
              y: ELF_RIG.shoulder.y + upper.y + forearm.y,
            },
            pose,
            actorScale,
            facing,
          );
          contacts.push({
            time,
            knot,
            hat: localToStage(
              { x: capVector.x, y: ELF_RIG.capBase.y + capVector.y },
              pose,
              actorScale,
              facing,
            ),
            hand,
          });
        }
        pose.hand =
          time >= 10.8 && !helper
            ? { x: 27, y: -26 }
            : stageToLocal(knot, pose, actorScale, facing);
      } else if (time === 13.2) {
        pose.x = helper ? caughtX : home;
        pose.lean = helper ? -10 : 0;
        pose.head = helper ? 8 : -10;
      } else if (time <= 15.6) {
        pose.x = helper ? caughtX : home;
        pose.lean = time === 14.8 ? (helper ? 0 : 12) : time === 15.6 ? 22 : 0;
        pose.hand = helper
          ? { x: 30, y: -66 }
          : time === 14.8
            ? { x: 46, y: -83 }
            : { x: 31, y: -26 };
        pose.head = helper ? -8 : 6;
      } else {
        const progress = (time - 15.6) / 2.4;
        const start = helper ? caughtX : home;
        const exit = direction === 1 ? width + 100 : -100;
        pose.x = start + (exit - start) * progress;
        pose.y = box.top - (time === 16.4 ? 8 : 0);
        pose.opacity = time === 18 ? 0 : 1;
        pose.lean = -6;
      }
      if (isMobile) pose.head *= 0.75;
      return pose;
    });
    const selector = `[data-gift-elf="${actor}"]`;
    add(
      selector,
      poses.map((p) =>
        frame(p.time, {
          transform: `translate(${p.x}px, ${p.y}px) scale(${actorScale * (p.time >= 16.4 ? direction : facing)}, ${actorScale}) rotate(${p.lean}deg)`,
          opacity: p.opacity,
        }),
      ),
    );
    add(
      `${selector} [data-elf-upper-arm]`,
      poses.map((p) =>
        frame(p.time, { transform: `rotate(${armAngles(p.hand).upper}deg)` }),
      ),
    );
    add(
      `${selector} [data-elf-forearm]`,
      poses.map((p) =>
        frame(p.time, { transform: `rotate(${armAngles(p.hand).forearm}deg)` }),
      ),
    );
    add(
      `${selector} [data-elf-head]`,
      poses.map((p) => frame(p.time, { transform: `rotate(${p.head}deg)` })),
    );
    add(
      `${selector} [data-elf-cap]`,
      poses.map((p) =>
        frame(p.time, {
          transform: `rotate(${p.capAngle}deg) scale(${p.capScale})`,
        }),
      ),
    );
    for (let leg = 0; leg < 2; leg++) {
      const walking = [
        0, 0.6, 1.2, 1.8, 2.4, 3, 4.4, 5.2, 6.2, 7, 15.6, 16, 16.4, 16.8, 17.2,
        17.6, 18,
      ];
      add(
        `${selector} [data-elf-leg="${leg}"]`,
        walking.map((time, i) =>
          frame(time, {
            transform: `rotate(${time === 7 || time === 15.6 || time === 18 ? 0 : (i % 2 ? 1 : -1) * (isMobile ? 9 : 13) * (leg ? -1 : 1)}deg)`,
          }),
        ),
      );
    }
    if (helper) {
      add(`${selector} [data-elf-bow]`, [
        frame(0, { opacity: 0 }),
        frame(12, { opacity: 0 }),
        frame(12.15, { opacity: 1 }),
        frame(18, { opacity: 1 }),
      ]);
    } else {
      add(`${selector} [data-elf-reel]`, [
        frame(0, { opacity: 1, transform: 'rotate(0deg)' }),
        frame(3, { opacity: 1, transform: 'rotate(180deg)' }),
        frame(7, { opacity: 1, transform: 'rotate(720deg)' }),
        frame(10, { opacity: 1, transform: 'rotate(720deg)' }),
        frame(14, { opacity: 1, transform: 'rotate(1080deg)' }),
        frame(18, { opacity: 1, transform: 'rotate(1080deg)' }),
      ]);
    }
  }
  for (let part = 0; part < 6; part++) {
    const start = part === 5 ? 6.2 : part < 2 ? 3 : part < 4 ? 4.4 : 5.2;
    const end = part === 5 ? 7 : part < 2 ? 4.4 : part < 4 ? 5.2 : 6.2;
    const release = part === 5 ? 10 : part < 2 ? 10.8 : part < 4 ? 11.3 : 11.8;
    const axis = part === 2 || part === 3 || part === 5 ? 'Y' : 'X';
    add(`[data-gift-ribbon="${part}"]`, [
      frame(0, { transform: `scale${axis}(0)`, opacity: 0 }),
      frame(start, { transform: `scale${axis}(0)`, opacity: 1 }),
      frame(end, { transform: `scale${axis}(1)`, opacity: 1 }),
      frame(release, { transform: `scale${axis}(1)`, opacity: 1 }),
      frame(release + 0.8, { transform: `scale${axis}(0)`, opacity: 0 }),
      frame(18, { transform: `scale${axis}(0)`, opacity: 0 }),
    ]);
  }
  add('[data-gift-knot]', [
    frame(0, { opacity: 0, transform: 'scale(0)' }),
    frame(7, { opacity: 0, transform: 'scale(0)' }),
    frame(7.8, { opacity: 1, transform: 'scale(1)' }),
    frame(12, { opacity: 1, transform: 'scale(1)' }),
    frame(12.15, { opacity: 0, transform: 'scale(1)' }),
    frame(18, { opacity: 0, transform: 'scale(1)' }),
  ]);
  add('[data-gift-parcel]', [
    frame(0, { opacity: 0 }),
    frame(0.6, { opacity: 1 }),
    frame(16.4, { opacity: 1 }),
    frame(17.2, { opacity: 0 }),
    frame(18, { opacity: 0 }),
  ]);
  return {
    target,
    scale,
    knot,
    tracks,
    contacts,
    animationLimit: isMobile ? 24 : 32,
    frameLimit: isMobile ? 480 : 640,
  };
};
