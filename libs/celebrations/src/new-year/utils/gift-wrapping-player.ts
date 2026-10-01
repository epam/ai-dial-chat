import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';

/** The scene uses one local composition without owning the global player. */
export interface LottiePlayer {
  loadAnimation(options: AnimationConfigWithData<'svg'>): AnimationItem;
}

/** Keep the SVG-only player out of the event until this scene is selected. */
export const loadGiftWrappingPlayer = async (): Promise<LottiePlayer> => {
  const { default: player } =
    await import('lottie-web/build/player/lottie_light');
  return player;
};
