import { NewYearScene } from '../types/new-year';
import { GIFT_WRAPPING_MS } from '../utils/gift-wrapping-composition';
import { PENGUIN_STAR_MS } from '../utils/penguin-star-composition';
import { REINDEER_TAKEOFF_MS } from '../utils/reindeer-composition';
import { SNOWMAN_DELIVERY_MS } from '../utils/snowman-delivery-composition';

/** The phrase that selects a secret New Year story from the chat input. */
export const NEW_YEAR_SECRET_PHRASE = 'happy new year';

/** The scenes a gift click picks from at random. */
export const NEW_YEAR_CLICK_SCENES = [
  NewYearScene.PenguinStar,
  NewYearScene.SnowmanDelivery,
] as const;

/** Every scene's runtime deadline, including its exit and cleanup allowance. */
export const NEW_YEAR_SCENE_DURATIONS: Record<NewYearScene, number> = {
  [NewYearScene.PenguinStar]: PENGUIN_STAR_MS + 2500,
  [NewYearScene.GiftWrapping]: GIFT_WRAPPING_MS + 2500,
  [NewYearScene.SnowmanDelivery]: SNOWMAN_DELIVERY_MS + 2500,
  [NewYearScene.ReindeerTakeoff]: REINDEER_TAKEOFF_MS + 2500,
};
