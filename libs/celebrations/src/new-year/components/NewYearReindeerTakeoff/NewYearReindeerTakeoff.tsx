import { useEffect, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useLottieSceneSession } from '../../../hooks/useLottieSceneSession';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { LottieScenePhase } from '../../../types/lottie-scene';
import { REINDEER_PLAYBACK } from '../../utils/reindeer-animation';
import { prepareReindeerScene } from '../../utils/reindeer-scene';
import { ReindeerStill } from './ReindeerStill';

/** Two reindeer discover why their sleigh cannot fly; ordinary input always ends the story. */
const NewYearReindeerTakeoff: FC = () => {
  const { anchors, isMobile } = useCelebrationEnvironment();
  const isReduced = useReducedMotion();
  const [initial] = useState(() => ({ anchors, isMobile, isReduced }));
  const hasChanged =
    initial.anchors !== anchors ||
    initial.isMobile !== isMobile ||
    initial.isReduced !== isReduced;
  const [isSupported] = useState(
    () =>
      typeof Element !== 'undefined' &&
      typeof ResizeObserver === 'function' &&
      typeof MutationObserver === 'function' &&
      typeof Element.prototype.animate === 'function',
  );
  const { phase, preparation, hostRef, cancel } = useLottieSceneSession({
    enabled: !isReduced && isSupported && !hasChanged,
    playback: REINDEER_PLAYBACK,
    prepare: () => prepareReindeerScene(anchors, isMobile),
  });
  const isEnded = phase === LottieScenePhase.Ended;
  const isStationary =
    isReduced || !isSupported || phase === LottieScenePhase.Failed;
  useEffect(() => {
    if (hasChanged || isEnded) return;
    const handleInterrupt = (event: Event) => {
      if (event.type === 'visibilitychange' && !document.hidden) return;
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
  }, [cancel, hasChanged, isEnded]);
  if (isEnded || hasChanged) return null;
  if (isStationary)
    return (
      <div
        className="pointer-events-none absolute inset-s-1/2 bottom-8 w-72 -translate-x-1/2 rtl:translate-x-1/2"
        inert
        aria-hidden="true"
      >
        <ReindeerStill />
      </div>
    );
  if (!preparation) return null;
  const { rim, width } = preparation.targets;
  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 overflow-clip select-none"
      style={{
        clipPath: `inset(0 ${Math.max(0, width - rim.right)}px 0 ${rim.left}px)`,
      }}
      inert
      aria-hidden="true"
      data-new-year-scene="reindeer-takeoff"
      data-reindeer-catch={preparation.targets.word ? 'text' : 'ice'}
    />
  );
};

export default NewYearReindeerTakeoff;
