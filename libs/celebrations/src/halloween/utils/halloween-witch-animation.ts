import { animateCelebrationSnapshots } from '../../utils/celebration-snapshots';
import {
  WITCH_ANIMATION_LIMIT,
  WITCH_KEYFRAME_LIMIT,
  WITCH_RESTORE,
  WITCH_SCENE_MS,
  type WitchPlan,
} from './halloween-witch-plan';

interface WitchElements {
  host: HTMLElement;
  copies: HTMLElement;
  actors: HTMLElement[];
  spells: Element[];
  frog: SVGSVGElement;
}

/** Play bounded, synchronized artwork and snapshots; stopping restores every original. */
export const animateWitches = (
  plan: WitchPlan,
  { host, copies, actors, spells, frog }: WitchElements,
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
      frames.length > WITCH_KEYFRAME_LIMIT ||
      animations.length + plan.buttons.length * 2 >= WITCH_ANIMATION_LIMIT
    )
      throw new Error('Witch animation budget or artwork unavailable');
    const animation = element.animate(frames, {
      duration: WITCH_SCENE_MS,
      fill: 'both',
    });
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  try {
    plan.actors.forEach((actor, index) => {
      const element = actors[index];
      animate(element, actor.frames);
      Object.entries(actor.parts).forEach(([part, frames]) =>
        animate(element?.querySelector(`[data-witch-part="${part}"]`), frames),
      );
    });
    plan.spells.forEach((spell, index) => animate(spells[index], spell.frames));
    stopSnapshots = animateCelebrationSnapshots(
      plan.buttons.map(({ target }) => target),
      copies,
      {
        durationMs: WITCH_SCENE_MS,
        hideAt: (index) => plan.buttons[index].entry,
        restoreAt: WITCH_RESTORE,
        startTime,
        onStop: stop,
        frames: (_rect, index) => plan.buttons[index].frames,
        decorateCopy: (copy, index) => {
          const button = plan.buttons[index];
          copy.dataset.witchButton = String(index);
          copy.style.overflow = 'visible';
          copy.style.transformOrigin = '50% 100%';
          const features = frog.cloneNode(true) as SVGSVGElement;
          features.removeAttribute('hidden');
          features.dataset.witchFrog = 'true';
          Object.assign(features.style, {
            position: 'absolute',
            left: '-12px',
            top: '-17px',
            width: `${button.target.rect.width + 24}px`,
            height: `${button.target.rect.height + 34}px`,
            pointerEvents: 'none',
          });
          copy.appendChild(features);
          animate(features, button.frogFrames);
          animate(
            features.querySelector('[data-witch-frog-legs]'),
            button.legFrames,
          );
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
    deadline = setTimeout(stop, WITCH_SCENE_MS);
  } catch {
    stop();
  }
  return stop;
};
