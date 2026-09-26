import { animateCelebrationSnapshots } from '../../utils/celebration-snapshots';
import { BAT_RESTORE, BAT_SCENE_MS, type BatPlan } from './halloween-bat-plan';

interface BatElements {
  host: HTMLElement;
  copies: HTMLElement;
  actors: HTMLElement[];
}

/** Play one finite crosswind story without changing the live composer. */
export const animateBats = (
  plan: BatPlan,
  { host, copies, actors }: BatElements,
  onStop: () => void,
): (() => void) => {
  if (!plan.active || typeof host.animate !== 'function')
    return () => undefined;

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
  const anchors = [
    ...plan.surfaces.map(({ target }) => target),
    ...(plan.composer ? [plan.composer] : []),
    ...(plan.perch ? [plan.perch] : []),
  ];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    observer.disconnect();
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
    const liveRecords = records.filter((record) => {
      if (host.contains(record.target)) return false;
      if (record.type !== 'childList') return true;
      const changed = [...record.addedNodes, ...record.removedNodes];
      /* React may attach or remove this decorative host without moving live UI. */
      return !changed.every((node) => node === host || host.contains(node));
    });
    if (
      anchors.some(
        ({ element }) =>
          !element.isConnected ||
          liveRecords.some(
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
    /* Fixed toast portals also enter/leave body. Only actual anchor movement
       makes an ancestor child-list change unsafe; measure once for that batch. */
    const mayShiftLayout = liveRecords.some(
      (record) =>
        record.type === 'childList' &&
        record.target instanceof Element &&
        anchors.some(({ element }) => record.target.contains(element)),
    );
    if (
      mayShiftLayout &&
      anchors.some(({ element, rect }) => {
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
      { duration: BAT_SCENE_MS, fill: 'both' },
    );
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };

  try {
    plan.actors.forEach((bat, index) => {
      const actor = actors[index];
      if (!actor) throw new Error('Missing bat actor');
      animate(actor, bat.frames);
      Object.entries(bat.parts).forEach(([part, frames]) => {
        const artwork = actor.querySelector(`[data-bat-part="${part}"]`);
        if (!artwork) throw new Error('Missing bat artwork');
        animate(artwork, frames);
      });
    });
    stopSnapshots = animateCelebrationSnapshots(
      plan.surfaces.map(({ target }) => target),
      copies,
      {
        durationMs: BAT_SCENE_MS,
        hideAt: (index) => plan.surfaces[index].entry,
        restoreAt: BAT_RESTORE,
        startTime,
        onStop: stop,
        frames: (_rect, index) => plan.surfaces[index].frames,
        decorateCopy: (copy, index) => {
          copy.dataset.batSurface = String(index);
          copy.style.transformOrigin = plan.surfaces[index].origin;
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
    events.forEach((event) =>
      document.addEventListener(event, interrupt, true),
    );
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, BAT_SCENE_MS);
  } catch {
    stop();
  }
  return stop;
};
