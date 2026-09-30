import type { AnimationItem } from 'lottie-web';
import {
  GIFT_WRAPPING_MS,
  type GiftWrappingComposition,
} from './gift-wrapping-composition';
import type { LottiePlayer } from './gift-wrapping-player';

/** Plays the prepared scene and releases every resource on interruption. */
export const animateGiftWrapping = (
  plan: GiftWrappingComposition,
  host: HTMLElement,
  player: LottiePlayer,
  onStop: (failed: boolean) => void,
): (() => void) => {
  let animation: AnimationItem | undefined;
  let stopped = false;
  let playing = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let readinessDeadline: ReturnType<typeof setTimeout> | undefined;
  let mutation: MutationObserver | undefined;
  let resize: ResizeObserver | undefined;
  const source = plan.target.source;
  const finish = (failed: boolean) => {
    if (stopped) return;
    stopped = true;
    host.style.visibility = 'hidden';
    clearTimeout(deadline);
    clearTimeout(readinessDeadline);
    mutation?.disconnect();
    resize?.disconnect();
    if (animation) {
      animation.removeEventListener('DOMLoaded', ready);
      animation.removeEventListener('complete', stop);
      animation.removeEventListener('data_failed', fail);
      animation.removeEventListener('error', fail);
      try {
        animation.destroy();
      } catch {
        host.replaceChildren();
      }
    }
    onStop(failed);
  };
  const stop = () => finish(false);
  const fail = () => finish(true);
  const ready = () => {
    if (stopped || playing) return;
    if (!animation?.isLoaded) {
      fail();
      return;
    }
    playing = true;
    clearTimeout(readinessDeadline);
    animation.removeEventListener('DOMLoaded', ready);
    deadline = setTimeout(stop, GIFT_WRAPPING_MS);
    try {
      animation.play();
    } catch {
      fail();
    }
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
    animation = player.loadAnimation({
      container: host,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: plan.animationData,
      rendererSettings: {
        progressiveLoad: false,
        preserveAspectRatio: 'xMidYMid meet',
        focusable: false,
      },
    });
    animation.setSubframe(true);
    animation.addEventListener('DOMLoaded', ready);
    animation.addEventListener('complete', stop);
    animation.addEventListener('data_failed', fail);
    animation.addEventListener('error', fail);
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
    /* Local vector data emits DOMLoaded after the renderer initializes. Waiting
       also catches configuration errors emitted before loadAnimation returns. */
    readinessDeadline = setTimeout(fail, 250);
  } catch {
    fail();
  }
  return stop;
};
