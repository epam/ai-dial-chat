import type { CopyTrackAnchor, CopyTrackStage } from '../types/copy-track';
import type { Point } from './lottie-composition';

/** A live element and its bounds when the scene was prepared. */
export interface CopyTrackMeasuredElement {
  /** The element. */
  element: HTMLElement;
  /** Its viewport bounds at preparation. */
  rect: DOMRect;
}

/** The host geometry a stage is solved against, measured once. */
export interface CopyTrackStageHost {
  /** Viewport width, in pixels. */
  width: number;
  /** Viewport height, in pixels. */
  height: number;
  /** Horizontal extent of the welcome region, clamped to the viewport. */
  bounds: { left: number; right: number };
  /** Side the actor travels toward first: `1` toward +x. */
  preferredSide: 1 | -1;
  /** Whether the host uses its mobile layout. */
  isMobile: boolean;
  /** The eligible composer's bounds, if any. */
  composer?: DOMRect;
  /** The welcome heading's bounds, if any. */
  heading?: DOMRect;
  /** The starter list and every button in it, if any. */
  starters?: {
    rect: DOMRect;
    buttons: readonly { element: HTMLElement; rect: DOMRect }[];
  };
  /** Eligible starter cards, nearest to the entrance side first. */
  cards: readonly CopyTrackMeasuredElement[];
  /** Bounds of the resolved composer word, if any. */
  word?: DOMRect;
}

/** Authored reference geometry a stage plan is laid out from, in native units along the travel direction. */
export interface CopyTrackSpanReferences {
  /** Distance from the stance back to the entry edge. */
  entry: number;
  /** Offsets of each stretchable anchor from the stance, at the minimum and maximum span. */
  stretchable: Readonly<
    Record<
      CopyTrackAnchor.SpanStart | CopyTrackAnchor.SpanEnd | CopyTrackAnchor.Far,
      { min: Point; max: Point }
    >
  >;
  /** How far the cast band reaches past the far anchor. */
  overhang: number;
  /** Width of the authored reference card. */
  cardWidth: number;
  /** Height of the authored reference card. */
  cardHeight: number;
}

/** A solved stage: where the actor stands, which way it travels and every anchor, in viewport pixels. */
export interface CopyTrackStagePlan {
  /** The stage template. */
  stage: CopyTrackStage;
  /** Travel direction: `1` toward +x. */
  side: 1 | -1;
  /** Viewport y of the floor. */
  floor: number;
  /** The chosen span, in pixels. */
  span: number;
  /** Measured anchors. */
  anchors: Readonly<Partial<Record<CopyTrackAnchor, Point>>>;
  /** The borrowed card, for a card section. */
  card?: CopyTrackMeasuredElement;
  /** The band the cast occupies. */
  band: { left: number; right: number; top: number; bottom: number };
}
