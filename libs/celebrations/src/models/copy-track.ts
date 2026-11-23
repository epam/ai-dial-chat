import type {
  CopyTrackRole,
  CopyTrackSectionKind,
  CopyTrackStage,
} from '../types/copy-track';
import type { LottieNamespacedMarker } from './lottie-markers';
import type { LottieLocalRange, LottieSplice } from './lottie-time-remap';

/** A declared section and what it needs. */
export interface CopyTrackSection {
  /** Section kind. */
  kind: CopyTrackSectionKind;
  /** Stage the section plays on. */
  stage: CopyTrackStage;
  /** Copy role the section needs, if any. */
  role?: CopyTrackRole;
}

/** A step cycle and the trunk range it repeats over, in local frames. */
export interface CopyTrackCycle {
  /** Slot number from the marker. */
  slot: string;
  /** The cycle. */
  cycle: LottieLocalRange;
  /** The window it repeats over. */
  window: LottieLocalRange;
}

/** The validated `ct:` markers of an asset, in local frames. */
export interface CopyTrackMarkers {
  /** Sections in priority order. */
  sections: CopyTrackSection[];
  /** The shared story. */
  trunk: LottieLocalRange;
  /** Splices keyed by the section kind that uses them, in trunk order. */
  splices: Partial<Record<CopyTrackSectionKind, LottieSplice[]>>;
  /** Bind ranges, by start frame. */
  binds: LottieNamespacedMarker[];
  /** Stretch ranges, by start frame. */
  stretches: LottieNamespacedMarker[];
  /** Step cycles, by window start. */
  cycles: CopyTrackCycle[];
  /** Frame at which the copy appears; present when a section needs a copy. */
  entryFrame?: number;
  /** Frame at which the copy fades back; present when a section needs a copy. */
  restoreFrame?: number;
  /** Contact instants, by frame. */
  contacts: LottieNamespacedMarker[];
}
