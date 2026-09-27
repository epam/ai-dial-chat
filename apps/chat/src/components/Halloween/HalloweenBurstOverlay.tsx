import type { FC } from 'react';
import { memo } from 'react';
import { HalloweenBurst } from '../../types/halloween';
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
import HalloweenWebScene from './HalloweenWebScene';

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
  [HalloweenBurst.Web]: HalloweenWebScene,
};

interface Props {
  /** Which celebration to play. */
  burst: HalloweenBurst;
}

/** Scene artwork only; the shared celebration runtime supplies its viewport layer. */
const HalloweenBurstOverlay: FC<Props> = ({ burst }) => {
  const ExtraScene = extraScenes[burst];

  return (
    <>
      {ExtraScene && <ExtraScene />}
      {burst === HalloweenBurst.Witches && (
        <HalloweenNightFlight burst={burst} />
      )}
      {burst === HalloweenBurst.Cat && <HalloweenCatScene />}
    </>
  );
};

export default memo(HalloweenBurstOverlay);
