import { memo, type FC } from 'react';
import { NewYearScene } from '../../types/new-year';
import NewYearElfFireworks from '../NewYearElfFireworks/NewYearElfFireworks';
import NewYearGiftWrapping from '../NewYearGiftWrapping/NewYearGiftWrapping';
import NewYearPenguinStar from '../NewYearPenguinStar/NewYearPenguinStar';
import NewYearReindeerTakeoff from '../NewYearReindeerTakeoff/NewYearReindeerTakeoff';
import NewYearSnowmanDelivery from '../NewYearSnowmanDelivery/NewYearSnowmanDelivery';

const scenes: Record<NewYearScene, FC> = {
  [NewYearScene.PenguinStar]: NewYearPenguinStar,
  [NewYearScene.GiftWrapping]: NewYearGiftWrapping,
  [NewYearScene.SnowmanDelivery]: NewYearSnowmanDelivery,
  [NewYearScene.ReindeerTakeoff]: NewYearReindeerTakeoff,
  [NewYearScene.ElfFireworks]: NewYearElfFireworks,
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
