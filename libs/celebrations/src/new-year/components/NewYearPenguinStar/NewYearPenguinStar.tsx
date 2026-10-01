import { useEffect, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import {
  loadLottiePlayer,
  type LottiePlayer,
} from '../../../utils/lottie-player';
import { animatePenguinStar } from '../../utils/penguin-star-animation';
import {
  buildPenguinStarComposition,
  type PenguinStarComposition,
} from '../../utils/penguin-star-composition';
import { getPenguinStarTargets } from '../../utils/penguin-star-targets';
import { PenguinStarStill } from './PenguinStarStill';

interface PreparedScene {
  composition: PenguinStarComposition;
  player: LottiePlayer;
}

/** A hat-wearing penguin folds an idle page control into a star for the fir. */
const NewYearPenguinStar: FC = () => {
  const { anchors, isMobile } = useCelebrationEnvironment();
  const reduced = useReducedMotion();
  const [initial] = useState(() => ({ anchors, isMobile, reduced }));
  const changed =
    initial.anchors !== anchors ||
    initial.isMobile !== isMobile ||
    initial.reduced !== reduced;
  const [supported] = useState(
    () =>
      typeof ResizeObserver === 'function' &&
      typeof MutationObserver === 'function',
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const stationary = reduced || !supported || loadFailed;
  const [prepared, setPrepared] = useState<PreparedScene | null>(null);
  const [ended, setEnded] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const stopPlayback = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (changed || ended) return;
    let disposed = false;
    let timedOut = false;
    let loadDeadline: ReturnType<typeof setTimeout> | undefined;
    const stop = (event?: Event) => {
      if (event?.type === 'visibilitychange' && !document.hidden) return;
      cancelled.current = true;
      clearTimeout(loadDeadline);
      if (host.current) host.current.style.visibility = 'hidden';
      stopPlayback.current?.();
      setEnded(true);
    };
    const events = [
      'pointerdown',
      'click',
      'keydown',
      'focusin',
      'focusout',
      'beforeinput',
      'input',
      'compositionstart',
      'scroll',
      'resize',
      'visibilitychange',
    ];
    events.forEach((name) => window.addEventListener(name, stop, true));
    window.visualViewport?.addEventListener('resize', stop);
    window.visualViewport?.addEventListener('scroll', stop);
    const prepare = async () => {
      await Promise.resolve();
      if (disposed || cancelled.current || stationary) return;
      if (document.hidden) {
        stop();
        return;
      }
      loadDeadline = setTimeout(() => {
        timedOut = true;
        if (!disposed && !cancelled.current) setLoadFailed(true);
      }, 2000);
      try {
        const player = await loadLottiePlayer();
        clearTimeout(loadDeadline);
        if (disposed || cancelled.current || timedOut) return;
        if (document.hidden) {
          stop();
          return;
        }
        setPrepared({
          composition: buildPenguinStarComposition(
            getPenguinStarTargets(anchors, isMobile),
            isMobile,
          ),
          player,
        });
      } catch {
        clearTimeout(loadDeadline);
        if (!disposed && !cancelled.current && !timedOut) setLoadFailed(true);
      }
    };
    prepare();
    return () => {
      disposed = true;
      clearTimeout(loadDeadline);
      events.forEach((name) => window.removeEventListener(name, stop, true));
      window.visualViewport?.removeEventListener('resize', stop);
      window.visualViewport?.removeEventListener('scroll', stop);
    };
  }, [anchors, isMobile, stationary, changed, ended]);

  useEffect(() => {
    if (
      !prepared ||
      !host.current ||
      stationary ||
      changed ||
      ended ||
      cancelled.current
    )
      return;
    let disposed = false;
    const stop = animatePenguinStar(
      prepared.composition,
      host.current,
      prepared.player,
      (failed) => {
        if (disposed) return;
        if (failed) setLoadFailed(true);
        else setEnded(true);
      },
    );
    stopPlayback.current = stop;
    return () => {
      disposed = true;
      stop();
      stopPlayback.current = null;
    };
  }, [prepared, stationary, changed, ended]);

  if (ended || changed) return null;
  if (stationary)
    return (
      <div
        key="stationary"
        className="pointer-events-none absolute bottom-8 start-1/2 h-32 w-52 -translate-x-1/2 rtl:translate-x-1/2"
        inert
        aria-hidden="true"
      >
        <PenguinStarStill />
      </div>
    );
  if (!prepared) return null;
  return (
    <div
      key="animation"
      ref={host}
      className="pointer-events-none absolute inset-0 select-none overflow-clip"
      inert
      aria-hidden="true"
      data-new-year-scene="penguin-star"
      data-penguin-target={
        prepared.composition.targets.source ? 'composer' : 'snow'
      }
    />
  );
};

export default NewYearPenguinStar;
