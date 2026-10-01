import { memo, type FC } from 'react';
import { NewYearScene } from '../../types/new-year';
import NewYearGiftWrapping from '../NewYearGiftWrapping/NewYearGiftWrapping';
import NewYearPenguinStar from '../NewYearPenguinStar/NewYearPenguinStar';
import { NewYearConfetti, NewYearSnow } from './NewYearParticles';
import NewYearSleigh from './NewYearSleigh';

const scenes: Record<NewYearScene, FC> = {
  [NewYearScene.PenguinStar]: NewYearPenguinStar,
  [NewYearScene.GiftWrapping]: NewYearGiftWrapping,
  [NewYearScene.Snow]: NewYearSnow,
  [NewYearScene.Confetti]: NewYearConfetti,
  [NewYearScene.Sleigh]: NewYearSleigh,
};

interface Props {
  /** Scene selected by the shared celebration runtime. */
  scene: NewYearScene;
}

/** Select scene artwork; the shared runtime owns its viewport layer and lifetime. */
const NewYearSceneOverlay: FC<Props> = ({ scene }) => {
  const Scene = scenes[scene];
  return <Scene />;
};

export default memo(NewYearSceneOverlay);
