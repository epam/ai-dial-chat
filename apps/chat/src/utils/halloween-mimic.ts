import type { CelebrationSnapshotTarget } from './celebration-snapshots';
import { animateCelebrationSnapshots } from './celebration-snapshots';

export interface MimicPlan {
  targets: readonly CelebrationSnapshotTarget[];
  mouth: { x: number; y: number };
  grab: { x: number; y: number; width: number; height: number };
  length: number;
  angle: number;
}

/** Capture a neighboring pair as one bundle centered on the tongue tip. */
export const buildMimicPlan = (
  targets: readonly CelebrationSnapshotTarget[],
  stage: DOMRect,
): MimicPlan | null => {
  if (!targets.length) return null;
  const left = Math.min(...targets.map(({ rect }) => rect.left));
  const top = Math.min(...targets.map(({ rect }) => rect.top));
  const right = Math.max(...targets.map(({ rect }) => rect.right));
  const bottom = Math.max(...targets.map(({ rect }) => rect.bottom));
  const mouth = {
    x: stage.left + stage.width * 0.5,
    y: stage.top + stage.height * 0.62,
  };
  const grab = {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
  return {
    targets,
    mouth,
    grab,
    length: Math.hypot(grab.x - mouth.x, grab.y - mouth.y),
    angle: (Math.atan2(grab.y - mouth.y, grab.x - mouth.x) * 180) / Math.PI,
  };
};

const pull = [
  { offset: 0.28, amount: 1 },
  { offset: 0.33, amount: 1 },
  { offset: 0.43, amount: 0.65 },
  { offset: 0.57, amount: 0.02 },
  { offset: 0.585, amount: 0 },
];

/** One progress value drives the tongue, wrapping loop and each captured row. */
export const animateMimic = (
  plan: MimicPlan,
  host: HTMLElement,
  tongue: SVGElement,
  loop: SVGElement,
  onStop?: () => void,
  backGrip?: SVGElement,
): (() => void) => {
  if (
    typeof tongue.animate !== 'function' ||
    typeof host.animate !== 'function'
  )
    return () => undefined;
  const animations: Animation[] = [];
  const stopActors = () => {
    animations.forEach((animation) => animation.cancel());
    onStop?.();
  };
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  const travel = (x: number, y: number, amount: number) =>
    `translate(${(plan.mouth.x - x) * (1 - amount)}px, ${(plan.mouth.y - y) * (1 - amount)}px) scale(${amount})`;
  const animate = (element: SVGElement, frames: Keyframe[]) => {
    const animation = element.animate(
      frames.map((frame) => ({ ...frame, easing: 'ease-in-out' })),
      { duration: 8000, fill: 'both' },
    );
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  try {
    animate(tongue, [
      { offset: 0, opacity: 0, transform: 'scale(0)' },
      { offset: 0.13, opacity: 1, transform: 'scale(0)' },
      ...pull.map(({ offset, amount }) => ({
        offset,
        opacity: amount ? 1 : 0,
        transform: `scale(${amount})`,
      })),
      { offset: 1, opacity: 0, transform: 'scale(0)' },
    ]);
    const gripFrames: Keyframe[] = [
      { offset: 0, opacity: 0, transform: 'none' },
      { offset: 0.27, opacity: 0, transform: 'none' },
      ...pull.map(({ offset, amount }) => ({
        offset,
        opacity: amount ? 1 : 0,
        transform: travel(plan.grab.x, plan.grab.y, amount),
      })),
      { offset: 1, opacity: 0, transform: travel(plan.grab.x, plan.grab.y, 0) },
    ];
    animate(loop, gripFrames);
    if (backGrip) animate(backGrip, gripFrames);
    for (const grip of [backGrip, loop]) {
      grip
        ?.querySelectorAll<SVGElement>('[data-mimic-wrap]')
        .forEach((wrap) => {
          const isBack = wrap.dataset.mimicWrap === 'back';
          animate(wrap, [
            { offset: 0, strokeDashoffset: 1 },
            { offset: isBack ? 0.27 : 0.29, strokeDashoffset: 1 },
            { offset: isBack ? 0.3 : 0.33, strokeDashoffset: 0 },
            { offset: 1, strokeDashoffset: 0 },
          ]);
        });
    }
  } catch {
    stopActors();
    return () => undefined;
  }
  return animateCelebrationSnapshots(plan.targets, host, {
    durationMs: 8000,
    hideAt: 0.28,
    restoreAt: 0.94,
    startTime,
    frames: (rect, index) => {
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hidden = travel(x, y, 0);
      return [
        { offset: 0, opacity: 0, transform: 'none' },
        { offset: 0.27, opacity: 0, transform: 'none' },
        ...pull.map(({ offset, amount }) => ({
          offset,
          opacity: amount ? 1 : 0,
          transform: travel(x, y, amount),
        })),
        { offset: 0.71, opacity: 0, transform: hidden },
        {
          offset: 0.78,
          opacity: 1,
          transform: `translate(${plan.mouth.x - x + (index ? 24 : -24)}px, ${plan.mouth.y - y - 70}px) scale(0.35) rotate(${index ? -18 : 18}deg)`,
        },
        { offset: 0.94, opacity: 1, transform: 'none' },
        { offset: 0.98, opacity: 0, transform: 'none' },
        { offset: 1, opacity: 0, transform: 'none' },
      ];
    },
    onStop: stopActors,
  });
};
