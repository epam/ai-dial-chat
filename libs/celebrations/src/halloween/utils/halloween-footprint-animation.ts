import { animateCelebrationSnapshots } from '../../utils/celebration-snapshots';
import {
  FOOTPRINT_ANIMATION_LIMIT,
  FOOTPRINT_KEYFRAME_LIMIT,
  FOOTPRINT_RESTORE,
  FOOTPRINT_HIDE,
  FOOTPRINT_MS,
  type FootprintPlan,
} from './halloween-footprint-plan';

interface FootprintElements {
  host: HTMLElement;
  copies: HTMLElement;
  prints: Element[];
  surface: HTMLElement | null;
  face: HTMLElement;
}

/** Play bounded, synchronized artwork and snapshots; stopping restores every original. */
export const animateFootprints = (
  plan: FootprintPlan,
  { host, copies, prints, surface, face }: FootprintElements,
  onStop: () => void,
): (() => void) => {
  const animations: Animation[] = [];
  let stopSnapshots: (() => void) | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  const events = [
    'pointerdown',
    'focusin',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'visibilitychange',
  ];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    observer.disconnect();
    resizeObserver.disconnect();
    stopSnapshots?.();
    animations.forEach((animation) => animation.cancel());
    events.forEach((event) =>
      document.removeEventListener(event, interrupt, true),
    );
    window.removeEventListener('resize', stop);
    onStop();
  };
  const interrupt = (event: Event) => {
    if (
      event.type === 'scroll' &&
      event.target instanceof Node &&
      host.contains(event.target)
    )
      return;
    if (event.type === 'visibilitychange' && !document.hidden) return;
    stop();
  };
  const observer = new MutationObserver((records) => {
    const relevant = records.filter((record) => {
      if (host.contains(record.target)) return false;
      if (record.type !== 'childList') return true;
      return ![...record.addedNodes, ...record.removedNodes].every(
        (node) => node === host || host.contains(node),
      );
    });
    if (
      plan.anchors.some(
        ({ element }) =>
          !element.isConnected ||
          relevant.some(
            (record) =>
              element.contains(record.target) ||
              (record.type === 'attributes' &&
                record.target instanceof Element &&
                record.target.contains(element)),
          ),
      )
    ) {
      stop();
      return;
    }
    /* A body-level toast mutation only justifies one geometry revalidation,
       never unconditional cancellation or a per-frame measurement loop. */
    if (
      relevant.some(
        (record) =>
          record.type === 'childList' &&
          record.target instanceof Element &&
          plan.anchors.some(({ element }) =>
            (record.target as Element).contains(element),
          ),
      )
    ) {
      if (
        plan.anchors.some(({ element, rect }) => {
          const current = element.getBoundingClientRect();
          return (['left', 'top', 'width', 'height'] as const).some(
            (axis) => Math.abs(current[axis] - rect[axis]) > 0.5,
          );
        })
      )
        stop();
    }
  });
  const resized = new WeakSet<Element>();
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const target = plan.anchors.find(
        ({ element }) => element === entry.target,
      );
      const box = entry.borderBoxSize?.[0];
      if (
        target &&
        ((box &&
          (Math.abs(box.inlineSize - target.rect.width) > 0.5 ||
            Math.abs(box.blockSize - target.rect.height) > 0.5)) ||
          (!box && resized.has(entry.target)))
      ) {
        stop();
        return;
      }
      resized.add(entry.target);
    }
  });
  const animate = (element: Element | undefined | null, frames: Keyframe[]) => {
    if (
      !element ||
      frames.length > FOOTPRINT_KEYFRAME_LIMIT ||
      animations.length + (plan.card ? 2 : 0) >= FOOTPRINT_ANIMATION_LIMIT
    )
      throw new Error('Footprint animation budget or artwork unavailable');
    const animation = element.animate(frames, {
      duration: FOOTPRINT_MS,
      fill: 'both',
    });
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  try {
    plan.prints.forEach((print, index) => animate(prints[index], print.frames));
    if (plan.card || plan.ledge) animate(surface, plan.surfaceFrames);
    animate(face, plan.faceFrames);
    Object.entries(plan.faceParts).forEach(([part, frames]) =>
      animate(face.querySelector(`[data-footprint-part="${part}"]`), frames),
    );
    stopSnapshots = animateCelebrationSnapshots(
      plan.card ? [plan.card] : [],
      copies,
      {
        durationMs: FOOTPRINT_MS,
        hideAt: FOOTPRINT_HIDE,
        restoreAt: FOOTPRINT_RESTORE,
        startTime,
        onStop: stop,
        frames: () => plan.surfaceFrames,
        decorateCopy: (copy) => {
          copy.dataset.footprintCard = 'true';
          copy.style.transformOrigin = '50% 100%';
        },
      },
    );
    if (stopped) {
      stopSnapshots();
      return stop;
    }
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'dir',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-expanded',
        'disabled',
        'aria-disabled',
        'href',
      ],
    });
    plan.anchors.forEach(({ element }) =>
      resizeObserver.observe(element, { box: 'border-box' }),
    );
    events.forEach((event) =>
      document.addEventListener(event, interrupt, true),
    );
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, FOOTPRINT_MS);
  } catch {
    stop();
  }
  return stop;
};
