import type { SceneTargetBaseline } from '../utils/scene-targets';

/** A finite rectangle in viewport CSS pixels or authored stage units. */
export interface CornerRect {
  /** Left edge. */
  left: number;
  /** Top edge. */
  top: number;
  /** Right edge. */
  right: number;
  /** Bottom edge. */
  bottom: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
}

/** A visible host target and its original, untrimmed layout rectangle. */
export interface CornerTarget extends SceneTargetBaseline {
  /** Host element. */
  element: HTMLElement;
  /** Rectangle recorded during preparation. */
  rect: DOMRect;
  /** Whether an ancestor clips any part of the target. */
  isClipped: boolean;
}

/** Protected host content measured independently of animated-scene eligibility. */
export interface CornerTargets {
  /** Visible composer candidates, including those too small for animation. */
  composers: CornerTarget[];
  /** Visible rectangles the scene must not cover. */
  protectedTargets: CornerTarget[];
  /** Baselines whose mutation or movement invalidates placement. */
  watched: SceneTargetBaseline[];
  /** Checks bounded semantic target membership without reading layout. */
  hasTargetSetChanged: () => boolean;
}
