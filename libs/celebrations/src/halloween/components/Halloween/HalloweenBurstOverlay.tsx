import type { FC } from 'react';
import { memo } from 'react';
import { HalloweenScene } from '../../types/halloween';
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

const extraScenes: Partial<Record<HalloweenScene, FC>> = {
  [HalloweenScene.Bats]: HalloweenBats,
  [HalloweenScene.Ghost]: HalloweenGhosts,
  [HalloweenScene.Spiders]: HalloweenSpiderTheft,
  [HalloweenScene.Portal]: HalloweenPortal,
  [HalloweenScene.Ravens]: HalloweenRavens,
  [HalloweenScene.Candy]: HalloweenCandy,
  [HalloweenScene.Footprints]: HalloweenFootprints,
  [HalloweenScene.Skeletons]: HalloweenSkeletons,
  [HalloweenScene.Cauldron]: HalloweenCauldron,
  [HalloweenScene.Mimic]: HalloweenMimic,
  [HalloweenScene.Bowling]: HalloweenBowling,
  [HalloweenScene.Mummy]: HalloweenMummy,
  [HalloweenScene.Web]: HalloweenWebScene,
};

interface Props {
  /** Which celebration to play. */
  burst: HalloweenScene;
  /** Optional soundtrack for the train scene. */
  trainSoundtrackUrl?: string;
}

/** Scene artwork only; the shared celebration runtime supplies its viewport layer. */
const HalloweenBurstOverlay: FC<Props> = ({ burst, trainSoundtrackUrl }) => {
  const ExtraScene = extraScenes[burst];

  return (
    <>
      {ExtraScene && <ExtraScene />}
      {burst === HalloweenScene.Witches && (
        <HalloweenNightFlight burst={burst} />
      )}
      {burst === HalloweenScene.Cat && <HalloweenCatScene />}
      {burst === HalloweenScene.Train && (
        <HalloweenTrain soundtrackUrl={trainSoundtrackUrl} />
      )}
    </>
  );
};

export default memo(HalloweenBurstOverlay);
