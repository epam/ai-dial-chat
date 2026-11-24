import { useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useComposerInterrupts } from '../../../hooks/useComposerInterrupts';
import { useLottieSceneSession } from '../../../hooks/useLottieSceneSession';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { LottieScenePhase } from '../../../types/lottie-scene';
import { ElfFireworksMode } from '../../types/new-year';
import { ELF_FIREWORKS_PLAYBACK } from '../../utils/elf-fireworks-animation';
import { buildElfFireworksComposition } from '../../utils/elf-fireworks-composition';
import { getElfFireworksTargets } from '../../utils/elf-fireworks-targets';
import { ElfFireworksStill } from './ElfFireworksStill';

/** Measured once after the player import; without an eligible composer the still shows. */
const prepareScene = (
  anchors: Parameters<typeof getElfFireworksTargets>[0],
  isMobile: boolean,
) => {
  const targets = getElfFireworksTargets(anchors, isMobile);
  if (targets.mode === ElfFireworksMode.Static)
    throw new Error('No composer rim fits the fireworks');
  return buildElfFireworksComposition(targets, isMobile);
};

/** An elf fishes the send button onto the composer rim, stomps it to launch fireworks and rides the last rocket away. */
const NewYearElfFireworks: FC = () => {
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
    playback: ELF_FIREWORKS_PLAYBACK,
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
        className="pointer-events-none absolute inset-s-1/2 bottom-8 h-32 w-52 -translate-x-1/2 rtl:translate-x-1/2"
        inert
        aria-hidden="true"
      >
        <ElfFireworksStill />
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
      data-new-year-scene="elf-fireworks"
      data-elf-fireworks-mode={preparation.targets.mode}
    />
  );
};

export default NewYearElfFireworks;
