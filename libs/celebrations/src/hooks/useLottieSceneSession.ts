import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LottieSceneSession,
  LottieSceneSessionResult,
  UseLottieSceneSessionOptions,
} from '../models/lottie-scene';
import { LottieSceneOutcome, LottieScenePhase } from '../types/lottie-scene';
import { createLottieSceneSession } from '../utils/lottie-scene-session';

/**
 * Runs one Lottie session per scene activation, so a StrictMode rehearsal
 * never imports the player twice, and a cancelled scene never reappears as
 * its static fallback.
 */
export const useLottieSceneSession = <P>({
  enabled,
  playback,
  prepare,
  loadData,
}: UseLottieSceneSessionOptions<P>): LottieSceneSessionResult<P> => {
  const [prepared, setPrepared] = useState<{
    session: LottieSceneSession;
    preparation: P;
  } | null>(null);
  const [isEnded, setIsEnded] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<LottieSceneSession | null>(null);
  /* Host re-renders pass new closures; reading them through refs keeps the
     session and its deadlines from restarting. */
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => {
    if (!enabled || isEnded || isFailed) return;
    const load = loadDataRef.current;
    const session = createLottieSceneSession<P>({
      playback: playbackRef.current,
      prepare: (player, data) => prepareRef.current(player, data),
      loadData: load ? (signal) => load(signal) : undefined,
      onPrepared: (preparation) => setPrepared({ session, preparation }),
      onTerminal: (outcome) => {
        if (outcome === LottieSceneOutcome.Failed) setIsFailed(true);
        else setIsEnded(true);
      },
    });
    sessionRef.current = session;
    session.start();
    return () => {
      session.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
      /* A disposed session's preparation must not describe the next run. */
      setPrepared((current) => (current?.session === session ? null : current));
    };
  }, [enabled, isEnded, isFailed]);

  useEffect(() => {
    if (prepared && hostRef.current) prepared.session.attach(hostRef.current);
  }, [prepared]);

  const cancel = useCallback(() => {
    if (hostRef.current) hostRef.current.style.visibility = 'hidden';
    sessionRef.current?.cancel();
    setIsEnded(true);
  }, []);

  let phase = LottieScenePhase.Idle;
  if (isEnded) phase = LottieScenePhase.Ended;
  else if (isFailed) phase = LottieScenePhase.Failed;
  else if (prepared) phase = LottieScenePhase.Prepared;
  else if (enabled) phase = LottieScenePhase.Loading;

  return {
    phase,
    preparation: prepared?.preparation ?? null,
    hostRef,
    cancel,
  };
};
