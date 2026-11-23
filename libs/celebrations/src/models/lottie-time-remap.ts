/** One linear piece of a time remap, in frames. */
export interface LottieTimeRemapSegment {
  /** Composition frame the piece starts at. */
  from: number;
  /** Composition frame the piece ends at. */
  to: number;
  /** Local frame shown at `from`. */
  localFrom: number;
  /** Local frame shown at `to`. */
  localTo: number;
}

/** A contiguous run of local frames that plays in a section path. */
export interface LottieLocalRange {
  /** First local frame. */
  from: number;
  /** Local frame the run ends at. */
  to: number;
}

/** A fall the cat's reaction must follow, in local and composition frames. */
export interface LottieElasticRange {
  /** Local frame at which the push ends and the fall starts. */
  releaseFrame: number;
  /** Local frame of the authored landing. */
  landingFrame: number;
  /** Local length of the window after the landing that absorbs the difference. */
  elasticFrames: number;
  /** Length of the physical fall, in composition frames. */
  physicalFallFrames: number;
}

/** A trunk range and the equal-length window that replaces it. */
export interface LottieSplice {
  /** The trunk range that is cut out, in local frames. */
  cut: LottieLocalRange;
  /** The replacement window, in local frames. */
  fill: LottieLocalRange;
}

/** A step cycle repeated inside a composition window. */
export interface LottieCycleRepetition {
  /** The cycle, in local frames. */
  cycle: LottieLocalRange;
  /** First composition frame of the window. */
  from: number;
  /** Composition frame the window ends at. */
  to: number;
  /** How many times the cycle plays in the window. */
  count: number;
}
