/** Where a Lottie scene session is in its lifecycle. */
export enum LottieSceneSessionState {
  /** Created; the player import has not started. */
  Idle = 'idle',
  /** The player import is pending under the load deadline. */
  Loading = 'loading',
  /** The scene is measured and composed; waiting for its host element. */
  Prepared = 'prepared',
  /** The renderer exists; waiting for readiness under the readiness deadline. */
  Initializing = 'initializing',
  /** Playback started at readiness and runs under the playback deadline. */
  Playing = 'playing',
  /** Ended by the authored story or the playback deadline. */
  Completed = 'completed',
  /** Ended by an interrupt, an environment change or disposal. */
  Cancelled = 'cancelled',
  /** Ended because the player or renderer could not load, start or play. */
  Failed = 'failed',
}

/** How a Lottie scene session ended. */
export enum LottieSceneOutcome {
  /** The story played to its end. */
  Completed = 'completed',
  /** Playback was interrupted; the scene must not fall back to static art. */
  Cancelled = 'cancelled',
  /** Playback could not happen; the scene shows its static fallback. */
  Failed = 'failed',
}

/** Who owns the animation data a session hands to the player. */
export enum LottieDataOwnership {
  /** Built for one session; the player may consume it once. */
  Transferred = 'transferred',
  /** An immutable source the caller keeps; every playback gets a clone. */
  Shared = 'shared',
}

/** What a scene component renders while its Lottie session runs. */
export enum LottieScenePhase {
  /** No session runs, for example under reduced motion. */
  Idle = 'idle',
  /** The player import is pending. */
  Loading = 'loading',
  /** The host element can render and the renderer will attach to it. */
  Prepared = 'prepared',
  /** The scene completed or was cancelled and renders nothing. */
  Ended = 'ended',
  /** Playback failed and the scene shows its static fallback. */
  Failed = 'failed',
}
