import type { CelebrationAnchors } from '../../models/celebration';
import { getCelebrationHistoryRows } from '../../utils/celebration-history';
import {
  animateCelebrationSnapshots,
  type CelebrationSnapshotTarget,
} from '../../utils/celebration-snapshots';
import { findWelcomeRegion, queryAllOrNone } from '../../utils/host-anchors';
import type { HalloweenSpiderDrop } from './halloween';

/** Reject targets that would interfere with a live control or sit behind a clip. */
const visibleTarget = (
  element: HTMLElement | null,
): CelebrationSnapshotTarget | null => {
  if (
    !element ||
    element.contains(document.activeElement) ||
    element.closest('[inert], [aria-hidden="true"]') ||
    element.matches('[aria-expanded="true"], :disabled') ||
    element.querySelector('[aria-expanded="true"]') ||
    element.getElementsByTagName('*').length >= 1500
  )
    return null;
  const rect = element.getBoundingClientRect();
  const viewport = document.documentElement;
  if (
    rect.width < 12 ||
    rect.height < 12 ||
    rect.left < 0 ||
    rect.top < 60 ||
    rect.right > viewport.clientWidth ||
    rect.bottom > viewport.clientHeight
  )
    return null;
  for (
    let parent: HTMLElement | null = element;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    )
      return null;
    if (
      /(auto|scroll|hidden|clip)/.test(
        `${style.overflow} ${style.overflowX} ${style.overflowY}`,
      )
    ) {
      const clip = parent.getBoundingClientRect();
      if (
        rect.left < clip.left ||
        rect.right > clip.right ||
        rect.top < clip.top ||
        rect.bottom > clip.bottom
      )
        return null;
    }
  }
  return { element, rect };
};

const shuffled = <T>(values: readonly T[]): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/** Existing public composer classes and the welcome region give us safe, host-owned targets. */
export const getSpiderTheftTargets = (
  anchors: CelebrationAnchors,
): CelebrationSnapshotTarget[] => {
  const byClass = (className?: string) => (className ? `.${className}` : null);
  const wrapper = queryAllOrNone<HTMLElement>(byClass(anchors.composer)).find(
    (element) => !element.closest('[inert], [aria-hidden="true"]'),
  );
  const welcome = findWelcomeRegion(wrapper, anchors);
  const candidates = [
    welcome?.querySelector<HTMLElement>('h1') ?? null,
    (wrapper &&
      queryAllOrNone<HTMLElement>(
        byClass(anchors.composerModelSelector),
        wrapper,
      )[0]) ??
      null,
    (wrapper &&
      queryAllOrNone<HTMLElement>(
        byClass(anchors.composerAddCluster),
        wrapper,
      )[0]) ??
      null,
  ]
    .map(visibleTarget)
    .filter((target): target is CelebrationSnapshotTarget => target !== null);
  const history = shuffled(getCelebrationHistoryRows(anchors));
  const selection = [
    ...shuffled(candidates).slice(0, history.length ? 2 : 3),
    ...history.slice(0, candidates.length ? 1 : 3),
  ];
  return selection.filter(
    (target, index) =>
      !selection
        .slice(0, index)
        .some(
          (other) =>
            other.element.contains(target.element) ||
            target.element.contains(other.element),
        ),
  );
};

export interface SpiderTheftPlan {
  x: number;
  depth: number;
  size: number;
  grab: number;
  leave: number;
  exitDistance: number;
  target?: CelebrationSnapshotTarget;
}

export const SPIDER_THEFT_MS = 11000;

