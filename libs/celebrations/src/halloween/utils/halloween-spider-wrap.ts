import { HalloweenSpiderMood } from '../types/halloween';
import {
  getHalloweenSpiderDangleTransform,
  type HalloweenSpiderDanglePose,
} from './halloween';

interface Point {
  x: number;
  y: number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** One silk strand across the pumpkin, in the pumpkin's 160×160 viewBox. */
export interface HalloweenSilkStrand {
  d: string;
  from: Point;
  control: Point;
  to: Point;
}

/* The pumpkin body is close to this ellipse in `HalloweenPumpkin`'s viewBox. */
const BODY = { cx: 80.5, cy: 89, rx: 66, ry: 51 };
/* Strand ends as heights on the ellipse (-1 top, 1 bottom), start side
   first. Starts alternate sides, so every pair crosses like a real wrap. */
const STRAND_LEVELS: [number, number][] = [
  [-0.8, -0.2],
  [-0.85, -0.3],
  [-0.55, 0.1],
  [-0.6, 0.05],
  [-0.25, 0.45],
  [-0.3, 0.35],
  [0.1, 0.75],
  [0.05, 0.7],
  [0.45, 0.85],
  [0.5, 0.85],
];

const edge = (level: number, side: number): Point => ({
  x: BODY.cx + side * BODY.rx * Math.sqrt(1 - level * level) * 0.96,
  y: BODY.cy + level * BODY.ry,
});

/** The silk the spider spins, drawn over the pumpkin in its own viewBox. */
export const HALLOWEEN_PUMPKIN_SILK = {
  viewBox: 160,
  cocoon: BODY,
  strands: STRAND_LEVELS.map(([start, end], index): HalloweenSilkStrand => {
    const side = index % 2 === 0 ? -1 : 1;
    const from = edge(start, side);
    const to = edge(end, -side);
    /* Bowed downwards, as a thread pulled round a sphere looks from the front. */
    const control = {
      x: BODY.cx,
      y:
        (from.y + to.y) / 2 +
        BODY.ry * 0.45 * (1 - Math.abs((start + end) / 2)),
    };
    return {
      from,
      control,
      to,
      d: `M${from.x.toFixed(1)} ${from.y.toFixed(1)}Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
    };
  }),
};

/* Story beats in ms. */
const DESCEND_TO = 2600;
const WRAP_FROM = 3000;
const STRAND_SLOT = 1050;
const STRAND_REACH = 250;
const WRAP_TO = WRAP_FROM + STRAND_SLOT * HALLOWEEN_PUMPKIN_SILK.strands.length;
const SETTLE_TO = WRAP_TO + 400;
const SHAKE_FROM = SETTLE_TO + 200;
const SHAKE_TO = SHAKE_FROM + 800;
const STARTLE_AT = SHAKE_FROM + 150;
const CLIMB_FROM = STARTLE_AT + 150;
const CLIMB_TO = CLIMB_FROM + 600;
const SILK_FADE_FROM = SHAKE_FROM + 400;
const SILK_FADE_TO = SILK_FADE_FROM + 800;
const STORY_MS = CLIMB_TO + 600;
const SAMPLE_MS = 50;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (from: number, to: number, time: number) => {
  const progress = clamp01((time - from) / (to - from));
  return progress * progress * (3 - 2 * progress);
};
const lerp = (from: Point, to: Point, progress: number): Point => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
});
const bezier = ({ from, control, to }: HalloweenSilkStrand, t: number): Point =>
  lerp(lerp(from, control, t), lerp(control, to, t), t);

export interface HalloweenSpiderWrapGeometry {
  /** Screen point the thread hangs from: the resting spider's head. */
  pivot: Point;
  /** Rendered spider height, for placing its body rather than its head. */
  spiderHeight: number;
  /** Rendered pumpkin box, which the silk viewBox fills. */
  pumpkin: Box;
}

export interface HalloweenSpiderWrapPlan {
  durationMs: number;
  dangle: Keyframe[];
  thread: Keyframe[];
  strands: Keyframe[][];
  cocoon: Keyframe[];
  silk: Keyframe[];
  pumpkin: Keyframe[];
  /** Mood changes as `[ms, mood]`, in order. */
  moods: [number, HalloweenSpiderMood][];
  /** Where the spider is at `ms`, so an interrupted story reels in from there. */
  poseAt: (ms: number) => HalloweenSpiderDanglePose;
}

/** Precompute the whole wrap on one timeline; nothing is measured while it plays. */
export const buildHalloweenSpiderWrapPlan = ({
  pivot,
  spiderHeight,
  pumpkin,
}: HalloweenSpiderWrapGeometry): HalloweenSpiderWrapPlan => {
  const scale = pumpkin.width / HALLOWEEN_PUMPKIN_SILK.viewBox;
  const toScreen = ({ x, y }: Point): Point => ({
    x: pumpkin.left + x * scale,
    y: pumpkin.top + y * scale,
  });
  /* The thread holds the head; the body hangs this far below it. */
  const bodyDrop = spiderHeight * 0.28;
  const rest = { x: pivot.x, y: pivot.y + bodyDrop };
  const top = toScreen({ x: BODY.cx, y: BODY.cy - BODY.ry - 6 });
  const strands = HALLOWEEN_PUMPKIN_SILK.strands.map((strand) => ({
    from: toScreen(strand.from),
    control: toScreen(strand.control),
    to: toScreen(strand.to),
    d: strand.d,
  }));

  const bodyAt = (ms: number): Point => {
    if (ms < WRAP_FROM) return lerp(rest, top, smooth(0, DESCEND_TO, ms));
    if (ms < WRAP_TO) {
      const index = Math.floor((ms - WRAP_FROM) / STRAND_SLOT);
      const slot = WRAP_FROM + index * STRAND_SLOT;
      const strand = strands[index];
      const previous = index === 0 ? top : strands[index - 1].to;
      if (ms < slot + STRAND_REACH)
        return lerp(
          previous,
          strand.from,
          smooth(slot, slot + STRAND_REACH, ms),
        );
      return bezier(
        strand,
        smooth(slot + STRAND_REACH, slot + STRAND_SLOT, ms),
      );
    }
    if (ms < CLIMB_FROM) {
      const settled = lerp(
        strands[strands.length - 1].to,
        top,
        smooth(WRAP_TO, SETTLE_TO, ms),
      );
      /* A startled hop before it flees up the thread. */
      const hop =
        smooth(STARTLE_AT, STARTLE_AT + 80, ms) *
        (1 - smooth(STARTLE_AT + 80, CLIMB_FROM, ms)) *
        spiderHeight *
        0.3;
      return { x: settled.x, y: settled.y - hop };
    }
    return lerp(top, rest, smooth(CLIMB_FROM, CLIMB_TO, ms));
  };

  const poseAt = (ms: number): HalloweenSpiderDanglePose => {
    const body = bodyAt(Math.max(0, Math.min(STORY_MS, ms)));
    const dx = body.x - pivot.x;
    const dy = body.y - bodyDrop - pivot.y;
    const depth = Math.hypot(dx, dy);
    /* Under half a pixel of thread the spider is simply on its perch. */
    if (depth < 0.5) return { depth: 0, angle: 0 };
    return { depth, angle: (Math.atan2(-dx, dy) * 180) / Math.PI };
  };

  const at = (ms: number) => ms / STORY_MS;
  const times = Array.from(
    { length: Math.floor(STORY_MS / SAMPLE_MS) + 1 },
    (_, index) => Math.min(STORY_MS, index * SAMPLE_MS),
  );
  const poses = times.map((ms) => ({ offset: at(ms), pose: poseAt(ms) }));

  return {
    durationMs: STORY_MS,
    dangle: poses.map(({ offset, pose }) => ({
      offset,
      transform: getHalloweenSpiderDangleTransform(pose),
    })),
    thread: poses.map(({ offset, pose }) => ({
      offset,
      transform: `scaleY(${pose.depth.toFixed(2)})`,
    })),
    /* Each strand is spun exactly while the spider walks along it. */
    strands: strands.map((_, index) => {
      const spinFrom = WRAP_FROM + index * STRAND_SLOT + STRAND_REACH;
      const spinTo = WRAP_FROM + (index + 1) * STRAND_SLOT;
      return [
        { offset: 0, strokeDashoffset: 1 },
        { offset: at(spinFrom), strokeDashoffset: 1 },
        { offset: at(spinTo), strokeDashoffset: 0 },
        { offset: 1, strokeDashoffset: 0 },
      ];
    }),
    cocoon: [
      { offset: 0, opacity: 0 },
      { offset: at(WRAP_FROM), opacity: 0 },
      { offset: at(WRAP_TO), opacity: 0.42 },
      { offset: 1, opacity: 0.42 },
    ],
    silk: [
      { offset: 0, opacity: 1, transform: 'scale(1)' },
      { offset: at(SILK_FADE_FROM), opacity: 1, transform: 'scale(1)' },
      { offset: at(SILK_FADE_TO), opacity: 0, transform: 'scale(1.12)' },
      { offset: 1, opacity: 0, transform: 'scale(1.12)' },
    ],
    pumpkin: [
      { offset: 0, transform: 'none' },
      { offset: at(SHAKE_FROM), transform: 'none' },
      {
        offset: at(SHAKE_FROM + 100),
        transform: 'rotate(-8deg) translateY(-4px)',
      },
      {
        offset: at(SHAKE_FROM + 250),
        transform: 'rotate(7deg) translateY(-2px)',
      },
      { offset: at(SHAKE_FROM + 400), transform: 'rotate(-5deg)' },
      { offset: at(SHAKE_FROM + 550), transform: 'rotate(3deg)' },
      { offset: at(SHAKE_FROM + 700), transform: 'rotate(-1deg)' },
      { offset: at(SHAKE_TO), transform: 'none' },
      { offset: 1, transform: 'none' },
    ],
    moods: [
      [WRAP_FROM, HalloweenSpiderMood.Wrapping],
      [WRAP_TO, HalloweenSpiderMood.Idle],
      [STARTLE_AT, HalloweenSpiderMood.Startled],
      [CLIMB_TO + 300, HalloweenSpiderMood.Idle],
    ],
    poseAt,
  };
};

export interface HalloweenSpiderWrapElements {
  dangle: Element;
  thread: Element;
  strands: Element[];
  cocoon: Element;
  silk: Element;
  pumpkin: Element;
}

export interface HalloweenSpiderWrapCallbacks {
  onMood: (mood: HalloweenSpiderMood) => void;
  /** Called once when the story finishes on its own. */
  onEnd: () => void;
}

export interface HalloweenSpiderWrapPlayback {
  /** Milliseconds into the story. */
  elapsed: () => number;
  /** Stops the story at once; the caller reels the spider in. */
  cancel: () => void;
  /** Fades the silk away quickly, then stops the story. */
  abort: () => void;
}

/** Play every part of the wrap on one clock. */
export const playHalloweenSpiderWrap = (
  plan: HalloweenSpiderWrapPlan,
  elements: HalloweenSpiderWrapElements,
  { onMood, onEnd }: HalloweenSpiderWrapCallbacks,
): HalloweenSpiderWrapPlayback => {
  const timing = { duration: plan.durationMs, fill: 'both' as const };
  const animations = [
    elements.dangle.animate(plan.dangle, timing),
    elements.thread.animate(plan.thread, timing),
    ...elements.strands.map((strand, index) =>
      strand.animate(plan.strands[index], timing),
    ),
    elements.cocoon.animate(plan.cocoon, timing),
    elements.silk.animate(plan.silk, timing),
    elements.pumpkin.animate(plan.pumpkin, timing),
  ];
  const [clock] = animations;
  const timers = plan.moods.map(([ms, mood]) =>
    window.setTimeout(() => onMood(mood), ms),
  );
  let fade: Animation | undefined;
  const cancel = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    clock.onfinish = null;
    animations.forEach((animation) => animation.cancel());
    fade?.cancel();
  };
  clock.onfinish = () => {
    cancel();
    onEnd();
  };
  return {
    elapsed: () => Number(clock.currentTime ?? 0),
    cancel,
    abort: () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      clock.onfinish = null;
      /* The spider and pumpkin stop now; only the silk lingers to fade. */
      animations.slice(0, 2).forEach((animation) => animation.cancel());
      animations[animations.length - 1].cancel();
      fade = elements.silk.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 250,
        fill: 'forwards',
      });
      fade.onfinish = cancel;
    },
  };
};
