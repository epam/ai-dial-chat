import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
  LottieScenePlayback,
  LottieSceneTimings,
} from '../../models/lottie-scene';
import { LottieDataOwnership } from '../../types/lottie-scene';
import { animateCelebrationSnapshots } from '../../utils/celebration-snapshots';
import { observeSceneTargets } from '../../utils/scene-targets';
import {
  CAT_BAUBLE_MS,
  type CatBaubleComposition,
  type CatToyFrame,
} from './cat-bauble-composition';

/** Load, readiness and playback deadlines; the provider lifetime adds a 2500 ms exit allowance. */
export const CAT_BAUBLE_TIMINGS: LottieSceneTimings = {
  loadTimeoutMs: 2000,
  readyTimeoutMs: 250,
  playbackMs: CAT_BAUBLE_MS,
};

const TOY_LAYER_ATTRIBUTE = 'data-cat-toy-layer';

/** WAAPI keyframes of the selector copy, relative to the original rect. */
export const toToyKeyframes = (frames: CatToyFrame[]): Keyframe[] =>
  frames.map(({ offset, dx, dy, rotate, opacity, easing }) => ({
    offset,
    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg)`,
    opacity,
    easing,
  }));

/* One scene-owned layer beneath the renderer's SVG holds the copy, so the
   fir's branches and the cat's head draw over it. */
const createToyLayer = (host: HTMLElement): HTMLElement => {
  const layer = document.createElement('div');
  layer.setAttribute(TOY_LAYER_ATTRIBUTE, '');
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
  });
  host.prepend(layer);
  return layer;
};

/* Cancels when the composer or the selector mutates, moves or disconnects. */
const watchTargets = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<CatBaubleComposition>) => {
  if (preparation.targets.selector) {
    const layer = createToyLayer(host);
    addDisposer(() => layer.remove());
  }
  addDisposer(observeSceneTargets(preparation.targets.watched, cancel, [host]));
};

/**
 * Starts the selector's inert copy on the Lottie clock. A stop before the
 * restore time means the snapshot helper saw an interruption, so the scene
 * is cancelled too. Returns the stop function, or `null` without a selector.
 */
export const startCatToy = (
  composition: CatBaubleComposition,
  layer: HTMLElement,
  timelineZeroMs: number,
  onInterrupted: () => void,
): (() => void) | null => {
  const selector = composition.targets.selector;
  if (!selector || !composition.toyFrames.length) return null;
  const keyframes = toToyKeyframes(composition.toyFrames);
  let isStopping = false;
  const stop = animateCelebrationSnapshots([selector], layer, {
    durationMs: CAT_BAUBLE_MS,
    hideAt: composition.toyHideAt,
    restoreAt: composition.toyRestoreAt,
    frames: () => keyframes,
    startTime: timelineZeroMs,
    onStop: () => {
      if (isStopping) return;
      const now = document.timeline?.currentTime;
      const elapsed =
        (typeof now === 'number' ? now : performance.now()) - timelineZeroMs;
      if (elapsed < composition.toyRestoreAt * CAT_BAUBLE_MS) onInterrupted();
    },
  });
  return () => {
    isStopping = true;
    stop();
  };
};

const startToy = ({
  preparation,
  host,
  addDisposer,
  cancel,
  timelineZeroMs,
}: LottiePlaybackStartContext<CatBaubleComposition>) => {
  const layer = host.querySelector<HTMLElement>(`[${TOY_LAYER_ATTRIBUTE}]`);
  if (!layer) return;
  const stop = startCatToy(preparation, layer, timelineZeroMs, cancel);
  if (stop) addDisposer(stop);
};

/** The scene's contribution to its Lottie session: timings, single-use data, target observers and the synchronized selector copy. */
export const CAT_BAUBLE_PLAYBACK: LottieScenePlayback<CatBaubleComposition> = {
  timings: CAT_BAUBLE_TIMINGS,
  ownership: LottieDataOwnership.Transferred,
  getAnimationData: (composition) => composition.animationData,
  onAnimationCreated: watchTargets,
  onPlaybackStarted: startToy,
};
