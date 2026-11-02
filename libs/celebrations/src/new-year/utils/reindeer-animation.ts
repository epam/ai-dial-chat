import type { LottieScenePlayback } from '../../models/lottie-scene';
import { LottieDataOwnership } from '../../types/lottie-scene';
import { observeSceneTargets } from '../../utils/scene-targets';
import {
  REINDEER_BEATS as B,
  REINDEER_TAKEOFF_MS,
  type ReindeerComposition,
} from './reindeer-composition';
import { animateReindeerText } from './reindeer-text';

/** The rim clip, word and vector cast share the renderer's frame-zero clock. */
export const REINDEER_PLAYBACK: LottieScenePlayback<ReindeerComposition> = {
  timings: {
    loadTimeoutMs: 2000,
    readyTimeoutMs: 250,
    playbackMs: REINDEER_TAKEOFF_MS,
  },
  ownership: LottieDataOwnership.Transferred,
  getAnimationData: (preparation) => preparation.animationData,
  onAnimationCreated: ({ preparation, host, cancel, addDisposer }) => {
    addDisposer(
      observeSceneTargets(preparation.targets.watched, cancel, [host]),
    );
    const attributes = new MutationObserver(cancel);
    attributes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir', 'class', 'style'],
    });
    if (preparation.targets.word)
      attributes.observe(preparation.targets.word.element, {
        attributes: true,
        attributeFilter: ['placeholder', 'value', 'disabled', 'readonly'],
      });
    addDisposer(() => attributes.disconnect());
  },
  onPlaybackStarted: ({ preparation, host, addDisposer, timelineZeroMs }) => {
    const { width, rim, bounds, word } = preparation.targets;
    const clip = (edge: typeof rim) =>
      `inset(0 ${Math.max(0, width - edge.right)}px 0 ${edge.left}px)`;
    const animation = host.animate(
      [
        { offset: 0, clipPath: clip(rim), easing: 'steps(1, end)' },
        { offset: B.launch / 23, clipPath: clip(bounds) },
        { offset: 1, clipPath: clip(bounds) },
      ],
      { duration: REINDEER_TAKEOFF_MS, fill: 'both' },
    );
    animation.startTime = timelineZeroMs;
    addDisposer(() => animation.cancel());
    if (word)
      addDisposer(
        animateReindeerText(
          word,
          host,
          preparation.wordFrames,
          REINDEER_TAKEOFF_MS,
          timelineZeroMs,
          B.caught / 23,
          B.restored / 23,
        ),
      );
  },
};
