import { useEffect, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { animateGiftWrapping } from '../../utils/gift-wrapping-animation';
import {
  buildGiftWrappingComposition,
  type GiftWrappingComposition,
} from '../../utils/gift-wrapping-composition';
import {
  loadGiftWrappingPlayer,
  type LottiePlayer,
} from '../../utils/gift-wrapping-player';
import { getGiftWrappingTarget } from '../../utils/gift-wrapping-targets';
import { GiftElf } from './GiftWrappingArt';

interface PreparedScene {
  composition: GiftWrappingComposition;
  player: LottiePlayer;
}

/** An overenthusiastic helper accidentally gift-wraps the master elf. */
const NewYearGiftWrapping: FC = () => {
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
        const player = await loadGiftWrappingPlayer();
        clearTimeout(loadDeadline);
        if (disposed || cancelled.current || timedOut) return;
        if (document.hidden) {
          stop();
          return;
        }
        setPrepared({
          composition: buildGiftWrappingComposition(
            getGiftWrappingTarget(anchors, isMobile),
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
    const stop = animateGiftWrapping(
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
        <svg viewBox="0 0 220 145" focusable="false" data-gift-static>
          <g transform="translate(65 136) scale(.85)">
            <GiftElf stationary />
          </g>
          <g transform="translate(158 136) scale(-.8 .8)">
            <GiftElf helper stationary />
          </g>
        </svg>
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
      data-new-year-scene="gift-wrapping"
      data-gift-target={
        prepared.composition.target.source ? 'composer' : 'parcel'
      }
    />
  );
};

export default NewYearGiftWrapping;
