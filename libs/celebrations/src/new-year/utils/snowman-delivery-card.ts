import { animateCelebrationSnapshots } from '../../utils/celebration-snapshots';
import {
  SNOWMAN_DELIVERY_MS,
  type SnowmanCardFrame,
  type SnowmanDeliveryComposition,
} from './snowman-delivery-composition';

/** WAAPI keyframes of the card copy, relative to the original rect. */
export const toCardKeyframes = (frames: SnowmanCardFrame[]): Keyframe[] =>
  frames.map(({ offset, dx, dy, rotate, opacity, easing }) => ({
    offset,
    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg)`,
    opacity,
    easing,
  }));

/**
 * Starts the borrowed card's inert copy on the Lottie clock: the copy and
 * the original's opacity share `timelineZeroMs` as their start time. A stop
 * before the restore time means the snapshot helper saw an interruption, so
 * the scene is cancelled too. Returns the stop function, or `null` without a
 * card.
 */
export const startSnowmanCard = (
  composition: SnowmanDeliveryComposition,
  layer: HTMLElement,
  timelineZeroMs: number,
  onInterrupted: () => void,
): (() => void) | null => {
  const card = composition.targets.card;
  if (!card || !composition.cardFrames.length) return null;
  const keyframes = toCardKeyframes(composition.cardFrames);
  const startedAt = timelineZeroMs;
  let isStopping = false;
  const stop = animateCelebrationSnapshots([card], layer, {
    durationMs: SNOWMAN_DELIVERY_MS,
    hideAt: composition.cardHideAt,
    restoreAt: composition.cardRestoreAt,
    frames: () => keyframes,
    startTime: startedAt,
    onStop: () => {
      if (isStopping) return;
      const now = document.timeline?.currentTime;
      const elapsed =
        (typeof now === 'number' ? now : performance.now()) - startedAt;
      if (elapsed < composition.cardRestoreAt * SNOWMAN_DELIVERY_MS)
        onInterrupted();
    },
  });
  return () => {
    isStopping = true;
    stop();
  };
};
