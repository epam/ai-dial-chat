import type { CelebrationSnapshotTarget } from '../utils/celebration-snapshots';

/** A prepared copy that attaches before readiness and starts on the Lottie clock. */
export interface CopyTrackCopySession {
  /** Appends the copy to `host`, invisible. */
  attach: (host: HTMLElement) => void;
  /** Starts every animation at `startTime`. */
  start: (startTime: number) => void;
  /** Removes the copy and cancels every animation once. */
  stop: () => void;
}

/** What `interaction-copy-track-v1` adds to a pack preparation. */
export interface CopyTrackPreparation {
  /** The copy of the chosen section's role; absent when the section copies nothing. */
  copy?: CopyTrackCopySession;
  /** Host elements whose change ends the scene, with the rectangles they were measured at. */
  watched: CelebrationSnapshotTarget[];
  /** Composition time, in milliseconds, at which the copy starts to fade back. */
  restoreMs: number;
  /** Callbacks the session context fills once the renderer exists. */
  handlers: {
    /** Called when the copy stops; set in `onAnimationCreated`. */
    onCopyStopped?: () => void;
    /** The `document.timeline` time of frame 0; set when playback starts. */
    startedAtMs?: number;
  };
}
