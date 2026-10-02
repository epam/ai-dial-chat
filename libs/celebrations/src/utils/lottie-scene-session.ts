import type { AnimationItem } from 'lottie-web';
import type {
  LottieAnimationContext,
  LottieSceneSession,
  LottieSceneSessionOptions,
} from '../models/lottie-scene';
import {
  LottieDataOwnership,
  LottieSceneOutcome,
  LottieSceneSessionState,
} from '../types/lottie-scene';
import {
  createLottieLightSvgAnimation,
  loadLottiePlayer,
  type LottiePlayer,
} from './lottie-player';

const TERMINAL_STATE: Record<LottieSceneOutcome, LottieSceneSessionState> = {
  [LottieSceneOutcome.Completed]: LottieSceneSessionState.Completed,
  [LottieSceneOutcome.Cancelled]: LottieSceneSessionState.Cancelled,
  [LottieSceneOutcome.Failed]: LottieSceneSessionState.Failed,
};

const isTerminal = (state: LottieSceneSessionState) =>
  state === LottieSceneSessionState.Completed ||
  state === LottieSceneSessionState.Cancelled ||
  state === LottieSceneSessionState.Failed;

/* Every teardown step runs even when an earlier one throws. */
const attempt = (step: () => void) => {
  try {
    step();
  } catch {
    /* A decorative scene has nothing to report; the next step still runs. */
  }
};

/** Creates one activation's Lottie session; it ends exactly once and then holds no resources. */
export const createLottieSceneSession = <P>({
  playback,
  prepare,
  onPrepared,
  onTerminal,
  loadPlayer = loadLottiePlayer,
}: LottieSceneSessionOptions<P>): LottieSceneSession => {
  let state = LottieSceneSessionState.Idle;
  let isStarted = false;
  let isSilent = false;
  let player: LottiePlayer | undefined;
  let prepared: { preparation: P } | undefined;
  let host: HTMLElement | undefined;
  let animation: AnimationItem | undefined;
  let loadDeadline: ReturnType<typeof setTimeout> | undefined;
  let readyDeadline: ReturnType<typeof setTimeout> | undefined;
  let playbackDeadline: ReturnType<typeof setTimeout> | undefined;
  const disposers: (() => void)[] = [];

  const finish = (outcome: LottieSceneOutcome) => {
    if (isTerminal(state)) return;
    state = TERMINAL_STATE[outcome];
    const element = host;
    if (element)
      attempt(() => {
        element.style.visibility = 'hidden';
      });
    clearTimeout(loadDeadline);
    clearTimeout(readyDeadline);
    clearTimeout(playbackDeadline);
    disposers.splice(0).reverse().forEach(attempt);
    const item = animation;
    if (item) {
      attempt(() => item.removeEventListener('DOMLoaded', ready));
      attempt(() => item.removeEventListener('complete', complete));
      attempt(() => item.removeEventListener('data_failed', fail));
      attempt(() => item.removeEventListener('error', fail));
      try {
        item.destroy();
      } catch {
        attempt(() => element?.replaceChildren());
      }
    }
    if (!isSilent) onTerminal(outcome);
  };
  const complete = () => finish(LottieSceneOutcome.Completed);
  const fail = () => finish(LottieSceneOutcome.Failed);
  const cancel = () => finish(LottieSceneOutcome.Cancelled);

  /* isLoaded is set before the renderer initializes its items; only DOMLoaded
     on a loaded renderer proves that rendering succeeded. */
  const ready = () => {
    if (state !== LottieSceneSessionState.Initializing || !animation) return;
    if (!animation.isLoaded) {
      fail();
      return;
    }
    state = LottieSceneSessionState.Playing;
    clearTimeout(readyDeadline);
    animation.removeEventListener('DOMLoaded', ready);
    playbackDeadline = setTimeout(complete, playback.timings.playbackMs);
    try {
      animation.play();
    } catch {
      fail();
    }
  };

  const addDisposer = (dispose: () => void) => {
    if (isTerminal(state)) attempt(dispose);
    else disposers.push(dispose);
  };

  const run = async () => {
    /* One microtask lets a StrictMode rehearsal dispose this session first. */
    await Promise.resolve();
    if (isTerminal(state)) return;
    if (document.hidden) {
      cancel();
      return;
    }
    state = LottieSceneSessionState.Loading;
    loadDeadline = setTimeout(fail, playback.timings.loadTimeoutMs);
    let loaded: LottiePlayer;
    try {
      loaded = await loadPlayer();
    } catch {
      if (state === LottieSceneSessionState.Loading) fail();
      return;
    }
    /* An import cannot be aborted; a late one after any ending is ignored. */
    if (state !== LottieSceneSessionState.Loading) return;
    clearTimeout(loadDeadline);
    if (document.hidden) {
      cancel();
      return;
    }
    try {
      prepared = { preparation: prepare(loaded) };
      player = loaded;
      state = LottieSceneSessionState.Prepared;
      onPrepared(prepared.preparation);
    } catch {
      fail();
    }
  };

  const attach = (element: HTMLElement) => {
    if (state !== LottieSceneSessionState.Prepared || !player || !prepared)
      return;
    const { preparation } = prepared;
    host = element;
    state = LottieSceneSessionState.Initializing;
    try {
      const source = playback.getAnimationData(preparation);
      const animationData =
        playback.ownership === LottieDataOwnership.Shared
          ? (JSON.parse(JSON.stringify(source)) as object)
          : source;
      animation = createLottieLightSvgAnimation(player, element, animationData);
      animation.addEventListener('DOMLoaded', ready);
      animation.addEventListener('complete', complete);
      animation.addEventListener('data_failed', fail);
      animation.addEventListener('error', fail);
      const context: LottieAnimationContext<P> = {
        preparation,
        host: element,
        addDisposer,
        cancel,
      };
      playback.onAnimationCreated?.(context);
      if (state === LottieSceneSessionState.Initializing)
        readyDeadline = setTimeout(fail, playback.timings.readyTimeoutMs);
    } catch {
      fail();
    }
  };

  return {
    get state() {
      return state;
    },
    start: () => {
      if (isStarted) return;
      isStarted = true;
      void run();
    },
    attach,
    cancel,
    dispose: () => {
      isSilent = true;
      cancel();
    },
  };
};
