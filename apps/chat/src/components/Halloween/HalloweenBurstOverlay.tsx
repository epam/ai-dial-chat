import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { HalloweenBurst } from '../../types/halloween';
import { buildHalloweenWebLayout } from '../../utils/halloween';
import styles from './Halloween.module.scss';
import HalloweenBats from './HalloweenBats';
import HalloweenBowling from './HalloweenBowling';
import HalloweenCatScene from './HalloweenCatScene';
import {
  HalloweenCandy,
  HalloweenFootprints,
  HalloweenSkeletons,
} from './HalloweenExtras';
import HalloweenGhosts from './HalloweenGhosts';
import HalloweenMimic from './HalloweenMimic';
import HalloweenMummy from './HalloweenMummy';
import HalloweenNightFlight from './HalloweenNightFlight';
import HalloweenPortal from './HalloweenPortal';
import HalloweenRavens from './HalloweenRavens';
import { HalloweenCauldron } from './HalloweenSecrets';
import HalloweenSpiderTheft from './HalloweenSpiderTheft';
import HalloweenTrain from './HalloweenTrain';
import HalloweenWeb from './HalloweenWeb';

const extraScenes: Partial<Record<HalloweenBurst, FC>> = {
  [HalloweenBurst.Bats]: HalloweenBats,
  [HalloweenBurst.Ghost]: HalloweenGhosts,
  [HalloweenBurst.Spiders]: HalloweenSpiderTheft,
  [HalloweenBurst.Train]: HalloweenTrain,
  [HalloweenBurst.Portal]: HalloweenPortal,
  [HalloweenBurst.Ravens]: HalloweenRavens,
  [HalloweenBurst.Candy]: HalloweenCandy,
  [HalloweenBurst.Footprints]: HalloweenFootprints,
  [HalloweenBurst.Skeletons]: HalloweenSkeletons,
  [HalloweenBurst.Cauldron]: HalloweenCauldron,
  [HalloweenBurst.Mimic]: HalloweenMimic,
  [HalloweenBurst.Bowling]: HalloweenBowling,
  [HalloweenBurst.Mummy]: HalloweenMummy,
};

interface Props {
  /** Which celebration to play. */
  burst: HalloweenBurst;
}

/** Scene artwork only; the shared celebration runtime supplies its viewport layer. */
const HalloweenBurstOverlay: FC<Props> = ({ burst }) => {
  const ExtraScene = extraScenes[burst];
  const isMobile = useIsMobile();
  const webLayout = useMemo(
    () =>
      burst === HalloweenBurst.Web ? buildHalloweenWebLayout(isMobile) : null,
    [burst, isMobile],
  );

  return (
    <>
      {ExtraScene && <ExtraScene />}
      {webLayout && (
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className={styles.webNetwork}
          focusable="false"
        >
          {webLayout.strands.map((strand) => (
            <path
              key={`${strand.from}-${strand.to}`}
              d={strand.path}
              style={strand.style}
              pathLength="1"
              vectorEffect="non-scaling-stroke"
              className={styles.webBridge}
            />
          ))}
        </svg>
      )}
      {webLayout?.webs.map((web, index) => (
        <HalloweenWeb key={index} style={web.style} />
      ))}
      {burst === HalloweenBurst.Witches && (
        <HalloweenNightFlight burst={burst} />
      )}
      {burst === HalloweenBurst.Cat && <HalloweenCatScene />}
    </>
  );
};

export default memo(HalloweenBurstOverlay);
