import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
  LottieScenePlayback,
  LottieSceneTimings,
} from '../../models/lottie-scene';
import { LottieDataOwnership } from '../../types/lottie-scene';
import { observeSceneTargets } from '../../utils/scene-targets';
import { startSnowmanCard } from './snowman-delivery-card';
import {
  SNOWMAN_DELIVERY_MS,
  type SnowmanDeliveryComposition,
} from './snowman-delivery-composition';

/** Load, readiness and playback deadlines; the provider lifetime adds a 2500 ms exit allowance. */
export const SNOWMAN_DELIVERY_TIMINGS: LottieSceneTimings = {
  loadTimeoutMs: 2000,
  readyTimeoutMs: 250,
  playbackMs: SNOWMAN_DELIVERY_MS,
};

const CARD_LAYER_ATTRIBUTE = 'data-snowman-card-layer';

/* One scene-owned layer beneath the renderer's SVG holds the card copy, so
   the snowman's mittens and the snowbank draw over it. */
const createCardLayer = (host: HTMLElement): HTMLElement => {
  const layer = document.createElement('div');
  layer.setAttribute(CARD_LAYER_ATTRIBUTE, '');
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

/* Cancels when a measured host element mutates, moves or disconnects;
   the renderer's own SVG and the card layer are owned by the scene. */
const watchTargets = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<SnowmanDeliveryComposition>) => {
  if (preparation.targets.card) {
    const layer = createCardLayer(host);
    addDisposer(() => layer.remove());
  }
  addDisposer(observeSceneTargets(preparation.targets.watched, cancel, [host]));
};

const startCard = ({
  preparation,
  host,
  addDisposer,
  cancel,
  timelineZeroMs,
}: LottiePlaybackStartContext<SnowmanDeliveryComposition>) => {
  const layer = host.querySelector<HTMLElement>(`[${CARD_LAYER_ATTRIBUTE}]`);
  if (!layer) return;
  const stop = startSnowmanCard(preparation, layer, timelineZeroMs, cancel);
  if (stop) addDisposer(stop);
};

/** The scene's contribution to its Lottie session: timings, single-use data, target observers and the synchronized card copy. */
export const SNOWMAN_DELIVERY_PLAYBACK: LottieScenePlayback<SnowmanDeliveryComposition> =
  {
    timings: SNOWMAN_DELIVERY_TIMINGS,
    ownership: LottieDataOwnership.Transferred,
    getAnimationData: (composition) => composition.animationData,
    onAnimationCreated: watchTargets,
    onPlaybackStarted: startCard,
  };
