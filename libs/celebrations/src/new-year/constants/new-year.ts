import { NewYearScene } from '../types/new-year';
import { GIFT_WRAPPING_MS } from '../utils/gift-wrapping-composition';
import { PENGUIN_STAR_MS } from '../utils/penguin-star-composition';

/** The phrase that selects the hidden confetti scene from the chat input. */
export const NEW_YEAR_SECRET_PHRASE = 'happy new year';

/** Gift-click scenes in their existing random-pool order. */
export const NEW_YEAR_CLICK_SCENES = [
  NewYearScene.PenguinStar,
  NewYearScene.GiftWrapping,
  NewYearScene.Snow,
  NewYearScene.Confetti,
  NewYearScene.Sleigh,
] as const;

/** Every scene's runtime deadline, including its exit and cleanup allowance. */
export const NEW_YEAR_SCENE_DURATIONS: Record<NewYearScene, number> = {
  [NewYearScene.PenguinStar]: PENGUIN_STAR_MS + 2500,
  [NewYearScene.GiftWrapping]: GIFT_WRAPPING_MS + 2500,
  [NewYearScene.Snow]: 12000,
  [NewYearScene.Confetti]: 9000,
  [NewYearScene.Sleigh]: 12000,
};
