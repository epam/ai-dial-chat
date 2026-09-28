import { animateCelebrationSnapshots } from '../../utils/celebration-snapshots';
import { CAT_RESTORE, CAT_SCENE_MS, type CatPlan } from './halloween-cat-plan';

interface CatElements {
  host: HTMLElement;
  copies: HTMLElement;
  actor: HTMLElement;
  facing: HTMLElement;
}

/** Keep paws and borrowed buttons on one clock; any interruption restores the page. */
export const animateCat = (
  plan: CatPlan,
  { host, copies, actor, facing }: CatElements,
  onStop: () => void,
): (() => void) => {
  if (!plan.active || typeof host.animate !== 'function')
    return () => undefined;
  const animations: Animation[] = [];
  let stopCopies: (() => void) | undefined;
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
    stopCopies?.();
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
    const external = records.filter((record) => {
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
          external.some(
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
    /* A fixed toast leaving body does not invalidate the scene. Only ambiguous
       ancestor changes need a bounded geometry check, never a per-frame poll. */
    const mayShiftLayout = external.some(
      (record) =>
        record.type === 'childList' &&
        record.target instanceof Element &&
        plan.anchors.some(({ element }) => record.target.contains(element)),
    );
    if (
      mayShiftLayout &&
      plan.anchors.some(({ element, rect }) => {
        const current = element.getBoundingClientRect();
        return (['left', 'top', 'width', 'height'] as const).some(
          (axis) => Math.abs(current[axis] - rect[axis]) > 0.5,
        );
      })
    )
      stop();
  });
  const animate = (element: Element, frames: Keyframe[]) => {
    const animation = element.animate(
      frames.map((frame) => ({ easing: 'ease-in-out', ...frame })),
      { duration: CAT_SCENE_MS, fill: 'both' },
    );
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  try {
    animate(actor, plan.frames);
    animate(facing, plan.facing);
    Object.entries(plan.parts).forEach(([part, frames]) => {
      const element = actor.querySelector(`[data-cat-part="${part}"]`);
      if (!element) throw new Error('Missing cat articulation');
      animate(element, frames);
    });
    stopCopies = animateCelebrationSnapshots(
      plan.buttons.map(({ target }) => target),
      copies,
      {
        durationMs: CAT_SCENE_MS,
        hideAt: (index) => plan.buttons[index].entry,
        restoreAt: CAT_RESTORE,
        startTime,
        onStop: stop,
        frames: (_rect, index) => plan.buttons[index].frames,
        decorateCopy: (copy, index) => {
          copy.dataset.catPrize = String(index);
        },
      },
    );
    if (stopped) {
      stopCopies();
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
    events.forEach((event) =>
      document.addEventListener(event, interrupt, true),
    );
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, CAT_SCENE_MS);
  } catch {
    stop();
  }
  return stop;
};
