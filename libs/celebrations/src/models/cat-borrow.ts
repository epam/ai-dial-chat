import type {
  CelebrationSnapshotSession,
  CelebrationSnapshotTarget,
} from '../utils/celebration-snapshots';

/** A button the cat can push, measured once. */
export interface CatBorrowPrize {
  /** The live button and its rectangle. */
  target: CelebrationSnapshotTarget;
  /** The side the cat pushes toward: `1` toward +x. */
  side: 1 | -1;
  /** The cat's stand point before the push, in viewport pixels. */
  standX: number;
  /** Total authored push, in viewport pixels. */
  pushPx: number;
  /** The starter button the copy lands on; absent when it falls to the floor. */
  support?: CelebrationSnapshotTarget;
  /** Distance from the button's bottom edge to its landing surface. */
  dropPx: number;
}

/** What `interaction-cat-borrow-v1` adds to a pack preparation. */
export interface CatBorrowPreparation {
  /** Cloned copies of the borrowed buttons, attached and started later. */
  copies: CelebrationSnapshotSession;
  /** Borrowed buttons and supports whose change ends the scene, with the rectangles they were measured at. */
  watched: CelebrationSnapshotTarget[];
  /** Composition time, in milliseconds, at which the copies start to fade back. */
  restoreMs: number;
  /** Callbacks the session context fills once the renderer exists. */
  handlers: {
    /** Called when the copies stop; set in `onAnimationCreated`. */
    onCopiesStopped?: () => void;
    /** The `document.timeline` time of frame 0; set when playback starts. */
    startedAtMs?: number;
  };
}
