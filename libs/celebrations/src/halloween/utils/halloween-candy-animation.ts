import {
  CANDY_FRAME_LIMIT,
  CANDY_MS,
  type CandyPlan,
} from './halloween-candy-plan';

/** One finite clock; no live host control is ever animated or mutated. */
export const animateCandy = (
  plan: CandyPlan,
  host: HTMLElement,
  onStop: () => void,
): (() => void) => {
  const animations: Animation[] = [];
  let stopped = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const anchors = plan.targets.surfaces;
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
    animations.forEach((a) => a.cancel());
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
      (r) =>
        !host.contains(r.target) &&
        !(
          r.type === 'childList' &&
          [...r.addedNodes, ...r.removedNodes].every(
            (n) => n === host || host.contains(n),
          )
        ),
    );
    if (
      anchors.some(
        ({ element }) =>
          !element.isConnected ||
          relevant.some(
            (r) =>
              element.contains(r.target) ||
              (r.type === 'attributes' &&
                r.target instanceof Element &&
                r.target.contains(element)),
          ),
      )
    ) {
      stop();
      return;
    }
    if (
      relevant.some(
        (r) =>
          r.type === 'childList' &&
          r.target instanceof Element &&
          anchors.some(({ element }) =>
            (r.target as Element).contains(element),
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
      const target = anchors.find((a) => a.element === entry.target),
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
      keyframes.length > CANDY_FRAME_LIMIT ||
      animations.length >= plan.animationLimit
    )
      throw new Error('Candy artwork or animation budget unavailable');
    const animation = element.animate(keyframes, {
      duration: CANDY_MS,
      fill: 'both',
    });
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  try {
    plan.sweets.forEach((sweet, i) =>
      animate(`[data-candy-sweet="${i}"]`, sweet.frames),
    );
    plan.birds.forEach((bird, i) => {
      const selector = `[data-candy-bird="${i}"]`;
      animate(selector, bird.frames);
      animate(`${selector} [data-candy-facing]`, bird.facing);
      animate(`${selector} [data-candy-head]`, bird.head);
      animate(`${selector} [data-candy-wing]`, bird.wing);
    });
    plan.janitors.forEach((janitor, i) => {
      const selector = `[data-candy-janitor="${i}"]`;
      animate(selector, janitor.frames);
      animate(`${selector} [data-candy-facing]`, janitor.facing);
      animate(`${selector} [data-candy-arms]`, janitor.arms);
      janitor.legs.forEach((frames, leg) =>
        animate(`${selector} [data-candy-leg="${leg}"]`, frames),
      );
    });
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
    deadline = setTimeout(stop, CANDY_MS);
  } catch {
    stop();
  }
  return stop;
};
