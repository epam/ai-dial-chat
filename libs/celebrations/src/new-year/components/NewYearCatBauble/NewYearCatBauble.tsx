import { useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useComposerInterrupts } from '../../../hooks/useComposerInterrupts';
import { useLottieSceneSession } from '../../../hooks/useLottieSceneSession';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { LottieScenePhase } from '../../../types/lottie-scene';
import { CatBaubleMode } from '../../types/new-year';
import { CAT_BAUBLE_PLAYBACK } from '../../utils/cat-bauble-animation';
import { buildCatBaubleComposition } from '../../utils/cat-bauble-composition';
import { getCatBaubleTargets } from '../../utils/cat-bauble-targets';
import { CatBaubleStill } from './CatBaubleStill';

/** Measured once after the player import; without an eligible composer the still shows. */
const prepareScene = (
  anchors: Parameters<typeof getCatBaubleTargets>[0],
  isMobile: boolean,
) => {
  const targets = getCatBaubleTargets(anchors, isMobile);
  if (targets.mode === CatBaubleMode.Static)
    throw new Error('No composer rim fits the cat and the fir');
  return buildCatBaubleComposition(targets, isMobile);
};

/** A cat swats the model selector into a fir, where it hangs as an ornament, and carries it back to its slot. */
const NewYearCatBauble: FC = () => {
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
    playback: CAT_BAUBLE_PLAYBACK,
    prepare: () => prepareScene(anchors, isMobile),
  });
  const stationary = reduced || !supported || phase === LottieScenePhase.Failed;
  const ended = phase === LottieScenePhase.Ended;

  useComposerInterrupts(!changed && !ended, cancel);

  if (ended || changed) return null;
  if (stationary)
    return (
      <div
        key="stationary"
        className="pointer-events-none absolute inset-s-1/2 bottom-8 h-36 w-52 -translate-x-1/2 rtl:translate-x-1/2"
        inert
        aria-hidden="true"
      >
        <CatBaubleStill />
      </div>
    );
  if (!preparation) return null;
  return (
    <div
      key="animation"
      ref={hostRef}
      className="pointer-events-none absolute inset-0 overflow-clip select-none"
      inert
      aria-hidden="true"
      data-new-year-scene="cat-bauble"
      data-cat-bauble-mode={preparation.targets.mode}
    />
  );
};

export default NewYearCatBauble;
