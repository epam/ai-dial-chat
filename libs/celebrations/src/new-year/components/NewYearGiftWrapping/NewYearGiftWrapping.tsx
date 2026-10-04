import { useEffect, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useLottieSceneSession } from '../../../hooks/useLottieSceneSession';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { LottieScenePhase } from '../../../types/lottie-scene';
import { GIFT_WRAPPING_PLAYBACK } from '../../utils/gift-wrapping-animation';
import { buildGiftWrappingComposition } from '../../utils/gift-wrapping-composition';
import { getGiftWrappingTarget } from '../../utils/gift-wrapping-targets';
import { GiftElf } from './GiftWrappingArt';

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
  const { phase, preparation, hostRef, cancel } = useLottieSceneSession({
    enabled: !reduced && supported && !changed,
    playback: GIFT_WRAPPING_PLAYBACK,
    /* Runs after the player import, so the composer is measured as it is then. */
    prepare: () =>
      buildGiftWrappingComposition(
        getGiftWrappingTarget(anchors, isMobile),
        isMobile,
      ),
  });
  const stationary = reduced || !supported || phase === LottieScenePhase.Failed;
  const ended = phase === LottieScenePhase.Ended;

  useEffect(() => {
    if (changed || ended) return;
    const handleInterrupt = (event?: Event) => {
      if (event?.type === 'visibilitychange' && !document.hidden) return;
      cancel();
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
    events.forEach((name) =>
      window.addEventListener(name, handleInterrupt, true),
    );
    window.visualViewport?.addEventListener('resize', handleInterrupt);
    window.visualViewport?.addEventListener('scroll', handleInterrupt);
    return () => {
      events.forEach((name) =>
        window.removeEventListener(name, handleInterrupt, true),
      );
      window.visualViewport?.removeEventListener('resize', handleInterrupt);
      window.visualViewport?.removeEventListener('scroll', handleInterrupt);
    };
  }, [cancel, changed, ended]);

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
  if (!preparation) return null;
  return (
    <div
      key="animation"
      ref={hostRef}
      className="pointer-events-none absolute inset-0 select-none overflow-clip"
      inert
      aria-hidden="true"
      data-new-year-scene="gift-wrapping"
      data-gift-target={preparation.target.source ? 'composer' : 'parcel'}
    />
  );
};

export default NewYearGiftWrapping;
