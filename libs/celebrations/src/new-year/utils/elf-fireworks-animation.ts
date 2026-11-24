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
  ELF_FIREWORKS_MS,
  type ElfButtonFrame,
  type ElfFireworksComposition,
} from './elf-fireworks-composition';

/** Load, readiness and playback deadlines; the provider lifetime adds a 2500 ms exit allowance. */
export const ELF_FIREWORKS_TIMINGS: LottieSceneTimings = {
  loadTimeoutMs: 2000,
  readyTimeoutMs: 250,
  playbackMs: ELF_FIREWORKS_MS,
};

const BUTTON_LAYER_ATTRIBUTE = 'data-elf-button-layer';

/** WAAPI keyframes of the button copy, relative to the original rect. */
export const toButtonKeyframes = (frames: ElfButtonFrame[]): Keyframe[] =>
  frames.map(({ offset, dx, dy, rotate, scaleY, opacity, easing }) => ({
    offset,
    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg) scale(1, ${scaleY.toFixed(3)})`,
    opacity,
    easing,
  }));

/* One scene-owned layer beneath the renderer's SVG holds the button copy,
   so the elf's boots and the cane's hook draw over it. */
const createButtonLayer = (host: HTMLElement): HTMLElement => {
  const layer = document.createElement('div');
  layer.setAttribute(BUTTON_LAYER_ATTRIBUTE, '');
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

/* Cancels when the composer or the button mutates, moves or disconnects. */
const watchTargets = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<ElfFireworksComposition>) => {
  if (preparation.targets.button) {
    const layer = createButtonLayer(host);
    addDisposer(() => layer.remove());
  }
  addDisposer(observeSceneTargets(preparation.targets.watched, cancel, [host]));
};

/**
 * Starts the button's inert copy on the Lottie clock. A stop before the
 * restore time means the snapshot helper saw an interruption, so the scene
 * is cancelled too. Returns the stop function, or `null` without a button.
 */
export const startElfButton = (
  composition: ElfFireworksComposition,
  layer: HTMLElement,
  timelineZeroMs: number,
  onInterrupted: () => void,
): (() => void) | null => {
  const button = composition.targets.button;
  if (!button || !composition.buttonFrames.length) return null;
  const keyframes = toButtonKeyframes(composition.buttonFrames);
  let isStopping = false;
  const stop = animateCelebrationSnapshots([button], layer, {
    durationMs: ELF_FIREWORKS_MS,
    hideAt: composition.buttonHideAt,
    restoreAt: composition.buttonRestoreAt,
    frames: () => keyframes,
    startTime: timelineZeroMs,
    onStop: () => {
      if (isStopping) return;
      const now = document.timeline?.currentTime;
      const elapsed =
        (typeof now === 'number' ? now : performance.now()) - timelineZeroMs;
      if (elapsed < composition.buttonRestoreAt * ELF_FIREWORKS_MS)
        onInterrupted();
    },
  });
  return () => {
    isStopping = true;
    stop();
  };
};

const startButton = ({
  preparation,
  host,
  addDisposer,
  cancel,
  timelineZeroMs,
}: LottiePlaybackStartContext<ElfFireworksComposition>) => {
  const layer = host.querySelector<HTMLElement>(`[${BUTTON_LAYER_ATTRIBUTE}]`);
  if (!layer) return;
  const stop = startElfButton(preparation, layer, timelineZeroMs, cancel);
  if (stop) addDisposer(stop);
};

/** The scene's contribution to its Lottie session: timings, single-use data, target observers and the synchronized button copy. */
export const ELF_FIREWORKS_PLAYBACK: LottieScenePlayback<ElfFireworksComposition> =
  {
    timings: ELF_FIREWORKS_TIMINGS,
    ownership: LottieDataOwnership.Transferred,
    getAnimationData: (composition) => composition.animationData,
    onAnimationCreated: watchTargets,
    onPlaybackStarted: startButton,
  };
