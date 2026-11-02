import { useEffect, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useLottieSceneSession } from '../../../hooks/useLottieSceneSession';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { LottieScenePhase } from '../../../types/lottie-scene';
import { SnowmanStage } from '../../types/new-year';
import { SNOWMAN_DELIVERY_PLAYBACK } from '../../utils/snowman-delivery-animation';
import { buildSnowmanDeliveryComposition } from '../../utils/snowman-delivery-composition';
import { getSnowmanDeliveryTargets } from '../../utils/snowman-delivery-targets';
import { SnowmanDeliveryStill } from './SnowmanDeliveryStill';

/** Measured once after the player import; no fitting stage means the still. */
const prepareScene = (
  anchors: Parameters<typeof getSnowmanDeliveryTargets>[0],
  isMobile: boolean,
) => {
  const targets = getSnowmanDeliveryTargets(anchors, isMobile);
  if (targets.mode === SnowmanStage.Static)
    throw new Error('No stage fits the delivery');
  return buildSnowmanDeliveryComposition(targets, isMobile);
};

/** A pompous snowman sleds on a borrowed starter card, loses his head in a fir, delivers the present and returns the card. */
const NewYearSnowmanDelivery: FC = () => {
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
    playback: SNOWMAN_DELIVERY_PLAYBACK,
    prepare: () => prepareScene(anchors, isMobile),
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
        className="pointer-events-none absolute inset-s-1/2 bottom-8 h-32 w-52 -translate-x-1/2 rtl:translate-x-1/2"
        inert
        aria-hidden="true"
      >
        <SnowmanDeliveryStill />
      </div>
    );
  if (!preparation) return null;
  const { bounds, width } = preparation.targets;
  return (
    <div
      key="animation"
      ref={hostRef}
      className="pointer-events-none absolute inset-0 overflow-clip select-none"
      /* He walks in from behind the welcome region's edge, never over a side panel. */
      style={{
        clipPath: `inset(0 ${Math.max(0, width - bounds.right)}px 0 ${bounds.left}px)`,
      }}
      inert
      aria-hidden="true"
      data-new-year-scene="snowman-delivery"
      data-snowman-mode={preparation.targets.mode}
    />
  );
};

export default NewYearSnowmanDelivery;
