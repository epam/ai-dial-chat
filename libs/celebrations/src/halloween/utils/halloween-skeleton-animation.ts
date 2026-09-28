import {
  SKELETON_ANIMATION_LIMIT,
  SKELETON_FRAME_LIMIT,
  SKELETON_MS,
  type SkeletonActorTracks,
  type SkeletonPlan,
} from './halloween-skeleton-plan';

/** One finite clock; the measured composer is observed, never animated. */
export const animateSkeletons = (
  plan: SkeletonPlan,
  host: HTMLElement,
  onStop: () => void,
): (() => void) => {
  const animations: Animation[] = [];
  let stopped = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const { anchors } = plan;
  const events = [
    'pointerdown',
    'keydown',
    'focusin',
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
    resize.disconnect();
    animations.forEach((animation) => animation.cancel());
    events.forEach((name) =>
      document.removeEventListener(name, interrupt, true),
    );
    window.removeEventListener('resize', stop);
    onStop();
  };
  const interrupt = (event: Event) => {
    if (event.type === 'visibilitychange' && !document.hidden) return;
    if (
      event.type === 'scroll' &&
      event.target instanceof Node &&
      host.contains(event.target)
    )
      return;
    stop();
  };
  const observer = new MutationObserver((records) => {
    const relevant = records.filter(
      (record) =>
        !host.contains(record.target) &&
        !(
          record.type === 'childList' &&
          [...record.addedNodes, ...record.removedNodes].every(
            (node) => node === host || host.contains(node),
          )
        ),
    );
    if (
      anchors.some(
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
    /* An ancestor child change (e.g. a toast) only justifies one recheck. */
    if (
      relevant.some(
        (record) =>
          record.type === 'childList' &&
          record.target instanceof Element &&
          anchors.some(({ element }) =>
            (record.target as Element).contains(element),
          ),
      ) &&
      anchors.some(({ element, rect }) => {
        const current = element.getBoundingClientRect();
        return (['left', 'top', 'width', 'height'] as const).some(
          (axis) => Math.abs(current[axis] - rect[axis]) > 0.5,
        );
      })
    )
      stop();
  });
  const seen = new WeakSet<Element>();
  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const target = anchors.find(({ element }) => element === entry.target),
        box = entry.borderBoxSize?.[0];
      if (
        target &&
        ((box &&
          (Math.abs(box.inlineSize - target.rect.width) > 0.5 ||
            Math.abs(box.blockSize - target.rect.height) > 0.5)) ||
          (!box && seen.has(entry.target)))
      ) {
        stop();
        return;
      }
      seen.add(entry.target);
    }
  });
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  const animate = (selector: string, keyframes: Keyframe[]) => {
    const element = host.querySelector(selector);
    if (
      !element ||
      keyframes.length > SKELETON_FRAME_LIMIT ||
      animations.length >= SKELETON_ANIMATION_LIMIT
    )
      throw new Error('Skeleton artwork or animation budget unavailable');
    const animation = element.animate(keyframes, {
      duration: SKELETON_MS,
      fill: 'both',
    });
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  const actor = (name: string, tracks: SkeletonActorTracks) => {
    const selector = `[data-skeleton-actor="${name}"]`;
    animate(selector, tracks.root);
    animate(`${selector} [data-skeleton-facing]`, tracks.facing);
    Object.entries(tracks.parts).forEach(([part, frames]) =>
      animate(`${selector} [data-skeleton-part="${part}"]`, frames),
    );
  };
  try {
    actor('showman', plan.showman);
    actor('partner', plan.partner);
    animate('[data-skeleton-free-skull]', plan.skull.root);
    animate('[data-skeleton-free-skull] [data-skeleton-turn]', plan.skull.turn);
    animate(
      '[data-skeleton-free-skull] [data-skeleton-part="face"]',
      plan.skull.face,
    );
    if (plan.ledge) animate('[data-skeleton-ledge]', plan.outline);
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
        'disabled',
        'aria-expanded',
      ],
    });
    anchors.forEach(({ element }) =>
      resize.observe(element, { box: 'border-box' }),
    );
    events.forEach((name) => document.addEventListener(name, interrupt, true));
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, SKELETON_MS);
  } catch {
    stop();
  }
  return stop;
};
