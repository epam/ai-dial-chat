import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';

/** The `lottie-web` release that renderer capability `lottie-light-svg-v1` is pinned to. */
export const LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION = '5.13.0';

/** The part of the SVG-only player a scene uses; scenes never own the global player. */
export interface LottiePlayer {
  loadAnimation(options: AnimationConfigWithData<'svg'>): AnimationItem;
}

/** Imports the SVG-only player into its own lazy chunk; holds no state between calls. */
export const loadLottiePlayer = async (): Promise<LottiePlayer> => {
  const { default: player } =
    await import('lottie-web/build/player/lottie_light');
  return player;
};

/**
 * Creates a paused, non-looping renderer in `container` with the
 * `lottie-light-svg-v1` settings. When the renderer cannot be configured, it is
 * released here and the error is rethrown.
 */
export const createLottieLightSvgAnimation = (
  player: LottiePlayer,
  container: HTMLElement,
  animationData: object,
): AnimationItem => {
  const animation = player.loadAnimation({
    container,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    animationData,
    rendererSettings: {
      progressiveLoad: false,
      preserveAspectRatio: 'xMidYMid meet',
      focusable: false,
    },
  });
  try {
    animation.setSubframe(true);
  } catch (error) {
    /* The caller never receives this renderer, so it cannot release it. */
    try {
      animation.destroy();
    } catch {
      container.replaceChildren();
    }
    throw error;
  }
  return animation;
};