/** Keep nine varied drops; up to three carriers land precisely above their prizes. */
export const buildSpiderTheftPlans = (
  targets: readonly CelebrationSnapshotTarget[],
  drops: readonly HalloweenSpiderDrop[],
  width: number,
  height: number,
): SpiderTheftPlan[] =>
  drops.map((drop, index) => {
    const variables = drop.style as Record<string, string>;
    const target = index % 3 === 0 ? targets[index / 3] : undefined;
    const size = 32 * Number.parseFloat(variables['--spider-scale']);
    const depth = target
      ? target.rect.top - 8
      : (height * Number.parseFloat(variables['--spider-depth'])) / 100;
    const stagger = Number.parseFloat(variables['--spider-delay']) / 15;
    return {
      x: target
        ? target.rect.left + target.rect.width / 2
        : (width * Number.parseFloat(variables['--spider-x'])) / 100,
      depth,
      size,
      grab: 0.26 + stagger,
      leave: 0.76 + stagger,
      exitDistance: Math.max(
        depth + size + 30,
        target ? target.rect.bottom + 40 : 0,
      ),
      target,
    };
  });

export interface SpiderTheftActor {
  carrier: HTMLElement;
  cargo: HTMLElement;
  web: SVGElement | null;
}

/** Carrier and cargo share a parent transform, so the spider cannot leave its prize behind. */
export const animateSpiderTheft = (
  plans: readonly SpiderTheftPlan[],
  actors: readonly SpiderTheftActor[],
  host: HTMLElement,
  onStop?: () => void,
): (() => void) => {
  const carried = plans.flatMap((plan, index) =>
    plan.target ? [{ plan, actor: actors[index], target: plan.target }] : [],
  );
  if (!carried.length || typeof host.animate !== 'function')
    return () => undefined;
  const animations: Animation[] = [];
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  const stopActors = () => {
    animations.forEach((animation) => animation.cancel());
    onStop?.();
  };
  try {
    plans.forEach((plan, index) => {
      const animate = (element: Element, frames: Keyframe[]) => {
        const animation = element.animate(
          frames.map((frame) => ({ ...frame, easing: 'ease-in-out' })),
          { duration: SPIDER_THEFT_MS, fill: 'both' },
        );
        animations.push(animation);
        if (startTime !== undefined) animation.startTime = startTime;
      };
      const away = `translateY(${-plan.exitDistance}px)`;
      animate(actors[index].carrier, [
        { offset: 0, transform: away, opacity: 1 },
        { offset: plan.grab - 0.22, transform: away, opacity: 1 },
        { offset: plan.grab, transform: 'translateY(0px)', opacity: 1 },
        { offset: plan.grab + 0.12, transform: 'translateY(0px)', opacity: 1 },
        { offset: plan.leave, transform: away, opacity: 1 },
        { offset: 1, transform: away, opacity: 0 },
      ]);
      const web = actors[index].web;
      if (web) {
        animate(web, [
          { offset: 0, opacity: 0 },
          { offset: plan.grab, opacity: 1 },
          { offset: 1, opacity: 1 },
        ]);
        const strands = web.querySelectorAll('[data-silk-strand]');
        strands.forEach((strand, strandIndex) => {
          const begin = plan.grab + (strandIndex / strands.length) * 0.065;
          animate(strand, [
            { offset: 0, strokeDashoffset: 1 },
            { offset: begin, strokeDashoffset: 1 },
            { offset: begin + 0.035, strokeDashoffset: 0 },
            { offset: 1, strokeDashoffset: 0 },
          ]);
        });
      }
    });
  } catch {
    stopActors();
    return () => undefined;
  }
  return animateCelebrationSnapshots(
    carried.map(({ target }) => target),
    host,
    {
      durationMs: SPIDER_THEFT_MS,
      hideAt: (index) => carried[index].plan.grab + 0.1,
      restoreAt: 0.94,
      startTime,
      decorateCopy: (copy, index) =>
        carried[index].actor.cargo.appendChild(copy),
      frames: (_, index) => [
        { offset: 0, opacity: 0, transform: 'none' },
        {
          offset: carried[index].plan.grab + 0.09,
          opacity: 0,
          transform: 'none',
        },
        {
          offset: carried[index].plan.grab + 0.1,
          opacity: 1,
          transform: 'none',
        },
        { offset: 1, opacity: 1, transform: 'none' },
      ],
      onStop: stopActors,
    },
  );
};
