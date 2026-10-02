import type {
  LottieAnimationContext,
  LottieScenePlayback,
  LottieSceneTimings,
} from '../../models/lottie-scene';
import { LottieDataOwnership } from '../../types/lottie-scene';
import {
  GIFT_WRAPPING_MS,
  type GiftWrappingComposition,
} from './gift-wrapping-composition';

/** Load, readiness and playback deadlines of the scene; the provider lifetime adds a 2500 ms exit allowance. */
export const GIFT_WRAPPING_TIMINGS: LottieSceneTimings = {
  loadTimeoutMs: 2000,
  readyTimeoutMs: 250,
  playbackMs: GIFT_WRAPPING_MS,
};

/* Stops the scene when the measured composer moves, changes or disconnects;
   mutations of the renderer's own SVG are ignored. */
const watchComposer = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<GiftWrappingComposition>) => {
  const source = preparation.target.source;
  if (!source) return;
  const moved = () => {
    const current = source.element.getBoundingClientRect();
    if (
      !source.element.isConnected ||
      (['left', 'top', 'width', 'height'] as const).some(
        (key) => Math.abs(current[key] - source.rect[key]) > 0.5,
      )
    )
      cancel();
  };
  const mutation = new MutationObserver((records) => {
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
      cancel();
    } else if (relevant.length) moved();
  });
  /* Each observer is released as soon as it exists, so a later throw in this
     adapter cannot leave it connected. */
  addDisposer(() => mutation.disconnect());
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
  const resize = new ResizeObserver(moved);
  addDisposer(() => resize.disconnect());
  let ancestor: HTMLElement | null = source.element;
  for (
    let depth = 0;
    ancestor && depth < 24;
    depth++, ancestor = ancestor.parentElement
  )
    resize.observe(ancestor);
};

/** The scene's contribution to its Lottie session: timings, single-use data and composer observers. */
export const GIFT_WRAPPING_PLAYBACK: LottieScenePlayback<GiftWrappingComposition> =
  {
    timings: GIFT_WRAPPING_TIMINGS,
    ownership: LottieDataOwnership.Transferred,
    getAnimationData: (composition) => composition.animationData,
    onAnimationCreated: watchComposer,
  };
