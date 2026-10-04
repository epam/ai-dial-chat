import type { RefObject } from 'react';
import type {
  LottieDataOwnership,
  LottieSceneOutcome,
  LottieScenePhase,
  LottieSceneSessionState,
} from '../types/lottie-scene';
import type { LottiePlayer } from '../utils/lottie-player';

/** The three sequential waits of one playback, in milliseconds. */
export interface LottieSceneTimings {
  /** Time allowed for the player import. */
  loadTimeoutMs: number;
  /** Time from renderer creation to readiness. */
  readyTimeoutMs: number;
  /** Story length, counted from readiness. */
  playbackMs: number;
}

/** What a scene adapter receives once its renderer exists. */
export interface LottieAnimationContext<P> {
  /** The scene's measured and composed preparation. */
  preparation: P;
  /** The element the renderer draws into. */
  host: HTMLElement;
  /** Registers a cleanup that runs once when the session ends. */
  addDisposer: (dispose: () => void) => void;
  /** Ends the session as cancelled. */
  cancel: () => void;
}

/** A scene's fixed contribution to its Lottie session. */
export interface LottieScenePlayback<P> {
  /** Deadlines of the session. */
  timings: LottieSceneTimings;
  /** Whether the animation data is single-use or must be cloned per playback. */
  ownership: LottieDataOwnership;
  /** Returns the Lottie JSON of a preparation. */
  getAnimationData: (preparation: P) => object;
  /** Installs scene observers once the renderer exists. */
  onAnimationCreated?: (context: LottieAnimationContext<P>) => void;
}

/** Inputs of one Lottie scene session. */
export interface LottieSceneSessionOptions<P> {
  /** The scene's timings, data ownership and observers. */
  playback: LottieScenePlayback<P>;
  /** Measures targets and builds the composition after the player loads. */
  prepare: (player: LottiePlayer) => P;
  /** Receives the preparation so the host element can render. */
  onPrepared: (preparation: P) => void;
  /** Receives the outcome once, unless the session was disposed. */
  onTerminal: (outcome: LottieSceneOutcome) => void;
  /** Loads the player. Defaults to `loadLottiePlayer`. */
  loadPlayer?: () => Promise<LottiePlayer>;
}

/** One activation's player import, readiness, playback and teardown. */
export interface LottieSceneSession {
  /** The current lifecycle state. */
  readonly state: LottieSceneSessionState;
  /** Starts the player import after one microtask. */
  start: () => void;
  /** Creates the renderer in `host` when the session is prepared. */
  attach: (host: HTMLElement) => void;
  /** Ends the session as cancelled and reports it. */
  cancel: () => void;
  /** Ends the session as cancelled without reporting it. */
  dispose: () => void;
}

/** Inputs of `useLottieSceneSession`. */
export interface UseLottieSceneSessionOptions<P> {
  /** Whether a session may run; false never loads the player. */
  enabled: boolean;
  /** The scene's timings, data ownership and observers. */
  playback: LottieScenePlayback<P>;
  /** Measures targets and builds the composition after the player loads. */
  prepare: (player: LottiePlayer) => P;
}

/** State and controls a scene component renders from. */
export interface LottieSceneSessionResult<P> {
  /** What the scene renders. */
  phase: LottieScenePhase;
  /** The current session's preparation, once available. */
  preparation: P | null;
  /** Ref for the element the renderer draws into. */
  hostRef: RefObject<HTMLDivElement | null>;
  /** Ends the scene; stable across renders. */
  cancel: () => void;
}
