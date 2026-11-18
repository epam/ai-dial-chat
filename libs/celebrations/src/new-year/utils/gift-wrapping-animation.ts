import type {
  LottieAnimationContext,
  LottieScenePlayback,
  LottieSceneTimings,
} from '../../models/lottie-scene';
import { LottieDataOwnership } from '../../types/lottie-scene';
import { watchComposer } from '../../utils/composer-watch';
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

const watchGiftWrappingComposer = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<GiftWrappingComposition>) =>
  watchComposer({
    source: preparation.target.source,
    host,
    addDisposer,
    cancel,
  });

/** The scene's contribution to its Lottie session: timings, single-use data and composer observers. */
export const GIFT_WRAPPING_PLAYBACK: LottieScenePlayback<GiftWrappingComposition> =
  {
    timings: GIFT_WRAPPING_TIMINGS,
    ownership: LottieDataOwnership.Transferred,
    getAnimationData: (composition) => composition.animationData,
    onAnimationCreated: watchGiftWrappingComposer,
  };
