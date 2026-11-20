/** How an authored null-layer track becomes the WAAPI track of a DOM copy. */
export interface CopyTrackOptions {
  /** Length of the WAAPI animation, in milliseconds. */
  durationMs: number;
  /** Returns the composition time, in milliseconds, at which a local frame shows. */
  toCompositionMs: (localFrame: number) => number;
  /** Local frame at which the authored track hands the copy to physics. */
  releaseFrame: number;
  /** First local frame the story plays; earlier keyframes are ignored and the first one from here is the rest. Defaults to `0`. */
  fromFrame?: number;
  /** `-1` mirrors the authored horizontal motion and rotation. */
  mirror: 1 | -1;
  /** CSS pixels per stage unit. */
  scale: number;
}

/** The physical fall a released copy makes, in CSS pixels and milliseconds. */
export interface CopyFallOptions {
  /** Length of the WAAPI animation. */
  durationMs: number;
  /** Composition time of the release. */
  releaseMs: number;
  /** Distance to the support or the floor. */
  dropPx: number;
  /** Width of the copy, which sets how far it tilts. */
  widthPx: number;
  /** The side the copy was pushed toward: `1` toward +x. */
  side: 1 | -1;
  /** Composition time at which the copy starts to fade back to its original. */
  restoreMs: number;
  /** Height of the rebound after the landing; omitted for no rebound. */
  reboundHeightPx?: number;
}

/** A copy's WAAPI keyframes up to the release, and where the push left it. */
export interface CopyTrack {
  /** Keyframes from offset 0 to the release. */
  keyframes: Keyframe[];
  /** Horizontal displacement at the release, in CSS pixels. */
  releaseX: number;
}
