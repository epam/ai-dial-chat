import type { Point } from './lottie-composition';
import type { LottieNamespacedMarker } from './lottie-markers';

/** A measured anchor, in the coordinates of the layers being retargeted. */
export interface LottieAnchorTarget {
  /** The anchor point. */
  point: Point;
  /** The side the character works from: `1` toward +x, `-1` toward −x. */
  side: 1 | -1;
}

/** Layer names and bindings of one station retargeting. */
export interface LottieStationBinding {
  /** Name of the null layer whose position keyframes are the stations. */
  positionLayer: string;
  /** Name of the null layer whose hold x-scale keyframes carry the facing. */
  facingLayer: string;
  /** Prefix of the static reference nulls, followed by the anchor name. */
  referencePrefix: string;
  /** Bind ranges; each argument names an anchor. */
  bindings: readonly LottieNamespacedMarker[];
  /** Measured anchors keyed by name; ranges of a missing anchor stay as authored. */
  anchors: Readonly<Record<string, LottieAnchorTarget>>;
}

/** Layer names and ranges of a retargeting over several track nulls. */
export interface LottieTrackBinding {
  /** Names of the unparented null layers whose position keyframes are retargeted. */
  trackLayers: readonly string[];
  /** Name of the null layer whose hold x-scale keyframes carry the facing, if any. */
  facingLayer?: string;
  /** Prefix of the static reference nulls, followed by the anchor name. */
  referencePrefix: string;
  /** Prefix of the static null groups that move rigidly with the anchor named after it. */
  followPrefix?: string;
  /** Bind ranges; each argument names an anchor. */
  bindings: readonly LottieNamespacedMarker[];
  /** Stretch ranges; each lies between two bind ranges. */
  stretches?: readonly LottieNamespacedMarker[];
  /** Measured anchors keyed by name; ranges of a missing anchor stay as authored. */
  anchors: Readonly<Record<string, LottieAnchorTarget>>;
  /** Whether a track keyframe equal to the one before keeps that keyframe's bound value. Defaults to `false`. */
  holdsRest?: boolean;
}
