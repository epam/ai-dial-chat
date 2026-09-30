import { GIFT_WRAPPING_MS, type GiftWrappingPlan } from './gift-wrapping-plan';

/** Plays the prepared scene and releases every resource on interruption. */
export const animateGiftWrapping = (
  plan: GiftWrappingPlan,
  host: SVGSVGElement,
  onStop: () => void,
): (() => void) => {
  const animations: Animation[] = [];
  let stopped = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let mutation: MutationObserver | undefined;
  let resize: ResizeObserver | undefined;
  const source = plan.target.source;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    host.style.visibility = 'hidden';
    clearTimeout(deadline);
    mutation?.disconnect();
    resize?.disconnect();
    animations.forEach((animation) => animation.cancel());
    onStop();
  };
  const moved = () => {
    if (stopped || !source) return;
    const current = source.element.getBoundingClientRect();
    if (
      !source.element.isConnected ||
      (['left', 'top', 'width', 'height'] as const).some(
        (key) => Math.abs(current[key] - source.rect[key]) > 0.5,
      )
    )
      stop();
  };
  try {
    if (
      plan.tracks.length > plan.animationLimit ||
      plan.tracks.reduce((sum, track) => sum + track.frames.length, 0) >
        plan.frameLimit
    )
      throw new Error('Gift wrapping exceeds its animation budget');
    const start = document.timeline?.currentTime;
    for (const track of plan.tracks) {
      const element = host.querySelector(track.selector);
      if (!element) throw new Error('Gift wrapping artwork is incomplete');
      const animation = element.animate(track.frames, {
        duration: GIFT_WRAPPING_MS,
        fill: 'both',
      });
      animations.push(animation);
      if (typeof start === 'number') animation.startTime = start;
    }
    if (source) {
      mutation = new MutationObserver((records) => {
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
          !source.element.isConnected ||
          relevant.some(
            (r) =>
              source.element.contains(r.target) ||
              (r.type === 'attributes' &&
                r.target instanceof Element &&
                r.target.contains(source.element)),
          )
        ) {
          stop();
        } else if (relevant.length) moved();
      });
      mutation.observe(document.documentElement, {
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
          'open',
        ],
      });
      resize = new ResizeObserver(moved);
      let ancestor: HTMLElement | null = source.element;
      for (
        let depth = 0;
        ancestor && depth < 24;
        depth++, ancestor = ancestor.parentElement
      )
        resize.observe(ancestor);
    }
    deadline = setTimeout(stop, GIFT_WRAPPING_MS);
  } catch {
    stop();
  }
  return stop;
};
