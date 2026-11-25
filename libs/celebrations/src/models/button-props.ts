import type {
  CelebrationSnapshotSession,
  CelebrationSnapshotTarget,
} from '../utils/celebration-snapshots';

/** Reversible button copies prepared for the shared playback clock. */
export interface ButtonPropsPreparation {
  /** One session per prop, each with its own restore time. */
  copies: CelebrationSnapshotSession[];
  /** Source buttons whose geometry and content must remain stable. */
  watched: CelebrationSnapshotTarget[];
}
